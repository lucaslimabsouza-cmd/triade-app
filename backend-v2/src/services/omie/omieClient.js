"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.omiePost = omiePost;
const axios_1 = __importDefault(require("axios"));
const baseURL = process.env.OMIE_BASE_URL;
const appKey = process.env.OMIE_APP_KEY;
const appSecret = process.env.OMIE_APP_SECRET;
if (!baseURL || !appKey || !appSecret) {
    throw new Error("Faltou OMIE_BASE_URL / OMIE_APP_KEY / OMIE_APP_SECRET no .env");
}
async function omiePost(endpoint, body) {
    const url = `${baseURL}${endpoint}`;
    const payload = {
        app_key: appKey,
        app_secret: appSecret,
        ...body
    };
    const { data } = await axios_1.default.post(url, payload, {
        headers: { "Content-Type": "application/json" }
    });
    return data;
}
