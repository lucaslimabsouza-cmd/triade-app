"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushTokenSchema = exports.resetPasswordSchema = exports.changePasswordSchema = exports.loginSchema = void 0;
exports.validateBody = validateBody;
const zod_1 = require("zod");
// Validador de CPF/CNPJ
const cpfCnpjSchema = zod_1.z
    .string()
    .min(11, "CPF/CNPJ deve ter no mínimo 11 caracteres")
    .max(18, "CPF/CNPJ deve ter no máximo 18 caracteres")
    .refine((val) => {
    const digits = val.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14;
}, { message: "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos" });
// Schema de login
exports.loginSchema = zod_1.z.object({
    cpf_cnpj: cpfCnpjSchema.optional(),
    cpf: cpfCnpjSchema.optional(),
    password: zod_1.z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
}).refine((data) => data.cpf_cnpj || data.cpf, { message: "CPF/CNPJ é obrigatório", path: ["cpf_cnpj"] });
// Schema de troca de senha
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, "Senha atual é obrigatória"),
    newPassword: zod_1.z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});
// Schema de reset de senha
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Token é obrigatório"),
    newPassword: zod_1.z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});
// Schema de push token
exports.pushTokenSchema = zod_1.z.object({
    expo_push_token: zod_1.z.string().min(1, "Token é obrigatório"),
});
// Helper para validar request body
function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({
                    ok: false,
                    error: "Dados inválidos",
                    details: error.issues.map((e) => ({
                        path: e.path.join("."),
                        message: e.message,
                    })),
                });
            }
            next(error);
        }
    };
}
