// mobile/lib/session.ts

// Armazena em memória o CPF/CNPJ do último login.
// Simples, sem AsyncStorage, só enquanto o app está aberto.

let lastLoginCpf: string | null = null;

export function setLastLoginCpf(cpf: string) {
  if (!cpf) {
    lastLoginCpf = null;
    return;
  }
  // guarda só dígitos
  lastLoginCpf = cpf.replace(/[^\d]/g, "");
  console.log("💾 setLastLoginCpf:", lastLoginCpf);
}

export function getLastLoginCpf(): string | null {
  console.log("📥 getLastLoginCpf:", lastLoginCpf);
  return lastLoginCpf;
}
