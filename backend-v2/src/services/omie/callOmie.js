"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callOmie = callOmie;
const axios_1 = __importDefault(require("axios"));
const OMIE_BASE_URL = process.env.OMIE_BASE_URL || "https://app.omie.com.br/api/v1";
const OMIE_APP_KEY = process.env.OMIE_APP_KEY || "";
const OMIE_APP_SECRET = process.env.OMIE_APP_SECRET || "";
async function callOmie(endpointPath, call, paramArray) {
    if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
        throw new Error("OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env");
    }
    const base = OMIE_BASE_URL.replace(/\/+$/, "");
    const path = endpointPath.replace(/^\/+/, "");
    const url = `${base}/${path}`;
    const body = {
        call,
        app_key: OMIE_APP_KEY,
        app_secret: OMIE_APP_SECRET,
        param: paramArray,
    };
    const { data } = await axios_1.default.post(url, body, {
        headers: { "Content-Type": "application/json" },
    });
    return data;
}
