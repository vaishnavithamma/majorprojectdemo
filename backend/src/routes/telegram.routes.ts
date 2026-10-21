import { Router } from "express";
import { authenticate, AuthRequest } from "@/middleware/auth.middleware";
import { sendTelegramAlert } from "@/services/telegram.service";

const router = Router();

// =========================================================
// SEND TEST TELEGRAM ALERT (From Emergency Contacts Page)
// =========================================================
router.post("/test-alert", authenticate, async (req: AuthRequest, res) => {
  try {
    const { contactName, relation, phone } = req.body;

    const result = await sendTelegramAlert({
      contactName,
      relation,
      phone,
      messageType: "TEST_ALERT",
    });

    return res.status(200).json({
      success: true,
      message: `Telegram alert sent successfully to ${contactName || "contact"}.`,
      result,
    });
  } catch (error: any) {
    console.error("❌ Telegram test alert error:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Unable to send Telegram alert. Ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in .env",
    });
  }
});

// =========================================================
// SEND SOS EMERGENCY ALERT WITH GPS LOCATION
// =========================================================
router.post("/sos-dispatch", authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy,
      contactName,
      relation,
      phone,
    } = req.body;

    const user = req.user;

    const result = await sendTelegramAlert({
      userName: user?.email || "SafeOps User",
      contactName,
      relation,
      phone,
      latitude,
      longitude,
      accuracy,
      messageType: "SOS_TRIGGER",
    });

    return res.status(200).json({
      success: true,
      message: "SafeOps emergency alert dispatched to Telegram.",
      result,
    });
  } catch (error: any) {
    console.error("❌ Telegram SOS dispatch error:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Unable to dispatch Telegram alert. Ensure .env has TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
    });
  }
});

export default router;
