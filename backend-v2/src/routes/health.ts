import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { callOmie } from "../services/omie/callOmie";

const router = Router();

interface HealthCheck {
  status: "ok" | "error";
  message?: string;
  responseTime?: number;
}

async function checkSupabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin.from("omie_parties").select("id").limit(1);
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
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Erro desconhecido",
      responseTime: Date.now() - start,
    };
  }
}

async function checkOmie(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Testa uma chamada simples ao Omie
    await callOmie("geral/", "ListarCategorias", [], {
      timeout: 10000,
      maxRetries: 1,
    });

    return {
      status: "ok",
      message: "Omie API acessível",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Erro desconhecido",
      responseTime: Date.now() - start,
    };
  }
}

router.get("/", async (_req: Request, res: Response) => {
  const checks = {
    service: "backend-v2",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await checkSupabase(),
    omie: await checkOmie(),
  };

  const allHealthy =
    checks.database.status === "ok" && checks.omie.status === "ok";

  const statusCode = allHealthy ? 200 : 503;

  if (!allHealthy) {
    logger.warn("Health check falhou", checks);
  }

  res.status(statusCode).json(checks);
});

export default router;
