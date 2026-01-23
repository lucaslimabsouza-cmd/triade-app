import { api } from "./api";

type LoginResponse = {
  ok: boolean;
  token?: string;
  must_change_password?: boolean;
  is_admin?: boolean; // ✅ NOVO: indica se é admin
  party?: any;
  error?: string;
};

export const authService = {
  async login(cpf: string, password: string): Promise<LoginResponse> {
    try {
      const res = await api.post("/auth/login", { cpf, password });
      return res.data as LoginResponse;
    } catch (err: any) {
      // ✅ Loga a causa real
      const status = err?.response?.status;
      const data = err?.response?.data;
      const message = err?.message;

      console.log("❌ [authService.login] status:", status);
      console.log("❌ [authService.login] data:", data);
      console.log("❌ [authService.login] message:", message);

      if (data?.error) {
        return { ok: false, error: data.error };
      }

      return { ok: false, error: "Erro ao conectar no servidor." };
    }

    
  },
  async changePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.post("/auth/change-password", {
      oldPassword,
      newPassword,
    });

    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = err?.message;

    console.log("❌ [authService.changePassword] status:", status);
    console.log("❌ [authService.changePassword] data:", data);
    console.log("❌ [authService.changePassword] message:", message);

    if (data?.error) return { ok: false, error: data.error };
    return { ok: false, error: "Erro ao trocar senha." };
  }
},
  

};
