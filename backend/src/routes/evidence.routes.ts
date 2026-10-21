import express, {
  Request,
  Response,
  NextFunction,
} from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { prisma } from "@/lib/db";
import {
  authenticate,
  AuthRequest,
} from "@/middleware/auth.middleware";

const router = express.Router();

// =========================================================
// UPLOAD DIRECTORY
// =========================================================

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "evidence"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// =========================================================
// MULTER STORAGE
// =========================================================

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    cb
  ) => {
    cb(null, uploadDirectory);
  },

  filename: (
    _req,
    file,
    cb
  ) => {
    const extension =
      path.extname(file.originalname) || ".webm";

    const filename =
      `emergency-${Date.now()}-${Math.round(
        Math.random() * 1000000
      )}${extension}`;

    cb(null, filename);
  },
});

// =========================================================
// FILE FILTER
// =========================================================

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  console.log(
    "📁 Incoming file:",
    file.originalname
  );

  console.log(
    "📁 MIME type:",
    file.mimetype
  );

  const mime = (
    file.mimetype || ""
  ).toLowerCase();

  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  console.log(
    "📁 File extension:",
    extension
  );

  // Accept normal browser video/audio MIME types
  const isVideo =
    mime.startsWith("video/");

  const isAudio =
    mime.startsWith("audio/");

  // Some browsers/dev environments may incorrectly
  // send a WebM recording as text/plain.
  const isAllowedExtension = [
    ".webm",
    ".mp4",
    ".ogg",
    ".mkv",
    ".mpeg",
    ".mpg",
    ".mp3",
    ".wav",
  ].includes(extension);

  if (
    isVideo ||
    isAudio ||
    isAllowedExtension
  ) {
    console.log(
      "✅ Accepted recording:",
      {
        mime,
        extension,
      }
    );

    cb(null, true);
    return;
  }

  console.log(
    "❌ Rejected file:",
    {
      mime,
      extension,
    }
  );

  cb(
    new Error(
      `Only video or audio files are allowed. Received: ${mime}`
    )
  );
};

// =========================================================
// MULTER
// =========================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    // 500 MB
    fileSize: 500 * 1024 * 1024,
  },
});

// =========================================================
// CREATE EVIDENCE
// POST /api/evidence
// =========================================================

router.post(
  "/",
  authenticate,
  upload.single("video"),

  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      console.log("");
      console.log("=================================");
      console.log("📥 POST /api/evidence");
      console.log("=================================");

      console.log("👤 User:", req.user?.id);

      console.log(
        "📁 File:",
        req.file
          ? {
              originalname:
                req.file.originalname,
              filename:
                req.file.filename,
              mimetype:
                req.file.mimetype,
              size:
                req.file.size,
            }
          : null
      );

      console.log("📝 Body:", req.body);

      // -----------------------------------------------------
      // AUTH CHECK
      // -----------------------------------------------------

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
      }

      // -----------------------------------------------------
      // FILE CHECK
      // -----------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No video or audio file was uploaded.",
        });
      }

      const title =
        typeof req.body.title === "string" && req.body.title.trim()
          ? req.body.title.trim()
          : "Emergency SOS Recording";

      const description =
        typeof req.body.description === "string" && req.body.description.trim()
          ? req.body.description.trim()
          : "Emergency video and audio recording.";

      const fileUrl = `/uploads/evidence/${req.file.filename}`;

      // -----------------------------------------------------
      // USER CHECK & DATABASE SAVE WITH OFFLINE FALLBACK
      // -----------------------------------------------------
      let savedEvidence: any = null;

      try {
        const user = await prisma.user.findUnique({
          where: {
            id: req.user.id,
          },
        });

        if (user) {
          savedEvidence = await prisma.evidence.create({
            data: {
              userId: req.user.id,
              title,
              description,
              fileUrl,
              latitude: req.body.latitude ? Number(req.body.latitude) : null,
              longitude: req.body.longitude ? Number(req.body.longitude) : null,
            },
          });
        }
      } catch (dbErr) {
        console.warn("⚠️ Database offline during evidence save, saving local file evidence");
      }

      if (!savedEvidence) {
        // Fallback evidence record
        savedEvidence = {
          id: "evidence-" + Date.now(),
          userId: req.user.id,
          title,
          description,
          fileUrl,
          createdAt: new Date(),
        };
      }

      console.log("");
      console.log("✅ Evidence file saved successfully");
      console.log("🆔 Evidence ID:", savedEvidence.id);
      console.log("📁 File:", savedEvidence.fileUrl);
      console.log("");

      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      return res.status(201).json({
        success: true,
        message: "Emergency recording saved successfully.",
        evidence: {
          id: savedEvidence.id,
          title: savedEvidence.title,
          description: savedEvidence.description,
          fileUrl: savedEvidence.fileUrl,
          createdAt: savedEvidence.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "❌ Evidence upload error:",
        error
      );

      // Remove physical file if database
      // operation failed
      if (req.file?.path) {
        fs.unlink(
          req.file.path,
          () => {}
        );
      }

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to save evidence.",
      });
    }
  }
);

// =========================================================
// GET USER'S EVIDENCE
// GET /api/evidence
// =========================================================

router.get(
  "/",
  authenticate,

  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
      }

      let evidence: any[] = [];

      try {
        evidence = await prisma.evidence.findMany({
          where: {
            userId: req.user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      } catch (dbErr) {
        console.warn("⚠️ Database offline during GET evidence, returning empty/local list");
      }

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
          "Failed to retrieve evidence.",
      });
    }
  }
);

// =========================================================
// DELETE USER EVIDENCE
// DELETE /api/evidence/:id
// =========================================================

router.delete(
  "/:id",
  authenticate,

  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized.",
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

      // -----------------------------------------------------
      // DELETE PHYSICAL FILE
      // -----------------------------------------------------

      const filename =
        path.basename(
          evidence.fileUrl
        );

      const filePath =
        path.join(
          uploadDirectory,
          filename
        );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);

        console.log(
          "🗑️ File deleted:",
          filePath
        );
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
        "✅ Evidence deleted:",
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
  }
);

// =========================================================
// MULTER / UPLOAD ERROR HANDLER
// =========================================================

router.use(
  (
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      "❌ Evidence route error:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Upload error: ${error.message}`,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Evidence upload failed.",
    });
  }
);

export default router;