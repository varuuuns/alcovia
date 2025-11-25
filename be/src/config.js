import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 3333;
export const NODE_ENV = process.env.NODE_ENV || "production";

export const DATABASE_URL = process.env.DATABASE_URL;
export const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";