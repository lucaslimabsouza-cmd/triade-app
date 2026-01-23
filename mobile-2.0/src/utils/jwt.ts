// src/utils/jwt.ts
// ✅ Utilitário para decodificar JWT (sem biblioteca externa)

export function decodeJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decodificar payload (parte 2)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isAdminFromToken(token: string | null): boolean {
  if (!token) return false;
  const decoded = decodeJWT(token);
  return decoded?.is_admin === true;
}
