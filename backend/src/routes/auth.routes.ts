import { Router } from "express";

import {
  register,
  login,
  getProfile,
  logout,
} from "@/controllers/auth.controller";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.get("/profile", getProfile);

router.post("/logout", logout);

export default router;