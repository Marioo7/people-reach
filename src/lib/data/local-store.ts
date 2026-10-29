import type { CollectionName, OwnedDoc } from "../types";
import type { Store } from "./store";

const key = (ownerId: string, col: CollectionName) => `lho:${ownerId}:${col}`;

function read<T>(ownerId: string, col: CollectionName): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key(ownerId, col)) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(ownerId: string, col: CollectionName, docs: T[]) {
  try {
    window.localStorage.setItem(key(ownerId, col), JSON.stringify(docs));
  } catch {
    throw new Error("Browser storage is full. Demo mode stores data locally; delete some data or connect Firebase.");
  }
}

export const localStore: Store = {
  async list<T extends OwnedDoc>(col: CollectionName, ownerId: string, opts?: { limit?: number; newestFirstBy?: string }) {
    let docs = read<T>(ownerId, col).filter((d) => d.ownerId === ownerId);
    if (opts?.newestFirstBy) {
      const f = opts.newestFirstBy;
      docs = docs.sort((a, b) => String((b as Record<string, unknown>)[f] ?? "").localeCompare(String((a as Record<string, unknown>)[f] ?? "")));
    }
    return opts?.limit ? docs.slice(0, opts.limit) : docs;
  },
  async put<T extends OwnedDoc>(col: CollectionName, doc: T) {
    const docs = read<T>(doc.ownerId, col).filter((d) => d.id !== doc.id);
    write(doc.ownerId, col, [...docs, doc]);
  },
  async putMany<T extends OwnedDoc>(col: CollectionName, items: T[]) {
    const first = items[0];
    if (!first) return;
    const map = new Map(read<T>(first.ownerId, col).map((d) => [d.id, d]));
    items.forEach((d) => map.set(d.id, d));
    write(first.ownerId, col, [...map.values()]);
  },
  async remove(col: CollectionName, ownerId: string, id: string) {
    write(ownerId, col, read<OwnedDoc>(ownerId, col).filter((d) => d.id !== id));
  },
  async removeMany(col: CollectionName, ownerId: string, ids: string[]) {
    const set = new Set(ids);
    write(ownerId, col, read<OwnedDoc>(ownerId, col).filter((d) => !set.has(d.id)));
  },
};
