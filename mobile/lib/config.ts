// mobile/lib/config.ts

// Base URL da API (vem do .env no dev e do eas.json no production)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  // Isso ajuda a não “falhar silencioso” no TestFlight
  throw new Error(
    "EXPO_PUBLIC_API_URL não está definido. Verifique o .env (dev) ou eas.json (production)."
  );
}
