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
    status: "em_andamento" | "concluida";

    amountInvested: number;
    roi: number;
    realizedProfit: number;
    totalCosts: number;
    estimatedTerm: number | string;
    realizedTerm: number | string;

    documents: {
      cartaArrematacao?: string;
      matriculaConsolidada?: string;
      contratoScp?: string; // ✅ NOVO
    };

  OperationTimeline: {
    id: string;
    name: string;
    status?: string;
  };

  OperationCosts: {
    id: string;
    name: string;
    totalCosts?: string; // ✅ pra começar com valor inicial se quiser
  };

  Notifications: undefined;
};
