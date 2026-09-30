import {
  validSnapshot,
  MAX_NOTES,
  type BoardConfig,
  type ReviewNote,
} from "../shared/model";

const DB = "dsh-visual-edit-v1";
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const notes = db.createObjectStore("notes", {
        keyPath: ["sessionId", "id"],
      });
      notes.createIndex("session", "sessionId");
      db.createObjectStore("boards", { keyPath: "sessionId" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      opening = undefined;
      reject(new Error("storageUnavailable"));
    };
  });
  return opening;
}
export async function readBoard(
  sessionId: string,
): Promise<{ config?: BoardConfig; notes: ReviewNote[] }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["notes", "boards"], "readonly");
    const notes = tx.objectStore("notes").index("session").getAll(sessionId);
    const config = tx.objectStore("boards").get(sessionId);
    tx.oncomplete = () =>
      resolve({
        config: config.result,
        notes: (notes.result as ReviewNote[])
          .filter(
            (n) =>
              validSnapshot(n.before) && (!n.after || validSnapshot(n.after)),
          )
          .sort(
            (a, b) =>
              a.before.capturedAt.localeCompare(b.before.capturedAt) ||
              a.id.localeCompare(b.id),
          ),
      });
    tx.onerror = () => reject(new Error("storageUnavailable"));
  });
}
export async function saveConfig(config: BoardConfig): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("boards", "readwrite");
    tx.objectStore("boards").put(config);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("storageUnavailable"));
  });
}
export async function putNote(
  note: ReviewNote,
  expectedRevision: number | null,
): Promise<ReviewNote> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notes", "readwrite");
    const store = tx.objectStore("notes");
    let reason = "storageUnavailable";
    const saved = {
      ...note,
      revision: (expectedRevision ?? -1) + 1,
      updatedAt: new Date().toISOString(),
    };
    const current = store.get([note.sessionId, note.id]);
    current.onsuccess = () => {
      if (
        (expectedRevision === null && current.result) ||
        (expectedRevision !== null &&
          current.result?.revision !== expectedRevision)
      ) {
        reason = "storageConflict";
        tx.abort();
        return;
      }
      if (expectedRevision !== null) {
        store.put(saved);
        return;
      }
      const count = store.index("session").count(note.sessionId);
      count.onsuccess = () => {
        if (count.result >= MAX_NOTES) {
          reason = "noteLimit";
          tx.abort();
        } else store.put(saved);
      };
    };
    tx.oncomplete = () => resolve(saved);
    tx.onabort = tx.onerror = () => reject(new Error(reason));
  });
}
export async function deleteNote(note: ReviewNote): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notes", "readwrite");
    const store = tx.objectStore("notes");
    let reason = "storageUnavailable";
    const current = store.get([note.sessionId, note.id]);
    current.onsuccess = () => {
      if (current.result?.revision !== note.revision) {
        reason = "storageConflict";
        tx.abort();
      } else store.delete([note.sessionId, note.id]);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error(reason));
  });
}
