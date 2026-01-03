import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type RefreshFn = () => Promise<void> | void;

type RefreshRegistryContextType = {
  register: (fn: RefreshFn | null) => void;
  refreshNow: () => Promise<void>;
  refreshing: boolean;
  hasRefresh: boolean;
};

const RefreshRegistryContext =
  createContext<RefreshRegistryContextType | null>(null);

export function RefreshRegistryProvider({ children }: { children: React.ReactNode }) {
  const fnRef = useRef<RefreshFn | null>(null);

  // ✅ precisa ser state pra re-renderizar o Screen quando registra/desregistra
  const [hasRefresh, setHasRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const register = useCallback((fn: RefreshFn | null) => {
    fnRef.current = fn;
    setHasRefresh(!!fn); // ✅ isso é o que faz aparecer o pull-to-refresh
  }, []);

  const refreshNow = useCallback(async () => {
    const fn = fnRef.current;
    if (!fn) return;
    if (refreshing) return;

    setRefreshing(true);
    try {
      await fn();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const value = useMemo(
    () => ({ register, refreshNow, refreshing, hasRefresh }),
    [register, refreshNow, refreshing, hasRefresh]
  );

  return (
    <RefreshRegistryContext.Provider value={value}>
      {children}
    </RefreshRegistryContext.Provider>
  );
}

export function useRefreshRegistry() {
  const ctx = useContext(RefreshRegistryContext);
  if (!ctx) {
    throw new Error("useRefreshRegistry must be used inside RefreshRegistryProvider");
  }
  return ctx;
}
