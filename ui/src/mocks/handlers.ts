import { http, HttpResponse } from 'msw';

const API_BASE = (import.meta as any).env.VITE_API_BASE || '/api';

const paragraphs = [
  'Retrieval‑augmented generation blends information retrieval with text generation. By retrieving relevant passages from your private corpus and grounding the model on that context, you reduce hallucinations and make answers traceable to sources.',
  'A practical pipeline starts with chunking documents into overlapping segments, embedding those chunks, and storing vectors in a similarity search index. At query time, you embed the question, search for top‑k neighbors, and compose a prompt that cites the retrieved evidence.',
  'Quality hinges on sensible chunk sizes, overlap, and a clean prompt that instructs the model to use only the provided context. Adding metadata like file path and page ranges enables richer citations and easier maintenance of the index.'
];

function mockAnswer(): string {
  // Return 2–3 paragraphs
  const n = 2 + Math.floor(Math.random() * 2);
  return paragraphs.slice(0, n).join('\n\n');
}

export const handlers = [
  http.post(`${API_BASE}/chat`, async () => {
    const ms = Number((import.meta as any).env.VITE_MOCK_LATENCY_MS ?? 600);
    await new Promise((r) => setTimeout(r, ms));
    return HttpResponse.json({ answer: mockAnswer() });
  }),
];

