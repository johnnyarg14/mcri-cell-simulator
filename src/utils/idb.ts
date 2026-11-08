/** persistență minimală în IndexedDB pentru fișierele glTF importate (fără dependențe) */
const DB = 'mcri-cell-simulator';
const STORE = 'models';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(key: string, value: T): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function idbDelete(key: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function idbGetAll<T>(): Promise<{ key: string; value: T }[]> {
  const db = await open();
  const out = await new Promise<{ key: string; value: T }[]>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => res(keysReq.result.map((k, i) => ({ key: String(k), value: valsReq.result[i] as T })));
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return out;
}
