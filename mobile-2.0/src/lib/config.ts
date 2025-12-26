// src/lib/config.ts
// Centraliza a URL do backend para o app todo.
// Se você usar EAS/Expo env, pode injetar EXPO_PUBLIC_API_BASE_URL.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://192.168.1.126:4001"; // ✅ ajuste para seu IP quando rodar no celular
