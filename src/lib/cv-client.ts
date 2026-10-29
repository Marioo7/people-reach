import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { CV_CHUNK_CHARS, base64ToBytes, bytesToBase64, hasPdfSignature, sanitizeFileName, splitChunks, validateCvMeta, type CvValidationError } from "./cv";
import { getDb } from "./firebase/client";
import { getStore } from "./data/get-store";
import type { CvDocument } from "./types";
import { newId, nowIso } from "./utils";

/*
 * Where the CV lives
 *  - Firebase mode: base64 chunks in the private `cvChunks` collection (owner-only Firestore rules).
 *    No Storage bucket, no server, no public URL — works on the free Spark plan and static hosting.
 *  - Demo mode: IndexedDB in this browser only.
 */

const DB = "lho-demo-files";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("cv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("cv", mode).objectStore("cv"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class CvError extends Error {
  constructor(public codes: CvValidationError[] | string[], message: string) {
    super(message);
  }
}

export async function validateCvFile(file: File): Promise<CvValidationError[]> {
  const errors = validateCvMeta({ name: file.name, type: file.type, size: file.size });
  if (!errors.length) {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!hasPdfSignature(head)) errors.push("bad_signature");
  }
  return errors;
}

async function deleteRemote(ownerId: string, cvId: string): Promise<void> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, "cvChunks"), where("ownerId", "==", ownerId), where("cvId", "==", cvId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "cvDocuments", cvId));
  await batch.commit();
}

export async function uploadCvFile(opts: { demo: boolean; ownerId: string; file: File; previous?: CvDocument | null }): Promise<CvDocument> {
  const errors = await validateCvFile(opts.file);
  if (errors.length) throw new CvError(errors, "invalid_cv");
  const now = nowIso();
  const id = newId("cv");
  const base = { id, ownerId: opts.ownerId, fileName: sanitizeFileName(opts.file.name), sizeBytes: opts.file.size, createdAt: now, updatedAt: now };

  if (opts.demo) {
    await idb("readwrite", (s) => s.put(opts.file, id));
    if (opts.previous) await idb("readwrite", (s) => s.delete(opts.previous!.id));
    const docu: CvDocument = { ...base, chunkCount: 1 };
    await getStore().put("cvDocuments", docu);
    if (opts.previous) await getStore().remove("cvDocuments", opts.ownerId, opts.previous.id);
    return docu;
  }

  const bytes = new Uint8Array(await opts.file.arrayBuffer());
  const parts = splitChunks(bytesToBase64(bytes), CV_CHUNK_CHARS);
  const docu: CvDocument = { ...base, chunkCount: parts.length };
  try {
    const db = getDb();
    const batch = writeBatch(db);
    parts.forEach((data, index) => {
      const chunkId = `${id}_${index}`;
      batch.set(doc(db, "cvChunks", chunkId), { id: chunkId, ownerId: opts.ownerId, cvId: id, index, count: parts.length, data });
    });
    batch.set(doc(db, "cvDocuments", id), docu);
    await batch.commit();
  } catch {
    throw new CvError(["upload_failed"], "upload_failed");
  }
  if (opts.previous) await deleteRemote(opts.ownerId, opts.previous.id).catch(() => undefined);
  return docu;
}

export async function deleteCv(opts: { demo: boolean; ownerId: string; cv: CvDocument }): Promise<void> {
  if (opts.demo) {
    await idb("readwrite", (s) => s.delete(opts.cv.id));
    await getStore().remove("cvDocuments", opts.ownerId, opts.cv.id);
    return;
  }
  try {
    await deleteRemote(opts.ownerId, opts.cv.id);
  } catch {
    // legacy record without chunks: remove the metadata only
    await deleteDoc(doc(getDb(), "cvDocuments", opts.cv.id)).catch(() => undefined);
  }
}

/** Reassemble the PDF in the browser and hand it to the user as a download. No public URL exists. */
export async function downloadCv(opts: { demo: boolean; ownerId: string; cv: CvDocument }): Promise<void> {
  let blob: Blob;
  if (opts.demo) {
    const stored = await idb<Blob | undefined>("readonly", (s) => s.get(opts.cv.id));
    if (!stored) throw new CvError(["not_found"], "not_found");
    blob = stored;
  } else {
    if (!opts.cv.chunkCount) throw new CvError(["legacy_cv"], "legacy_cv");
    const snap = await getDocs(query(collection(getDb(), "cvChunks"), where("ownerId", "==", opts.ownerId), where("cvId", "==", opts.cv.id)));
    const chunks = snap.docs.map((d) => d.data() as { index: number; data: string }).sort((a, b) => a.index - b.index);
    if (chunks.length !== opts.cv.chunkCount) throw new CvError(["download_failed"], "download_failed");
    const bytes = base64ToBytes(chunks.map((c) => c.data).join(""));
    blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.cv.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
