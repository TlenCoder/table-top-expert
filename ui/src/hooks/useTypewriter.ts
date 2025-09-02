type Opts = {
  onChunk?: (chunk: string) => void;
  onDone?: () => void;
};

const MIN = Number(import.meta.env.VITE_TYPE_MIN ?? 3);
const MAX = Number(import.meta.env.VITE_TYPE_MAX ?? 6);
const INTERVAL = Number(import.meta.env.VITE_TYPE_INTERVAL_MS ?? 50);

export function useTypewriter(opts: Opts = {}) {
  let cancel = false;

  async function type(text: string, onUpdate: (partial: string) => void) {
    cancel = false;
    let out = '';
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
    for (let i = 0; i < text.length && !cancel; ) {
      const n = Math.min(rand(MIN, MAX), text.length - i);
      out += text.slice(i, i + n);
      i += n;
      onUpdate(out);
      opts.onChunk?.(text.slice(i - n, i));
      let delay = INTERVAL;
      const last = out[out.length - 1];
      if (/[\.!?]/.test(last)) delay *= 6;
      else if (/[,:;]/.test(last)) delay *= 3;
      await sleep(delay);
    }
    if (!cancel) opts.onDone?.();
  }

  function stop() {
    cancel = true;
  }

  return { type, stop };
}

