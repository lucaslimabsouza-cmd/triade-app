// mobile/lib/mockData.ts
import type { DashboardData } from "./models";

export const dashboardMockData: DashboardData = {
  totalInvested: 250000,
  totalActive: 180000,
  totalRealizedProfit: 52000,
  averageRoi: 32.5,
  investments: [
    {
      id: "1",
      propertyName: "Apartamento 302 - Vila Mariana",
      city: "São Paulo",
      state: "SP",
      status: "em_andamento",
      amountInvested: 80000,
      expectedReturn: 25000,
      roi: 31.25,
    },
    {
      id: "2",
      propertyName: "Casa - Jardim Europa",
      city: "Curitiba",
      state: "PR",
      status: "concluida",
      amountInvested: 60000,
      realizedProfit: 22000,
      roi: 36.6,
    },
  ],
  notifications: [
    {
      id: "n1",
      title: "Nova operação disponível",
      description:
        "Imóvel residencial em Campinas/SP com desconto de 32% abaixo do mercado.",
      date: "05/12/2025",
    },
  ],
};
