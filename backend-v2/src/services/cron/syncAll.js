"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAll = syncAll;
const syncExcelOperations_1 = require("./syncExcelOperations");
const syncExcelNotifications_1 = require("./syncExcelNotifications");
const syncOmieCategories_1 = require("./syncOmieCategories");
const syncOmieParties_1 = require("./syncOmieParties");
const syncOmieProjects_1 = require("./syncOmieProjects");
const syncOmieAccountsPayable_1 = require("./syncOmieAccountsPayable");
const syncOmieMfMovements_1 = require("./syncOmieMfMovements");
async function syncAll() {
    const startedAt = new Date().toISOString();
    const steps = [];
    async function runStep(name, fn) {
        const t0 = Date.now();
        try {
            const out = await fn();
            steps.push({ name, ok: true, ms: Date.now() - t0, ...out });
        }
        catch (e) {
            steps.push({ name, ok: false, ms: Date.now() - t0, error: e?.message || String(e) });
            // ✅ barato e resiliente: não aborta tudo
        }
    }
    // Excel
    await runStep("excel_operations", syncExcelOperations_1.syncExcelOperations);
    await runStep("excel_notifications", syncExcelNotifications_1.syncExcelNotifications);
    // Omie
    await runStep("omie_categories", syncOmieCategories_1.syncOmieCategories);
    await runStep("omie_parties", syncOmieParties_1.syncOmieParties);
    await runStep("omie_projects", syncOmieProjects_1.syncOmieProjects);
    await runStep("omie_accounts_payable", syncOmieAccountsPayable_1.syncOmieAccountsPayable);
    await runStep("omie_mf_movements", syncOmieMfMovements_1.syncOmieMfMovements);
    return { startedAt, finishedAt: new Date().toISOString(), steps };
}
