Importing the n8n Workflows

Files
- `chat_webhook.json` — exposes `POST /webhook/chat` that performs RAG (embed → search → prompt → generate) and returns `{ answer }`.
 - `ingestion_filesystem.json` — cron workflow that scans `/home/node/files/incoming/*.pdf`, extracts text, chunks, embeds, and upserts to Qdrant; then moves files to `processed/`.

Import Steps
1) Open n8n at `http://localhost:5678`.
2) Workflows are also auto‑imported on container start from `data/n8n/workflows` if missing; manual import is optional.
3) After importing, open the workflow and verify these settings:
   - HTTP Request nodes referencing `qdrant` (Docker service name).
   - Gemini calls use the Gemini node or HTTP Request with a stored Credential (no `.env` key).
   - Directory paths match your mounts (`/home/node/files/incoming`, `/home/node/files/processed`).
4) Enable the workflows if desired.

Notes
- The ingestion workflow deletes any existing points by `file_hash` (idempotent reindex) before inserting new chunks.
