import { Router } from "express";
import { getOperationSummariesFromOmie } from "../services/omieMock";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const operations = await getOperationSummariesFromOmie();
    res.json(operations);
  } catch (error) {
    console.error("Erro ao listar operações:", error);
    res.status(500).json({ message: "Erro ao buscar operações" });
  }
});

export default router;
