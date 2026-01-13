"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
    throw new Error("Faltou SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
});
