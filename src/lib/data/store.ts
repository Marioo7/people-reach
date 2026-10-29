import type { CollectionName, OwnedDoc } from "../types";

/** Persistence abstraction. Firestore in production, localStorage in clearly-labelled demo mode. */
export interface Store {
  list<T extends OwnedDoc>(col: CollectionName, ownerId: string, opts?: { limit?: number; newestFirstBy?: string }): Promise<T[]>;
  put<T extends OwnedDoc>(col: CollectionName, doc: T): Promise<void>;
  putMany<T extends OwnedDoc>(col: CollectionName, docs: T[]): Promise<void>;
  remove(col: CollectionName, ownerId: string, id: string): Promise<void>;
  removeMany(col: CollectionName, ownerId: string, ids: string[]): Promise<void>;
}
