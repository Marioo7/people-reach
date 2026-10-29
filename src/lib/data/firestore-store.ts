import { collection, deleteDoc, doc, getDocs, limit as qLimit, orderBy, query, setDoc, where, writeBatch } from "firebase/firestore";
import { getDb } from "../firebase/client";
import type { CollectionName, OwnedDoc } from "../types";
import type { Store } from "./store";

const CHUNK = 400; // Firestore batch limit is 500 operations

export const firestoreStore: Store = {
  async list<T extends OwnedDoc>(col: CollectionName, ownerId: string, opts?: { limit?: number; newestFirstBy?: string }) {
    const constraints = [where("ownerId", "==", ownerId)];
    const q = opts?.newestFirstBy
      ? query(collection(getDb(), col), ...constraints, orderBy(opts.newestFirstBy, "desc"), qLimit(opts.limit ?? 200))
      : query(collection(getDb(), col), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  },
  async put<T extends OwnedDoc>(col: CollectionName, d: T) {
    await setDoc(doc(getDb(), col, d.id), d);
  },
  async putMany<T extends OwnedDoc>(col: CollectionName, docs: T[]) {
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(getDb());
      docs.slice(i, i + CHUNK).forEach((d) => batch.set(doc(getDb(), col, d.id), d));
      await batch.commit();
    }
  },
  async remove(col: CollectionName, _ownerId: string, id: string) {
    await deleteDoc(doc(getDb(), col, id));
  },
  async removeMany(col: CollectionName, _ownerId: string, ids: string[]) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(getDb());
      ids.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(getDb(), col, id)));
      await batch.commit();
    }
  },
};
