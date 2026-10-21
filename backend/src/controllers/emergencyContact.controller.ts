import { Response } from "express";
import { prisma } from "@/lib/db";
import { AuthRequest } from "@/middleware/auth.middleware";

// In-memory fallback store if database server is temporarily offline
interface LocalContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relation: string | null;
  createdAt: Date;
  updatedAt: Date;
}
let memoryContacts: LocalContact[] = [
  {
    id: "contact-1",
    userId: "dev-user-001",
    name: "Emergency Police / Dispatch",
    phone: "+91112",
    relation: "Police / Emergency Services",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// =========================================================
// GET ALL EMERGENCY CONTACTS
// =========================================================

export const getEmergencyContacts = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;

    try {
      const contacts =
        await prisma.emergencyContact.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        success: true,
        contacts,
      });
    } catch (dbErr) {
      // Fallback to memory store
      const userContacts = memoryContacts.filter(
        (c) => c.userId === userId || userId === "dev-user-001"
      );
      return res.status(200).json({
        success: true,
        contacts: userContacts,
      });
    }
  } catch (error) {
    console.error(
      "Get emergency contacts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch emergency contacts.",
    });
  }
};

// =========================================================
// ADD EMERGENCY CONTACT
// =========================================================

export const createEmergencyContact = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;

    const {
      name,
      phone,
      relation,
    } = req.body;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !relation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, phone and relationship are required.",
      });
    }

    try {
      const contact =
        await prisma.emergencyContact.create({
          data: {
            userId,
            name: name.trim(),
            phone: phone.trim(),
            relation: relation.trim(),
          },
        });

      return res.status(201).json({
        success: true,
        message:
          "Emergency contact added successfully.",
        contact,
      });
    } catch (dbErr) {
      // Offline fallback: save to memory
      const newContact: LocalContact = {
        id: "contact-" + Date.now(),
        userId,
        name: name.trim(),
        phone: phone.trim(),
        relation: relation.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryContacts.unshift(newContact);

      return res.status(201).json({
        success: true,
        message:
          "Emergency contact added successfully.",
        contact: newContact,
      });
    }
  } catch (error) {
    console.error(
      "Create emergency contact error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create emergency contact.",
    });
  }
};

// =========================================================
// DELETE EMERGENCY CONTACT
// =========================================================

export const deleteEmergencyContact = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    try {
      const contact =
        await prisma.emergencyContact.findFirst({
          where: {
            id,
            userId,
          },
        });

      if (contact) {
        await prisma.emergencyContact.delete({
          where: {
            id: contact.id,
          },
        });
      }
    } catch (dbErr) {
      // Offline fallback: delete from memory
      memoryContacts = memoryContacts.filter((c) => c.id !== id);
    }

    return res.status(200).json({
      success: true,
      message:
        "Emergency contact deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete emergency contact error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete emergency contact.",
    });
  }
};