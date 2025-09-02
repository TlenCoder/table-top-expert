import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5678/webhook';
const useMocks = process.env.VITE_USE_MOCKS === 'true';

function devMockPlugin(enabled: boolean): Plugin {
  return {
    name: 'dev-mock-api',
    configureServer(server) {
      if (!enabled) return;
      const collectBody = async (req: any) => new Promise<string>((resolve) => {
        const chunks: Uint8Array[] = [];
        req.on('data', (c: Uint8Array) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const raw = await collectBody(req);
          let session = '';
          try { session = JSON.parse(raw).session_id || ''; } catch {}
          const paras = [
            'Retrieval‑augmented generation blends information retrieval with text generation. By retrieving relevant passages from your private corpus and grounding the model on that context, you reduce hallucinations and make answers traceable to sources.',
            'A practical pipeline starts with chunking documents into overlapping segments, embedding those chunks, and storing vectors in a similarity search index. At query time, you embed the question, search for top‑k neighbors, and compose a prompt that cites the retrieved evidence.',
            'Quality hinges on sensible chunk sizes, overlap, and a clean prompt that instructs the model to use only the provided context. Adding metadata like file path and page ranges enables richer citations and easier maintenance of the index.'
          ];
          const n = 2 + Math.floor(Math.random() * 2);
          const answer = paras.slice(0, n).join('\n\n') + (session ? `\n\n(session ${session.slice(0,8)}…)` : '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ output: answer }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Mock failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devMockPlugin(useMocks)],
  server: {
    port: 5173,
    proxy: useMocks
      ? undefined
      : {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
