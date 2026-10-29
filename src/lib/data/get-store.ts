import { isDemoMode } from "../firebase/client";
import { firestoreStore } from "./firestore-store";
import { localStore } from "./local-store";
import type { Store } from "./store";

export const getStore = (): Store => (isDemoMode() ? localStore : firestoreStore);
