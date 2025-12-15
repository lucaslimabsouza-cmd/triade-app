// mobile/lib/models.ts

export type PropertyStatus = "em_andamento" | "concluida";

export type OperationTimeline = {
  dataArrematacao?: number | string | null;
  dataITBI?: number | string | null;
  dataEscritura?: number | string | null;
  dataMatricula?: number | string | null;
  dataDesocupacao?: number | string | null;
  dataObra?: number | string | null;
  dataDisponibilizadoImobiliaria?: number | string | null;
  dataContratoVenda?: number | string | null;
  dataRecebimentoVenda?: number | string | null;
};

export type Investment = {
  id: string;
  propertyName: string;
  city: string;
  state: string;
  status: PropertyStatus;

  amountInvested: number;
  expectedReturn?: number; // para operações em andamento
  realizedProfit?: number; // para operações concluídas
  roi: number; // %

  totalCosts?: number;
  estimatedTerm?: string | number;

  // 👇 linha do tempo completa da operação
  timeline?: OperationTimeline;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  date: string;
};

export type DashboardData = {
  totalInvested: number;
  totalActive: number;
  totalRealizedProfit: number;
  averageRoi: number;
  investments: Investment;
  notifications: Notification[];
};
