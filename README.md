RAG on n8n + Qdrant (Gemini)

Overview
- Runs `n8n` (workflow engine) and `qdrant` (vector DB) via Docker Compose.
- Uses Gemini for embeddings (`text-embedding-004`) and generation (e.g., `gemini-1.5-pro`).
- Persists data to mounted folders under `./data` (Windows-friendly).

Quick Start
- Copy `.env.example` to `.env` and set `N8N_ENCRYPTION_KEY`.
- Ensure Docker Desktop is running (Windows: WSL2 backend recommended).
- Create folders: `data/n8n/.n8n`, `data/n8n/files`, `data/qdrant` (Compose will create if missing).
- Start: `docker compose up -d`
- Open n8n: http://localhost:5678
- Qdrant REST: http://localhost:6333
 - UI (8-bit chat): http://localhost:8080 (proxies to n8n webhook)

Workflow Auto-Import
- On container startup, n8n auto-imports any workflow JSON in `./data/n8n/workflows` that does not already exist by name.
- Existing workflows are not overwritten; the folder is mounted read-only.

Credentials
- Use n8n’s Credentials Manager to store the Gemini API key (do not commit it to `.env`).
- The `N8N_ENCRYPTION_KEY` ensures credentials are encrypted at rest in n8n’s database.

Volumes
- n8n data: `./data/n8n/.n8n` -> `/home/node/.n8n`
- n8n input files: `./data/n8n/files` -> `/home/node/files`
- qdrant storage: `./data/qdrant` -> `/qdrant/storage`

Embedding Dimensionality
- Gemini `text-embedding-004` vector size is 768. Create Qdrant collection accordingly:

```
PUT http://localhost:6333/collections/docs
{
  "vectors": { "size": 768, "distance": "Cosine" }
}
```

PDF Parsing
- If your PDFs already contain extractable text, you can skip any external parsing services.
- For scanned PDFs, use your preferred approach within n8n (e.g., a custom node or a cloud model) to extract text before chunking.

Windows Notes
- GPU is not required for n8n or Qdrant. Gemini runs in the cloud.
- Volumes on Windows work fine; `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false` is set to avoid permission warnings.

Suggested n8n Workflows

Ingestion (high-level)
- Trigger: Manual or Schedule.
- Load file(s): from `/home/node/files` (mounted from `./data/n8n/files`).
- Extract text from PDFs (native text or via your chosen extraction step) and pass the resulting text to the chunking step below.
- Chunk text: 800–1200 chars, ~200 overlap. Example Code node:

```js
// Inputs: item.text
const text = $json.text || '';
const size = 1000;
const overlap = 200;
const chunks = [];
for (let start = 0; start < text.length; start += (size - overlap)) {
  chunks.push(text.slice(start, Math.min(text.length, start + size)));
}
return chunks.map((chunk, i) => ({ json: { chunk, idx: i } }));
```

- Embed chunks: use the Gemini node or an HTTP Request authenticated with your Gemini credential stored in n8n; map embedding values to `vector`.
- Upsert into Qdrant: HTTP Request `POST http://qdrant:6333/collections/docs/points` with body:

```json
{
  "points": [
    {
      "id": "={{$json.idx}}-={{$json.source}}",
      "vector": "={{$json.vector}}",
      "payload": {
        "source": "={{$json.source}}",
        "chunk": "={{$json.chunk}}",
        "path": "={{$json.path}}"
      }
    }
  ]
}
```

Query (high-level)
- Trigger: Webhook receives `{ "question": "..." }`.
- Embed question: same as above (Gemini node or authenticated HTTP Request).
- Search Qdrant: `POST http://qdrant:6333/collections/docs/points/search`

```json
{
  "vector": "={{$json.vector}}",
  "limit": 5,
  "with_payload": true,
  "score_threshold": 0.2
}
```

- Compose prompt: concatenate top-k contexts with the user question; include citation metadata.
- Generate answer: call Gemini `gemini-1.5-pro` via the Gemini node or an authenticated HTTP Request.
- Return JSON with answer + citations to the webhook response.

Security & Production Notes
- Consider enabling basic auth for n8n or placing it behind a reverse proxy with TLS.
- If exposing Qdrant beyond localhost, secure it behind a gateway.

HTTP Chat API (for UI)
- Create a separate n8n workflow with a Webhook Trigger:
  - Path: `chat` (the UI proxies to `/api/chat` → `http://n8n:5678/webhook/chat`).
  - Method: POST; Response: JSON.
- Flow (simple): Webhook → Function (extract `question`) → Embed → Qdrant Search → Compose Prompt → Generate → Webhook Response.
- Expected request body from UI:
  ```json
  { "question": "Your question" }
  ```
- Suggested Webhook Response node body:
  ```json
  { "answer": "={{$json.answer}}" }
  ```
- CORS: not required because the `ui` service proxies `/api/*` to the n8n webhook inside Docker.

UI Service
- Served by `nginx` on port 8080 with an 8‑bit style chat (static files under `./ui`).
- Proxy rules: requests to `/api/*` are forwarded to `http://n8n:5678/webhook/*` on the Docker network.
- The UI is a React app (Vite). Customize styles in `ui/styles.css` and components in `ui/src/*`.
- Typewriter effect displays answers progressively; if a response exceeds 20 words, a fast‑forward (`⏩`) button appears next to Send to instantly render the full answer and stop SFX.

 

Next Notes
- Typical PDFs are 5–10 pages (current batching is fine).
- n8n persists to SQLite as configured.
