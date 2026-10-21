import { Response } from "express";

import { prisma } from "@/lib/db";
import { AuthRequest } from "@/middleware/auth.middleware";

// =========================================================
// UPLOAD EVIDENCE
// POST /api/evidence
// =========================================================

export const uploadEvidence = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("================================");
    console.log("📥 EVIDENCE UPLOAD REQUEST");
    console.log("================================");

    console.log("User:", req.user);
    console.log("File:", req.file);
    console.log("Body:", req.body);

    // -----------------------------------------------------
    // AUTHENTICATION
    // -----------------------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // -----------------------------------------------------
    // FILE CHECK
    // -----------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video or audio file received.",
      });
    }

    // -----------------------------------------------------
    // FORM DATA
    // -----------------------------------------------------

    const title =
      typeof req.body.title === "string" &&
      req.body.title.trim()
        ? req.body.title.trim()
        : "Emergency SOS Recording";

    const description =
      typeof req.body.description === "string" &&
      req.body.description.trim()
        ? req.body.description.trim()
        : "Emergency recording captured during SOS activation.";

    // -----------------------------------------------------
    // FILE URL
    // -----------------------------------------------------

    const fileUrl =
      `/uploads/evidence/${req.file.filename}`;

    // -----------------------------------------------------
    // SAVE TO POSTGRESQL
    // -----------------------------------------------------

    const evidence =
      await prisma.evidence.create({
        data: {
          userId: req.user.id,
          title,
          description,
          fileUrl,
        },
      });

    console.log(
      "✅ Evidence saved to PostgreSQL"
    );

    console.log(
      "🆔 Evidence ID:",
      evidence.id
    );

    console.log(
      "📁 File URL:",
      evidence.fileUrl
    );

    // -----------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------

    return res.status(201).json({
      success: true,
      message:
        "Emergency recording saved successfully.",

      evidence: {
        id: evidence.id,
        userId: evidence.userId,
        title: evidence.title,
        description: evidence.description,
        fileUrl: evidence.fileUrl,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "❌ Evidence upload error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save emergency recording.",
    });
  }
};

// =========================================================
// GET MY EVIDENCE
// GET /api/evidence
// =========================================================

export const getMyEvidence = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // -----------------------------------------------------
    // AUTHENTICATION
    // -----------------------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // -----------------------------------------------------
    // FETCH USER'S RECORDINGS
    // -----------------------------------------------------

    const evidence =
      await prisma.evidence.findMany({
        where: {
          userId: req.user.id,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: evidence.length,
      evidence,
    });
  } catch (error) {
    console.error(
      "❌ Get evidence error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch evidence.",
    });
  }
};

// =========================================================
// GET ONE EVIDENCE
// GET /api/evidence/:id
// =========================================================

export const getEvidenceById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // IMPORTANT:
    // Convert Express route parameter to string
    const id = String(req.params.id);

    const evidence =
      await prisma.evidence.findFirst({
        where: {
          id,
          userId: req.user.id,
        },
      });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found.",
      });
    }

    return res.status(200).json({
      success: true,
      evidence,
    });
  } catch (error) {
    console.error(
      "❌ Get evidence error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch evidence.",
    });
  }
};

// =========================================================
// DELETE EVIDENCE
// DELETE /api/evidence/:id
// =========================================================

export const deleteEvidence = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // -----------------------------------------------------
    // AUTHENTICATION
    // -----------------------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // -----------------------------------------------------
    // IMPORTANT TYPESCRIPT FIX
    // -----------------------------------------------------

    const id = String(req.params.id);

    // -----------------------------------------------------
    // FIND EVIDENCE
    // -----------------------------------------------------

    const evidence =
      await prisma.evidence.findFirst({
        where: {
          id,
          userId: req.user.id,
        },
      });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found.",
      });
    }

    // -----------------------------------------------------
    // DELETE DATABASE RECORD
    // -----------------------------------------------------

    await prisma.evidence.delete({
      where: {
        id: evidence.id,
      },
    });

    console.log(
      "🗑️ Evidence deleted:",
      evidence.id
    );

    return res.status(200).json({
      success: true,
      message:
        "Evidence deleted successfully.",
    });
  } catch (error) {
    console.error(
      "❌ Delete evidence error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete evidence.",
    });
  }
};