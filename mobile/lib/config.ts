// mobile/lib/config.ts

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_URL não está definida. Verifique o eas.json (production) ou o .env (dev)."
  );
}
