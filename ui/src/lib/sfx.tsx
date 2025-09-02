import { Howl } from 'howler';
import { useMemo } from 'react';

// Simple oscillator-like bleeps encoded as small base64 wavs
// To keep the repo lean, we synthesize tiny tones.
const BEEP = new Howl({ src: [tone(880, 0.04)], volume: 0.25 });
const CLICK = new Howl({ src: [tone(220, 0.03)], volume: 0.25 });
const CHIME = new Howl({ src: [tone(660, 0.12)], volume: 0.25 });
const BUZZ = new Howl({ src: [tone(120, 0.2)], volume: 0.25 });

export const blip = () => BEEP.play();
export const sendClick = () => CLICK.play();
export const doneChime = () => CHIME.play();
export const errorBuzz = () => BUZZ.play();
export const stopAllSfx = () => {
  try { BEEP.stop(); } catch {}
  try { CLICK.stop(); } catch {}
  try { CHIME.stop(); } catch {}
  try { BUZZ.stop(); } catch {}
};

export function sfxEnabledDefault() {
  const saved = localStorage.getItem('sfxOn');
  return saved ? saved === 'true' : true;
}

export function SfxToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const label = enabled ? 'SFX: ON' : 'SFX: OFF';
  return (
    <button className="btn" onClick={onToggle} type="button" aria-pressed={enabled}>
      {label}
    </button>
  );
}

// Utility: create a short WAV data URL for a sine tone
function tone(freq: number, sec: number): string {
  const sampleRate = 8000;
  const len = Math.floor(sampleRate * sec);
  const data = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * freq * t) * (1 - i / len); // fade-out
    data[i] = Math.max(0, Math.min(255, Math.floor((val * 0.5 + 0.5) * 255)));
  }
  return pcm8ToWavDataUrl(data, sampleRate);
}

function pcm8ToWavDataUrl(pcm: Uint8Array, sampleRate: number): string {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 1; // 8-bit mono
  const blockAlign = numChannels * 1;
  const dataSize = pcm.length * 1;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let p = 0;
  writeStr('RIFF'); write32(36 + dataSize); writeStr('WAVE');
  writeStr('fmt '); write32(16); write16(1); write16(numChannels); write32(sampleRate); write32(byteRate); write16(blockAlign); write16(8);
  writeStr('data'); write32(dataSize);
  new Uint8Array(buffer, 44).set(pcm);
  function write16(v: number){ view.setUint16(p, v, true); p+=2; }
  function write32(v: number){ view.setUint32(p, v, true); p+=4; }
  function writeStr(s: string){ for(let i=0;i<s.length;i++) view.setUint8(p++, s.charCodeAt(i)); }
  const bytes = new Uint8Array(buffer);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `data:audio/wav;base64,${b64}`;
}
