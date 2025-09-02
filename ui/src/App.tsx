import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTypewriter } from './hooks/useTypewriter';
import { blip, sendClick, doneChime, errorBuzz, SfxToggle, sfxEnabledDefault, stopAllSfx } from './lib/sfx';
import { getSessionId } from './lib/session';

type Msg = { who: 'user' | 'bot' | 'system'; text: string };
const MARKER = '\uE000';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([
    { who: 'bot', text: 'Welcome, adventurer! Ask about your docs.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sfxOn, setSfxOn] = useState(sfxEnabledDefault());
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingIdxRef = useRef<number | null>(null);
  const [skipCtx, setSkipCtx] = useState<{ idx: number; full: string } | null>(null);
  const skippedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('sfxOn', String(sfxOn));
  }, [sfxOn]);

  const typewriter = useTypewriter({
    onChunk: () => sfxOn && blip(),
    onDone: () => sfxOn && doneChime(),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function ask(question: string): Promise<string> {
    const session_id = getSessionId();
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.toLowerCase().includes('application/json')) {
      const data = await res.json().catch(() => null as any);
      if (data && typeof data.output === 'string') return data.output;
      if (data && typeof data.answer === 'string') return data.answer;
      return JSON.stringify(data ?? {});
    }
    return await res.text();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    sfxOn && sendClick();
    // Append user message and a placeholder bot message to update in place
    setMessages((m) => {
      const base: Msg[] = [...m];
      base.push({ who: 'user', text: q } as Msg);
      base.push({ who: 'bot', text: MARKER } as Msg);
      typingIdxRef.current = base.length - 1; // index of placeholder bot
      return base;
    });
    setBusy(true);
    try {
      const full = await ask(q);
      skippedRef.current = false;
      // If long response (>20 words), show a Skip button to render instantly
      const words = full.trim().split(/\s+/).filter(Boolean);
      const idxForSkip = typingIdxRef.current;
      if (idxForSkip != null && words.length > 20) {
        setSkipCtx({ idx: idxForSkip, full });
      } else {
        setSkipCtx(null);
      }
      await typewriter.type(full, (partial) => {
        const idx = typingIdxRef.current;
        if (idx == null) return;
        setMessages((m) => {
          const copy = [...m];
          if (copy[idx]) copy[idx] = { who: 'bot', text: MARKER + partial };
          return copy;
        });
        // Best-effort immediate autoscroll while typing
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      setMessages((m) => {
        const copy = [...m];
        const idx = typingIdxRef.current;
        if (idx != null && copy[idx]?.who === 'bot') {
          copy[idx] = { who: 'bot', text: (copy[idx] as any).text.replace(MARKER, '') } as any;
        }
        return copy;
      });
      setSkipCtx(null);
      typingIdxRef.current = null;
    } catch (e: any) {
      sfxOn && errorBuzz();
      setMessages((m) => [...m, { who: 'system', text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function skipNow() {
    const ctx = skipCtx;
    if (!ctx) return;
    // Stop incremental typing and render full text immediately
    typewriter.stop();
    if (sfxOn) stopAllSfx();
    setMessages((m) => {
      const copy = [...m];
      if (copy[ctx.idx]) copy[ctx.idx] = { who: 'bot', text: ctx.full } as any;
      return copy;
    });
    skippedRef.current = true;
    typingIdxRef.current = null;
    setSkipCtx(null);
    setBusy(false);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only stick to bottom if user is near bottom already
    const threshold = 24; // px
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    if (!atBottom && !busy) return;
    // Defer to next frame so DOM has applied new heights
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, busy]);

  return (
    <div>
      <div className="bg-tiles" />
      <div className="frame">
        <header className="hud">
          <div className="logo">AI CHAT</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <SfxToggle enabled={sfxOn} onToggle={() => setSfxOn((v) => !v)} />
            <div className="window-icons">
              <span className="icon cam" aria-hidden="true"></span>
              <span className="icon close" aria-hidden="true"></span>
            </div>
          </div>
        </header>
        <main className="console">
          <div id="messages" className="messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <Row key={i} who={m.who} text={m.text} />
            ))}
          </div>
          <form id="chat-form" className="input-bar" onSubmit={onSubmit}>
            <input
              id="prompt"
              className="prompt"
              type="text"
              placeholder="Start typing…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy}>
              {busy ? '…' : 'SEND'}
            </button>
            {busy && skipCtx ? (
              <button
                className="btn"
                type="button"
                onClick={skipNow}
                aria-label="Fast forward typing"
                title="Fast forward"
              >
                ⏩
              </button>
            ) : null}
          </form>
          <div className="hint">Tip: The agent answers using your indexed PDFs.</div>
          <div className="statusbar">Status: <span>{busy ? 'Thinking…' : 'Idle'}</span></div>
        </main>
      </div>
    </div>
  );
}

function Row({ who, text }: { who: 'user' | 'bot' | 'system'; text: string }) {
  const marker = MARKER;
  if (who === 'system') {
    return (
      <div className="row bot">
        <div className="bubble bot pixel-border">{text}</div>
      </div>
    );
  }
  return (
    <div className={`row ${who}`}>
      {who === 'user' && <div className="avatar user" />}
      <div className={`bubble ${who} pixel-border`}>
        <span>{text.replace(marker, '')}</span>
        <div className="tail" />
      </div>
      {who === 'bot' && <div className="avatar bot" />}
    </div>
  );
}
