// mobile/lib/api.ts
import type { DashboardData } from "./models";
import { dashboardMockData } from "./mockData";
import { API_BASE_URL } from "./config";

// tipo esperado de resposta do login
export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email?: string;
  };
};

// 🔹 FUNÇÃO DE LOGIN
export async function loginUser(
  cpf: string,
  password: string
): Promise<LoginResponse> {
  console.log("➡️ Chamando /login em:", `${API_BASE_URL}/login`);

  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cpf, password }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    console.log("❌ Erro no login");
    console.log("Status:", res.status);
    console.log("Body:", bodyText);

    throw new Error("CPF ou senha inválidos");
  }

  const data = (await res.json()) as LoginResponse;
  console.log("✅ Login OK, usuário:", data.user?.name);
  return data;
}

// 🔹 DASHBOARD (API + logs e fallback no mock por enquanto)
export async function getDashboardData(token: string): Promise<DashboardData> {
  console.log("➡️ Chamando /dashboard em:", `${API_BASE_URL}/dashboard`);

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.log("❌ Erro ao buscar dashboard");
      console.log("Status:", res.status);
      console.log("Body:", bodyText);

      // aqui você escolhe: por enquanto, vamos logar e cair no mock
      // se quiser quebrar tudo, pode trocar por: throw new Error(...)
      console.log("⚠️ Usando dashboardMockData por fallback");
      return dashboardMockData;
    }

    const data = (await res.json()) as DashboardData;
    console.log("✅ Dashboard carregado da API");
    return data;
  } catch (error: any) {
    console.log("💥 Falha ao chamar API de dashboard (erro de rede ou fetch):");
    console.log("Mensagem:", error?.message ?? error);

    // fallback para o mock, pra não matar a Home
    console.log("⚠️ Usando dashboardMockData por fallback (erro no try/catch)");
    return dashboardMockData;
  }
}
