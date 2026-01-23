import { syncExcelOperations } from "./syncExcelOperations";
import { syncExcelNotifications } from "./syncExcelNotifications";

import { syncOmieCategories } from "./syncOmieCategories";
import { syncOmieParties } from "./syncOmieParties";
import { syncOmieProjects } from "./syncOmieProjects";
import { syncOmieAccountsPayable } from "./syncOmieAccountsPayable";
import { syncOmieMfMovements } from "./syncOmieMfMovements";

export async function syncAll() {
  const startedAt = new Date().toISOString();
  const steps: any[] = [];

  async function runStep(name: string, fn: () => Promise<any>) {
    const t0 = Date.now();
    try {
      const out = await fn();
      steps.push({ name, ok: true, ms: Date.now() - t0, ...out });
    } catch (e: any) {
      steps.push({ name, ok: false, ms: Date.now() - t0, error: e?.message || String(e) });
      // ✅ barato e resiliente: não aborta tudo
    }
  }

  // Excel
  await runStep("excel_operations", syncExcelOperations);
  await runStep("excel_notifications", syncExcelNotifications);

  // Omie
  await runStep("omie_categories", () => syncOmieCategories());
  await runStep("omie_parties", () => syncOmieParties());
  await runStep("omie_projects", () => syncOmieProjects());
  await runStep("omie_accounts_payable", () => syncOmieAccountsPayable());
  await runStep("omie_mf_movements", () => syncOmieMfMovements());

  return { startedAt, finishedAt: new Date().toISOString(), steps };
}
