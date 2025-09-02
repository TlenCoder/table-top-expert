Product Design Requirements (PDR) — n8n + Qdrant RAG with 8‑bit React UI

Summary
- Build a local-first RAG system powered by n8n workflows and Qdrant for vector storage, using Gemini models for embeddings and generation.
- Provide a production Docker stack (n8n, Qdrant, nginx UI) and a React + Vite dev UI with HMR and optional mocks.
- Sources: PDFs in local filesystem (including scanned). No Telegram. Chat UI only.

Goals
- Reliable ingestion of PDFs placed in a watched folder, extract text, chunk, embed with Gemini, and upsert into Qdrant.
- Chat API via n8n webhook that does retrieval-augmented generation using Qdrant + Gemini.
- 8‑bit themed chat UI that types answers in 3–6 character chunks, with SFX enabled by default and toggleable.
- Dev workflow for UI without Docker via Vite, with built-in dev mock middleware (no Service Worker).

Non-Goals
- No user authentication, access control, or multi-tenant management initially.
- No streaming server responses; the typing effect is client-side only.
- No custom model training or GPU acceleration.

Users & Use Cases
- Single user (developer/team) running locally on Windows (Docker Desktop + WSL2) to chat against a small corpus (5–10 page PDFs).
- Drop PDFs in an `incoming/` directory to be indexed automatically.

Success Metrics
- Time-to-first-answer: < 3s on small corpora with warm caches.
- Ingestion latency: < 60s from file drop to searchable.
- Correctness: top‑k retrieval contains relevant chunks for typical queries > 80% of the time on sample PDFs.

Constraints & Assumptions
- Gemini API access is available; the API key is stored in n8n Credentials (encrypted with `N8N_ENCRYPTION_KEY`).
- Qdrant vector size 768 (Gemini `text-embedding-004`).

High-Level Architecture
- Services (Docker):
  - `n8n`: workflow engine + SQLite persistence
  - `qdrant`: vector DB (REST 6333, gRPC 6334)
  - `ui`: nginx serving built React app; proxies `/api/*` → `n8n:/webhook/*`
- Dev UI: React + Vite with HMR; `/api/*` proxied to n8n or intercepted by a Vite dev mock middleware when `VITE_USE_MOCKS=true`.

Core Workflows
- Ingestion (cron):
  - Scan `/home/node/files/incoming/*.pdf` → extract text → chunk → embed → upsert → move file → `processed/` or `failed/`.
- Chat (webhook):
  - `POST /webhook/chat` with `{ question }` → embed → search → prompt → generate → return `{ answer }`.

Data Model (Qdrant payload)
- `file_path: string` — path in container
- `file_hash: string` — SHA‑256 of source file
- `chunk: string` — text chunk
- `chunk_idx: number` — index in file
- `page_start?: number`, `page_end?: number`
- `created_at: string (ISO)`

Security & Privacy
- Local deployment only; no internet exposure advised.
- Credentials are stored in n8n and encrypted with `N8N_ENCRYPTION_KEY`. Optionally protect n8n with basic auth.

Risks & Mitigations
- Text extraction quality on poor scans: choose a robust extraction approach; consider using cloud models for complex layouts.
- Gemini API limits: backoff/retry in n8n; throttle embeddings.
- Duplicate indexing: compute `file_hash`, de‑dupe before upsert; on change, delete prior points by `file_hash`.
