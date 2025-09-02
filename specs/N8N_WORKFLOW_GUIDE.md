Step‑by‑Step Guide — n8n Workflows (Chat + Ingestion)

Prereqs
- Docker stack running (`n8n`, `qdrant`).
- In n8n, add a Credential for Gemini (API key) and set `N8N_ENCRYPTION_KEY` in `.env`.
- Qdrant collection `docs` with `size=768`.

Part A — Chat API Workflow
Goal: Expose `POST /webhook/chat` returning `{ answer }`.

1) Webhook Trigger node
- Method: POST
- Path: `chat`
- Response mode: On Last Node

2) Function (Extract Question)
Code:
```js
const q = $json.body?.question || $json.question || '';
if (!q) { return [{ json: { error: 'Missing question' }, pairedItem: { item: 0 } }]; }
return [{ json: { question: q } }];
```

3) LLM Embed (Gemini)
- Method: POST
- Option A: use the Gemini node and select your Gemini credential.
- Option B: HTTP Request to `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedText` and authenticate with your stored credential (API key in header or query).
- JSON Body:
```json
{ "text": "={{$json.question}}" }
```
- Response: JSON
- Post-processing (Set node right after):
```json
{ "vector": "={{$json.embedding.values}}" }
```

4) HTTP Request (Qdrant Search)
- Method: POST
- URL: `http://qdrant:6333/collections/docs/points/search`
- JSON Body:
```json
{
  "vector": "={{$json.vector}}",
  "limit": 5,
  "with_payload": true,
  "score_threshold": 0.2
}
```
- Response: JSON

5) Function (Compose Prompt)
Code:
```js
const res = $json.result || $json;
const hits = Array.isArray(res) ? res : (res?.result || res?.hits || res?.points || []);
const contexts = hits.slice(0,5).map((h,i) => `[#${i+1}] ${(h.payload?.chunk || '').trim()}`);
const prompt = `Answer using the context. Cite sources as [#n].\n\nContext:\n${contexts.join('\n\n')}\n\nQuestion: ${$node['Extract Question'].json['question']}\nAnswer:`;
return [{ json: { prompt } }];
```

6) LLM Generate (Gemini)
- Method: POST
- Option A: use the Gemini node with your credential.
- Option B: HTTP Request to `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent` authenticated via your stored credential.
- JSON Body:
```json
{
  "contents": [ { "parts": [ { "text": "={{$json.prompt}}" } ] } ]
}
```
- Response: JSON
- Set node (extract answer):
```json
{ "answer": "={{$json.candidates[0].content.parts[0].text}}" }
```

7) Webhook Response
- JSON Body:
```json
{ "answer": "={{$json.answer}}" }
```

Part B — Filesystem Ingestion Workflow
Goal: Periodically index new PDFs from `/home/node/files/incoming`.

1) Cron node
- Every minute (adjust as needed).

2) List Files node
- Directory: `/home/node/files/incoming`
- Glob Patterns: `*.pdf`

3) For Each (Split In Batches) → For every file, do:

3a) Move Binary Data (Read Binary File)
- Mode: Add binary
- Property: `data`
- File Path: `={{$json.path}}`

3b) Function (Compute Hash & Meta)
Code:
```js
const crypto = require('crypto');
const buf = Buffer.from($binary.data.data, 'base64');
const hash = crypto.createHash('sha256').update(buf).digest('hex');
return [{ json: { file_path: $json.path, file_name: $json.fileName, file_hash: hash } , binary: { data: $binary.data } }];
```

3c) HTTP Request (Qdrant Scroll by filter)
- Method: POST
- URL: `http://qdrant:6333/collections/docs/points/scroll`
- JSON Body:
```json
{
  "filter": { "must": [ { "key": "file_hash", "match": { "value": "={{$json.file_hash}}" } } ] },
  "limit": 1
}
```
- If found, optionally skip or delete old points (see 3d).

3d) HTTP Request (Qdrant Delete by filter) — optional reindex
- Method: POST
- URL: `http://qdrant:6333/collections/docs/points/delete`
- JSON Body:
```json
{ "filter": { "must": [ { "key": "file_hash", "match": { "value": "={{$json.file_hash}}" } } ] } }
```

3e) Extract Text (implementation-specific)
- Use an appropriate step to extract text from the PDF (native text or a cloud-based extractor), then continue with chunking.
  - Ensure the node outputs `{ text, file_path, file_hash }` for the next step.

3f) Function (Chunk)
Code:
```js
const text = $json.text || '';
const size = 1000, overlap = 200; const out = [];
for (let start = 0, idx = 0; start < text.length; start += (size - overlap), idx++) {
  out.push({ json: { chunk: text.slice(start, Math.min(text.length, start + size)), idx, file_path: $json.file_path, file_hash: $json.file_hash, created_at: new Date().toISOString() } });
}
return out;
```

3g) Embed per chunk (Gemini)
- Method: POST
- Use the Gemini node, or HTTP Request to `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedText` authenticated via your credential.
- JSON Body:
```json
{ "text": "={{$json.chunk}}" }
```
- Set node (vector): `{ "vector": "={{$json.embedding.values}}" }`

3h) HTTP Request (Qdrant Upsert)
- Method: POST
- URL: `http://qdrant:6333/collections/docs/points`
- JSON Body:
```json
{
  "points": [
    {
      "id": "={{$now.epoch}}-{{$json.idx}}",
      "vector": "={{$json.vector}}",
      "payload": {
        "file_path": "={{$json.file_path}}",
        "file_hash": "={{$json.file_hash}}",
        "chunk_idx": "={{$json.idx}}",
        "chunk": "={{$json.chunk}}",
        "created_at": "={{$json.created_at}}"
      }
    }
  ]
}
```

3i) Move File (Post-process)
- If no errors: move from `incoming/` to `processed/`.
- On error: move to `failed/`.

JSON Node Snippets
- Gemini Embed request body:
```json
{ "text": "={{$json.chunk || $json.question}}" }
```
- Qdrant Search request body:
```json
{ "vector": "={{$json.vector}}", "limit": 5, "with_payload": true, "score_threshold": 0.2 }
```
- Webhook Response body:
```json
{ "answer": "={{$json.answer}}" }
```

Notes
- Ensure the HTTP Request nodes point to `qdrant` (Docker service name).
- For large files, consider batching and rate-limiting embedding calls.
