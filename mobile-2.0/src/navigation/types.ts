// src/navigation/types.ts

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  // ===== EXISTENTES (NÃO ALTERADOS) =====
  Login: undefined;
  ChangePassword: { token: string };
  QuickAccess: undefined;

  // ===== NOVOS (RESET DE SENHA) =====
  ForgotPassword: undefined;

  // token vem via deep link (query string), então é opcional aqui
  ResetPassword: { token?: string } | undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Operations: undefined;

  OperationDetails: {
    id: string;
    name: string;
    city: string;
    state: string;
    status: "em_andamento" | "concluida" | string;

    // ⚠️ no app você manda vários desses como String(...)
    amountInvested?: string | number;
    expectedProfit?: string | number;
    realizedProfit?: string | number;
    realizedRoiPercent?: string | number;

    roi?: string | number;
    roiExpectedPercent?: string | number;

    totalCosts?: string | number;
    estimatedTerm?: string | number;
    realizedTerm?: string | number;

    cartaArrematacao?: string;
    matriculaConsolidada?: string;
    contratoScp?: string;
    documents?: {
      cartaArrematacao?: string;
      matriculaConsolidada?: string;
      contratoScp?: string;
    };
    photoUrl?: string | null;
  };

  OperationTimeline: {
    id: string;
    name: string;
    status?: string;
  };

  OperationCosts: {
    id: string;
    name: string;
    totalCosts?: string | number;
  };

  Notifications: undefined;

  // ✅ NOVO (já existia no seu código)
  Statement: undefined;
};

// ✅ NOVO: Navegação Admin (sem filtros)
export type AdminStackParamList = {
  AdminHome: undefined;
  AdminOperations: undefined;
  AdminParties: undefined;
  AdminMovements: undefined;
  // ✅ Adicionar rotas para Details e Costs (mesmos parâmetros do AppStack)
  OperationDetails: {
    id: string;
    name: string;
    city: string;
    state: string;
    status: "em_andamento" | "concluida" | string;
    amountInvested?: string | number;
    expectedProfit?: string | number;
    realizedProfit?: string | number;
    realizedRoiPercent?: string | number;
    roi?: string | number;
    roiExpectedPercent?: string | number;
    totalCosts?: string | number;
    estimatedTerm?: string | number;
    realizedTerm?: string | number;
    cartaArrematacao?: string;
    matriculaConsolidada?: string;
    contratoScp?: string;
    documents?: {
      cartaArrematacao?: string;
      matriculaConsolidada?: string;
      contratoScp?: string;
    };
    photoUrl?: string | null;
  };
  OperationCosts: {
    id: string;
    name: string;
    totalCosts?: string | number;
  };
};
