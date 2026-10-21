import { Router } from "express";

import { authenticate } from "@/middleware/auth.middleware";

import {
  makeEmergencyCall,
} from "@/services/twilio.service";

const router = Router();

router.post(
  "/test-call",
  authenticate,
  async (req, res) => {
    try {
      const {
        phoneNumber,
        contactName,
        relation,
      } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number is required.",
        });
      }

      const call =
        await makeEmergencyCall(
          phoneNumber,
          contactName,
          relation
        );

      return res.status(200).json({
        success: true,
        message:
          "SafeOps emergency call initiated successfully.",
        callSid: call.sid,
        status: call.status,
      });
    } catch (error: any) {
      console.error(
        "❌ SafeOps Twilio call error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Unable to initiate emergency call.",
      });
    }
  }
);

export default router;