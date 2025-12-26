// mobile/hooks/useAuth.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as LocalAuthentication from "expo-local-authentication";
import {
  getLastCpf,
  setLastCpf,
  clearLastCpf,
  isBiometryEnabled,
} from "../lib/authStorage";

type AuthState = {
  cpf: string | null;
  loading: boolean;
  signInWithCpf: (cpf: string) => Promise<void>;
  signOutCpf: () => Promise<void>;
  unlockIfNeeded: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const [cpf, setCpfState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const savedCpf = await getLastCpf();
        if (!alive) return;
        setCpfState(savedCpf ?? null);
      } catch {
        if (!alive) return;
        setCpfState(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function signInWithCpf(newCpf: string) {
    await setLastCpf(newCpf);
    setCpfState(newCpf);
  }

  async function signOutCpf() {
    await clearLastCpf();
    setCpfState(null);
  }

  async function unlockIfNeeded() {
    try {
      const enabled = await isBiometryEnabled();
      if (!enabled) return true;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return true;

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear com Face ID",
        fallbackLabel: "Usar senha",
      });

      return !!res.success;
    } catch {
      return false;
    }
  }

  const value = useMemo(
    () => ({
      cpf,
      loading,
      signInWithCpf,
      signOutCpf,
      unlockIfNeeded,
    }),
    [cpf, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
