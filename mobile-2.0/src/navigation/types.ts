// src/navigation/types.ts

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ChangePassword: { token: string };
  QuickAccess: undefined;
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

  // ✅ NOVO
  Statement: undefined;
};
