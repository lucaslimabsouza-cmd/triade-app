"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
const callOmie_1 = require("../services/omie/callOmie");
const router = (0, express_1.Router)();
async function checkSupabase() {
    const start = Date.now();
    try {
        const { error } = await supabase_1.supabaseAdmin.from("omie_parties").select("id").limit(1);
        const responseTime = Date.now() - start;
        if (error) {
            return {
                status: "error",
                message: `Supabase error: ${error.message}`,
                responseTime,
            };
        }
        return {
            status: "ok",
            message: "Supabase conectado",
            responseTime,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Erro desconhecido",
            responseTime: Date.now() - start,
        };
    }
}
async function checkOmie() {
    const start = Date.now();
    try {
        // Testa uma chamada simples ao Omie
        await (0, callOmie_1.callOmie)("geral/", "ListarCategorias", [], {
            timeout: 10000,
            maxRetries: 1,
        });
        return {
            status: "ok",
            message: "Omie API acessível",
            responseTime: Date.now() - start,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Erro desconhecido",
            responseTime: Date.now() - start,
        };
    }
}
router.get("/", async (_req, res) => {
    const checks = {
        service: "backend-v2",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: await checkSupabase(),
        omie: await checkOmie(),
    };
    const allHealthy = checks.database.status === "ok" && checks.omie.status === "ok";
    const statusCode = allHealthy ? 200 : 503;
    if (!allHealthy) {
        logger_1.logger.warn("Health check falhou", checks);
    }
    res.status(statusCode).json(checks);
});
exports.default = router;
