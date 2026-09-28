// Minimal IndexedDB stores (keyed by id): 'sessions' (one per morning session) and 'notes' (quick notes).
const DB_NAME = 'fogmeter';
const STORES = ['sessions', 'notes'];
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  }));
}

function table(store) {
  return {
    put: (row) => tx(store, 'readwrite', (s) => { s.put(row); }),
    get: (id) => tx(store, 'readonly', (s) => s.get(id)),
    all: () => tx(store, 'readonly', (s) => s.getAll()),
  };
}

export const db = table('sessions');
export const notesDb = table('notes');

export async function requestPersistence() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* ignore */ }
}
