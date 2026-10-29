import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/** Runs only when the Firestore emulator is up: `firebase emulators:exec --only firestore "npm run test:rules"`. */
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const T = "2025-01-01T00:00:00.000Z";

const contact = (id: string, ownerId: string, over: Record<string, unknown> = {}) => ({
  id, ownerId, firstName: "Sara", lastName: "A", fullName: "Sara A", jobTitle: "Recruiter", company: "Acme", location: "", linkedInProfileUrl: "", email: "", notes: "",
  classificationStatus: "potential", reviewStatus: "unreviewed", outreachStatus: "not_contacted", matchedKeywords: ["Recruiter"], source: { type: "manual", importedAt: T },
  isDemo: false, lastContactedAt: null, lastRepliedAt: null, ...over,
});
const message = (id: string, ownerId: string, over: Record<string, unknown> = {}) => ({
  id, ownerId, contactId: "c1", renderedMessage: "Dear Sara", status: "draft", sendingMethod: "linkedin_manual", sentAt: null, responseRecordedAt: null, errorMessage: null, confirmationMethod: null, ...over,
});

describe.skipIf(!EMULATOR)("firestore rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    const [host, port] = (EMULATOR as string).split(":");
    env = await initializeTestEnvironment({ projectId: "demo-outreach", firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) } });
  });
  afterAll(async () => env?.cleanup());

  it("rejects unauthenticated access", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "contacts/c1")));
  });
  it("lets users create and read only their own contacts", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "contacts/c1"), contact("c1", "alice")));
    await assertSucceeds(getDoc(doc(alice, "contacts/c1")));
    await assertFails(getDoc(doc(bob, "contacts/c1")));
    await assertFails(setDoc(doc(bob, "contacts/c2"), contact("c2", "alice")));
    await assertFails(updateDoc(doc(bob, "contacts/c1"), { notes: "x" }));
    await assertFails(deleteDoc(doc(bob, "contacts/c1")));
  });
  it("blocks ownerId changes and invalid enums", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(alice, "contacts/c1"), { ownerId: "bob" }));
    await assertFails(updateDoc(doc(alice, "contacts/c1"), { classificationStatus: "hacker" }));
  });
  it("requires a confirmation record for sent messages and freezes them", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "outreachMessages/m1"), message("m1", "alice")));
    await assertFails(updateDoc(doc(alice, "outreachMessages/m1"), { status: "sent", sentAt: T }));
    await assertSucceeds(updateDoc(doc(alice, "outreachMessages/m1"), { status: "sent", sentAt: T, confirmationMethod: "manual_user_confirmation" }));
    await assertFails(updateDoc(doc(alice, "outreachMessages/m1"), { renderedMessage: "edited after send" }));
    await assertFails(deleteDoc(doc(alice, "outreachMessages/m1")));
  });
  it("allows the owner's own list queries (exactly what the app runs on load)", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "userSettings/alice"), { id: "alice", ownerId: "alice", keywords: [], senderName: "A" }));
    for (const col of ["userSettings", "contacts", "messageTemplates", "outreachMessages", "outreachCampaigns", "cvDocuments", "cvChunks", "activityLogs"]) {
      await assertSucceeds(getDocs(query(collection(alice, col), where("ownerId", "==", "alice"))));
      await assertFails(getDocs(query(collection(bob, col), where("ownerId", "==", "alice"))));
    }
    await assertFails(getDocs(collection(alice, "contacts"))); // unfiltered list must be denied
    await assertFails(setDoc(doc(bob, "userSettings/alice"), { id: "alice", ownerId: "bob", keywords: [], senderName: "B" }));
  });
  it("stores CVs privately per owner and keeps the audit log append-only", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "cvChunks/cv1_0"), { id: "cv1_0", ownerId: "alice", cvId: "cv1", index: 0, count: 1, data: "QUJD" }));
    await assertSucceeds(setDoc(doc(alice, "cvDocuments/cv1"), { id: "cv1", ownerId: "alice", fileName: "cv.pdf", sizeBytes: 3, chunkCount: 1, createdAt: T, updatedAt: T }));
    await assertFails(getDoc(doc(bob, "cvChunks/cv1_0")));
    await assertFails(getDocs(query(collection(bob, "cvChunks"), where("ownerId", "==", "alice"))));
    await assertFails(setDoc(doc(bob, "cvChunks/x_0"), { id: "x_0", ownerId: "alice", cvId: "x", index: 0, count: 1, data: "QQ" }));
    await assertFails(setDoc(doc(alice, "cvDocuments/big"), { id: "big", ownerId: "alice", fileName: "cv.pdf", sizeBytes: 99999999, chunkCount: 1 }));
    await assertFails(deleteDoc(doc(bob, "cvDocuments/cv1")));
    await assertSucceeds(deleteDoc(doc(alice, "cvChunks/cv1_0")));
    await assertSucceeds(setDoc(doc(alice, "activityLogs/l1"), { id: "l1", ownerId: "alice", action: "x", details: "" }));
    await assertFails(updateDoc(doc(alice, "activityLogs/l1"), { action: "y" }));
    await assertFails(deleteDoc(doc(alice, "activityLogs/l1")));
  });
});
