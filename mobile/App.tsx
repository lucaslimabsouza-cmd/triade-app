// mobile/lib/api.ts
import { DashboardData } from "./models";
import { dashboardMockData } from "./mockData";
import { API_BASE_URL } from "./config";

// Função que busca dados reais do backend
export async function getDashboardData(token: string): Promise<DashboardData> {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`, // depende do seu backend
      },
    });

    if (!res.ok) {
      throw new Error("Erro ao buscar dashboard");
    }

    const data = (await res.json()) as DashboardData;

    return data;
  } catch (error) {
    console.log("API OFFLINE → usando mock:", error);
    // Enquanto o backend não está pronto, retornamos o mock
    return dashboardMockData;
  }
}
