import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 5000,

  NODE_ENV: process.env.NODE_ENV || "development",

  DATABASE_URL: process.env.DATABASE_URL || "",

  JWT_SECRET: process.env.JWT_SECRET || "majorproject_secret",

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  UPLOAD_PATH: process.env.UPLOAD_PATH || "uploads",

  SMTP_HOST: process.env.SMTP_HOST || "",

  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,

  SMTP_EMAIL: process.env.SMTP_EMAIL || "",

  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
};

if (!env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not configured.");
}

if (!env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}