// Backend/sessionStore.js

let lastLoginCpf = null;

function setLastLoginCpf(cpf) {
  if (!cpf) {
    lastLoginCpf = null;
    return;
  }
  // guarda só dígitos
  lastLoginCpf = String(cpf).replace(/[^\d]/g, "");
  console.log("💾 [sessionStore] setLastLoginCpf:", lastLoginCpf);
}

function getLastLoginCpf() {
  console.log("📥 [sessionStore] getLastLoginCpf:", lastLoginCpf);
  return lastLoginCpf;
}

module.exports = {
  setLastLoginCpf,
  getLastLoginCpf,
};
