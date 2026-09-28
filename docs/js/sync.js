// Backup of sessions to a private GitHub repo via the contents API.
import { getConfig } from './config.js';
import { db } from './db.js';

const API = 'https://api.github.com';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function putFile(cfg, path, content, message) {
  const url = `${API}/repos/${cfg.repo}/contents/${path}`;
  let sha;
  const head = await fetch(url, { headers: headers(cfg.token), cache: 'no-store' });
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) throw new Error(`GitHub ${head.status}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(cfg.token),
    body: JSON.stringify({ message, content: b64encode(content), ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Uploads all sessions not yet synced. Returns {status:'off'|'ok'|'error', count, error}. */
export async function syncPending() {
  const cfg = getConfig();
  if (!cfg.token || !cfg.repo) return { status: 'off', count: 0 };
  const pending = (await db.all()).filter((s) => !s.synced);
  let count = 0;
  try {
    for (const s of pending) {
      const copy = { ...s };
      delete copy.synced;
      await putFile(cfg, `sessions/${s.date.slice(0, 7)}/${s.id}.json`, JSON.stringify(copy, null, 1), `session ${s.id}`);
      await db.put({ ...s, synced: true });
      count++;
    }
    return { status: 'ok', count };
  } catch (e) {
    return { status: 'error', count, error: String(e.message || e) };
  }
}

export async function testConnection() {
  const cfg = getConfig();
  const res = await fetch(`${API}/repos/${cfg.repo}`, { headers: headers(cfg.token), cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const repo = await res.json();
  if (!repo.private) throw new Error('Deze repo is openbaar. Gebruik een privé-repo voor je data.');
  if (!repo.permissions?.push) throw new Error('Token heeft geen schrijfrechten.');
  return repo.full_name;
}

/** Downloads every session from the repo into the local database (e.g. after Safari cleared storage). */
export async function restoreAll() {
  const cfg = getConfig();
  const tree = await fetch(`${API}/repos/${cfg.repo}/git/trees/HEAD?recursive=1`, { headers: headers(cfg.token), cache: 'no-store' });
  if (!tree.ok) throw new Error(`GitHub ${tree.status}`);
  const files = (await tree.json()).tree.filter((f) => f.type === 'blob' && /^sessions\/.*\.json$/.test(f.path));
  const have = new Set((await db.all()).map((s) => s.id));
  let n = 0;
  for (const f of files) {
    const id = f.path.split('/').pop().replace('.json', '');
    if (have.has(id)) continue;
    const res = await fetch(`${API}/repos/${cfg.repo}/git/blobs/${f.sha}`, { headers: headers(cfg.token) });
    if (!res.ok) continue;
    const s = JSON.parse(b64decode((await res.json()).content));
    await db.put({ ...s, synced: true });
    n++;
  }
  return n;
}
