export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  QuickAccess: undefined;
  Login: undefined;
  ChangePassword: { token: string };
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
  Notifications: undefined;
};
