import axios from "axios";

const baseURL = process.env.OMIE_BASE_URL;
const appKey = process.env.OMIE_APP_KEY;
const appSecret = process.env.OMIE_APP_SECRET;

if (!baseURL || !appKey || !appSecret) {
  throw new Error("Faltou OMIE_BASE_URL / OMIE_APP_KEY / OMIE_APP_SECRET no .env");
}

export async function omiePost<T = any>(endpoint: string, body: any): Promise<T> {
  const url = `${baseURL}${endpoint}`;
  const payload = {
    app_key: appKey,
    app_secret: appSecret,
    ...body
  };

  const { data } = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" }
  });

  return data as T;
}
