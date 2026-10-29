import type { OwnedDoc } from "./types";

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Throws unless the document belongs to the given user. Defence-in-depth next to Firestore rules. */
export function assertOwner<T extends OwnedDoc>(doc: T | null | undefined, uid: string | null | undefined): T {
  if (!uid) throw new AuthorizationError("Authentication required.");
  if (!doc) throw new AuthorizationError("Resource not found.");
  if (doc.ownerId !== uid) throw new AuthorizationError();
  return doc;
}

export function filterOwned<T extends OwnedDoc>(docs: T[], uid: string | null | undefined): T[] {
  if (!uid) return [];
  return docs.filter((d) => d.ownerId === uid);
}
