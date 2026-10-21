import { Router } from "express";
import * as userController from "@/controllers/user.controller";
import { authenticate } from "@/middleware/auth.middleware";

const router = Router();

/* User Routes */

// Get all users (Admin)
router.get("/", authenticate, userController.getAllUsers);

// Get logged-in user
router.get("/profile", authenticate, userController.getProfile);

// Get user by ID
router.get("/:id", authenticate, userController.getUserById);

// Update logged-in user
router.put("/profile", authenticate, userController.updateProfile);

// Delete user
router.delete("/:id", authenticate, userController.deleteUser);

export default router;