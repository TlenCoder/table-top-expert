Full Documentation

Services & Ports
- `n8n` (5678): workflow engine; SQLite persistence under `./data/n8n/.n8n`.
- `qdrant` (6333 REST, 6334 gRPC): vector DB; storage under `./data/qdrant`.
- `ui` (8080): nginx serving built React; proxies `/api/*` → `n8n:/webhook/*`.

Environment
- `.env`: `N8N_ENCRYPTION_KEY=...` (encrypts credentials stored in n8n)
- Optional `N8N_BASIC_AUTH_*` if protecting the editor.

Data Folders
- `./data/n8n/files/incoming` — drop PDFs here to ingest.
- `./data/n8n/files/processed` — successful ingests moved here.
- `./data/n8n/files/failed` — failed items moved here.

Qdrant Collection
- Create once:
```
PUT http://localhost:6333/collections/docs
{
  "vectors": { "size": 768, "distance": "Cosine" }
}
```

Gemini Calls
- Use the Gemini nodes in n8n or HTTP Request nodes authenticated with a Gemini credential stored in n8n.

Ingestion Overview
1) Cron lists PDFs from `incoming/`.
2) Compute SHA‑256 `file_hash`; check Qdrant payload existence.
3) Extract text (implementation-specific) → chunk (size ~1000, overlap ~200).
4) Embed chunks → upsert into Qdrant with payload metadata.
5) Move file to `processed/`; on failure move to `failed/`.

Chat Overview
1) Webhook receives `{ question }`.
2) Embed question.
3) Qdrant search top‑k with payload.
4) Compose prompt with citations (include `[#[n]]`).
5) Generate with Gemini (via node or authenticated request); return `{ answer }`.

React UI (Dev)
- Vite dev server on `5173` with HMR.
- Dev mocks: set `VITE_USE_MOCKS=true` before `npm run dev` to enable a Vite middleware that serves `POST /api/chat` with 2–3 paragraphs. No Service Worker is used.
- Non-mock: with `VITE_USE_MOCKS` unset/false, `/api/*` is proxied to `http://localhost:5678/webhook/*`.
- Typewriter effect shows responses in 3–6 character chunks; SFX are enabled by default and can be toggled.
- Skip long responses: if an answer exceeds 20 words, a fast‑forward (`⏩`) button appears next to the Send button while typing; clicking it stops SFX and the typewriter and renders the full answer instantly.

React UI (Prod)
- Built assets served by nginx in `ui` service on `8080`.
- `/api/*` → `http://n8n:5678/webhook/*` via nginx.

Troubleshooting
- Qdrant mis‑sized vectors: confirm collection `size: 768`.
- n8n encryption not set: confirm `.env` has `N8N_ENCRYPTION_KEY` and restart.
