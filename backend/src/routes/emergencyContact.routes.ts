import { Router } from "express";

import {
  getEmergencyContacts,
  createEmergencyContact,
  deleteEmergencyContact,
} from "@/controllers/emergencyContact.controller";

import { authenticate } from "@/middleware/auth.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  getEmergencyContacts
);

router.post(
  "/",
  authenticate,
  createEmergencyContact
);

router.delete(
  "/:id",
  authenticate,
  deleteEmergencyContact
);

export default router;