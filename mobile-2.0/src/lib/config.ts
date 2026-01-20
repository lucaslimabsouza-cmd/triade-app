// src/lib/config.ts
// Centraliza a URL do backend para o app todo.
// Produção/TestFlight: Render (fallback seguro)
// Dev: pode sobrescrever via EXPO_PUBLIC_API_BASE_URL

const FALLBACK_PROD = "https://triade-backend.onrender.com";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  FALLBACK_PROD;
