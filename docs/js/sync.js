// Backup of sessions and quick notes to a private GitHub repo via the contents API.
import { getConfig } from './config.js';
import { db, notesDb } from './db.js';

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

const KINDS = [
  { store: db, dir: 'sessions', label: 'session' },
  { store: notesDb, dir: 'notes', label: 'note' },
];

/** Uploads all sessions and notes not yet synced. Returns {status:'off'|'ok'|'error', count, error}. */
export async function syncPending() {
  const cfg = getConfig();
  if (!cfg.token || !cfg.repo) return { status: 'off', count: 0 };
  let count = 0;
  try {
    for (const { store, dir, label } of KINDS) {
      for (const row of (await store.all()).filter((x) => !x.synced)) {
        const copy = { ...row };
        delete copy.synced;
        await putFile(cfg, `${dir}/${row.date.slice(0, 7)}/${row.id}.json`, JSON.stringify(copy, null, 1), `${label} ${row.id}`);
        await store.put({ ...row, synced: true });
        count++;
      }
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

/** Downloads every session and note from the repo into the local database (e.g. after Safari cleared storage). */
export async function restoreAll() {
  const cfg = getConfig();
  const tree = await fetch(`${API}/repos/${cfg.repo}/git/trees/HEAD?recursive=1`, { headers: headers(cfg.token), cache: 'no-store' });
  if (!tree.ok) throw new Error(`GitHub ${tree.status}`);
  const files = (await tree.json()).tree.filter((f) => f.type === 'blob');
  let n = 0;
  for (const { store, dir } of KINDS) {
    const have = new Set((await store.all()).map((x) => x.id));
    for (const f of files.filter((x) => x.path.startsWith(`${dir}/`) && x.path.endsWith('.json'))) {
      const id = f.path.split('/').pop().replace('.json', '');
      if (have.has(id)) continue;
      const res = await fetch(`${API}/repos/${cfg.repo}/git/blobs/${f.sha}`, { headers: headers(cfg.token) });
      if (!res.ok) continue;
      await store.put({ ...JSON.parse(b64decode((await res.json()).content)), synced: true });
      if (dir === 'sessions') n++;
    }
  }
  return n;
}
