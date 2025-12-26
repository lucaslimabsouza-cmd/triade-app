import axios from "axios";

const OMIE_BASE_URL = process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";
const OMIE_APP_KEY = process.env.OMIE_APP_KEY || "";
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET || "";

export async function callOmie(endpointPath: string, call: string, paramArray: any[]) {
  if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
    throw new Error("OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env");
  }

  const base = OMIE_BASE_URL.replace(/\/+$/, "");
  const path = endpointPath.replace(/^\/+/, "");
  const url = `${base}/${path}`;

  const body = {
    call,
    app_key: OMIE_APP_KEY,
    app_secret: OMIE_APP_SECRET,
    param: paramArray,
  };

  const { data } = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" },
  });

  return data;
}
