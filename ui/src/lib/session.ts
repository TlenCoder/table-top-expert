export function getSessionId(): string {
  const key = 'sessionId';
  let id = localStorage.getItem(key);
  if (!id) {
    id = (crypto && 'randomUUID' in crypto ? crypto.randomUUID() : gen()) + '-' + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

function gen(): string {
  const arr = new Uint8Array(16);
  (crypto || window).getRandomValues?.(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
}

