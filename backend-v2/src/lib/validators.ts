import { z } from "zod";

// Validador de CPF/CNPJ
const cpfCnpjSchema = z
  .string()
  .min(11, "CPF/CNPJ deve ter no mínimo 11 caracteres")
  .max(18, "CPF/CNPJ deve ter no máximo 18 caracteres")
  .refine(
    (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length === 11 || digits.length === 14;
    },
    { message: "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos" }
  );

// Schema de login
export const loginSchema = z.object({
  cpf_cnpj: cpfCnpjSchema.optional(),
  cpf: cpfCnpjSchema.optional(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
}).refine(
  (data) => data.cpf_cnpj || data.cpf,
  { message: "CPF/CNPJ é obrigatório", path: ["cpf_cnpj"] }
);

// Schema de troca de senha
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});

// Schema de reset de senha
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});

// Schema de push token
export const pushTokenSchema = z.object({
  expo_push_token: z.string().min(1, "Token é obrigatório"),
});

// Helper para validar request body
export function validateBody<T extends z.ZodTypeAny>(
  schema: T
): (req: any, res: any, next: any) => void {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          ok: false,
          error: "Dados inválidos",
          details: error.issues.map((e: z.ZodIssue) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
