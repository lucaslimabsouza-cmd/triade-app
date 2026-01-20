import axios from "axios";
import { API_BASE_URL } from "../lib/config";
import { tokenStorage } from "../storage/tokenStorage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

console.log("🌐 [API] API_BASE_URL =", API_BASE_URL);

api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.get();

    config.headers = config.headers ?? {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete (config.headers as any).Authorization;
    }

    console.log(
      `➡️ [API] ${String(config.method).toUpperCase()} ${config.baseURL}${config.url}`
    );

    return config;
  },
  (error) => {
    console.log("❌ [API] request error:", error?.message || error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.log("❌ [API] response error status:", error?.response?.status);
    console.log("❌ [API] response error data:", error?.response?.data);
    console.log("❌ [API] response error message:", error?.message);
    return Promise.reject(error);
  }
);

export default api;
