import axios from "axios";
import { API_BASE_URL } from "../lib/config";
import { tokenStorage } from "../storage/tokenStorage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log("➡️ [API]", config.method?.toUpperCase(), (config.baseURL ?? "") + (config.url ?? ""));
  return config;
});
