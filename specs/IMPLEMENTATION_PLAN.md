Implementation Plan & Task List

Phase 1 — Infrastructure — Completed
- [x] Confirm `.env` with `N8N_ENCRYPTION_KEY`.
- [x] Verify Docker stack: `docker compose up -d` (n8n, qdrant, ui).
- [x] Create Qdrant collection `docs` with vectors size 768 and Cosine.

Phase 2 — n8n Workflows
- [x] Chat API workflow (implemented JSON in `@specs/workflows/chat_webhook.json`)
  - [x] Webhook Trigger (`POST /chat`).
  - [x] Extract `question` from body.
  - [x] Embed → Qdrant Search → Compose Prompt → Generate → Webhook Response JSON `{ answer }`.
- [x] Filesystem Ingestion workflow (implemented JSON in `@specs/workflows/ingestion_filesystem.json`)
  - [x] Cron Trigger (every minute).
  - [x] Scan `/home/node/files/incoming/*.pdf`.
  - [x] Compute `file_hash`, delete existing by `file_hash` (idempotent reindex).
  - [x] Extract Text → Chunk → Embed → Upsert (Qdrant).
  - [x] Move file to `processed/` on success (else handle failure path).

Phase 3 — React UI (Dev)
- [x] Scaffold React + Vite + TS project in `ui/`.
- [x] Add Vite dev mock middleware (2–3 paragraph answer) enabled by `VITE_USE_MOCKS=true`.
- [x] Add typewriter effect (3–6 char chunks) with controls (Skip/Stop planned; current: type + Stop API available).
- [x] Add `SKIP` button for long responses (>20 words) to instantly render the full answer while typing.
- [x] Add SFX with Howler; toggle (default ON) persisted to localStorage.
- [x] Vite proxy `/api/*` → `http://localhost:5678/webhook/*` when mocks disabled.
- [x] Ensure HMR dev: `npm run dev` and `npm run dev:mocks`.

Phase 4 — Production UI
- [ ] Build UI `npm run build` → `ui/dist`.
- [x] nginx serves `ui/dist` and proxies `/api/*` → `http://n8n:5678/webhook/*` (configured in `ui/nginx.conf`, compose updated).
- [ ] Validate pathing and CORS (should be covered by reverse proxy).

Phase 5 — Validation — Completed
- [x] Ingestion test: place 5–10p PDF in `incoming/`, verify points in Qdrant and move to `processed/`.
- [x] Chat test: ask multiple questions; verify citations and relevance.
- [x] Resilience: change a file, ensure re‑indexing occurs (hash changed → old points deleted → new points upserted).

Backlog / Optional Enhancements
- [ ] Add DOCX parsing support.
- [ ] Implement re‑ranking (hybrid or MMR) client‑side or via additional workflow steps.
- [ ] Basic auth for n8n and nginx TLS for production use.
- [ ] Validate workflow auto‑import from `data/n8n/workflows` on container start.
