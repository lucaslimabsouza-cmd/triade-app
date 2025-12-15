// mobile/app/lib/omie.ts
import { api } from "./api";

export async function getOmieClients() {
  const response = await api.get("/omie/clients");
  return response.data;
}
