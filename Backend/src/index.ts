import express from "express";
import cors from "cors";
import operationsRouter from "./routes/operations";

const app = express();
app.use(cors());
app.use(express.json());

// Rota das operações
app.use("/operations", operationsRouter);

// Usa porta 4000 (a que você já usa)
const PORT = 4000;

// Importante no Windows: escutar em 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API Triade rodando na porta ${PORT}`);
});
