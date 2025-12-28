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
    name?: string;
    city?: string;
    state?: string;
    status?: string;
    amountInvested?: string;
    roi?: string;
    expectedReturn?: string;
    realizedProfit?: string;
    totalCosts?: string;
    estimatedTerm?: string;
    realizedTerm?: string;
    cartaArrematacao?: string;
    matriculaConsolidada?: string;
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
