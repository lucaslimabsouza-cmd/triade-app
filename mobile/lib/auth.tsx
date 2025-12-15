// mobile/lib/auth.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type User = {
  id: string;
  name: string;
  email?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (data: { user: User; token: string }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Futuro: carregar token salvo (AsyncStorage)
  }, []);

  function setAuth(data: { user: User; token: string }) {
    setUser(data.user);
    setToken(data.token);
  }

  function logout() {
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
