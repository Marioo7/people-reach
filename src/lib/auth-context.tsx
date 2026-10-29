"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { getFirebaseAuth, isDemoMode } from "./firebase/client";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  demo: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
  getIdToken(): Promise<string | null>;
}

const DEMO_USER: AppUser = { uid: "demo-user", email: "demo@local", displayName: "Demo user" };
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = isDemoMode();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demo) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null);
      setLoading(false);
    });
  }, [demo]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);
  const signInGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);
  const signOut = useCallback(async () => {
    if (!demo) await fbSignOut(getFirebaseAuth());
  }, [demo]);
  const getIdToken = useCallback(async () => {
    if (demo) return null;
    return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
  }, [demo]);

  const value = useMemo(() => ({ user, loading, demo, signIn, signUp, signInGoogle, signOut, getIdToken }), [user, loading, demo, signIn, signUp, signInGoogle, signOut, getIdToken]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
