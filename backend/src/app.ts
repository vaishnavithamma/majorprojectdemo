import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import twilioRoutes from "@/routes/twilio.routes";

import authRoutes from "@/routes/auth.routes";
import emergencyContactRoutes from "@/routes/emergencyContact.routes";
import evidenceRoutes from "@/routes/evidence.routes";
import safeRouteRoutes from "@/routes/saferoute.routes";
import telegramRoutes from "@/routes/telegram.routes";

const app = express();

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

/* =========================================================
   SECURITY
========================================================= */

app.use(helmet());

/* =========================================================
   LOGGING
========================================================= */

app.use(morgan("dev"));

/* =========================================================
   BODY PARSING
========================================================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

/* =========================================================
   STATIC UPLOADS
========================================================= */

app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads")
  )
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Major Project Backend Running 🚀",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

// Authentication
app.use(
  "/api/auth",
  authRoutes
);

// Emergency Contacts
app.use(
  "/api/emergency-contacts",
  emergencyContactRoutes
);

// Evidence / Emergency Recordings
app.use(
  "/api/evidence",
  evidenceRoutes
);
// Twilio Calls
app.use(
  "/api/twilio",
  twilioRoutes
);

// Telegram Emergency Alerts
app.use(
  "/api/telegram",
  telegramRoutes
);

// Safe Route Planning
app.use(
  "/api/routes",
  safeRouteRoutes
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("❌ Server Error:", err);

    res.status(err.status || 500).json({
      success: false,
      message:
        err.message ||
        "Internal Server Error",
    });
  }
);

export default app;