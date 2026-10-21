import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createPrescription,
  getPatientPrescription,
  listPatientPrescriptions,
  replacePrescriptionItems,
  sendPrescription,
  updatePrescription,
} from "./prescription.service.js";
import {
  appointmentPrescriptionIdSchema,
  createPrescriptionSchema,
  prescriptionIdSchema,
  prescriptionListSchema,
  replacePrescriptionItemsSchema,
  updatePrescriptionSchema,
} from "./prescriptions.validation.js";

const userId = (req: Request) => {
  if (!req.auth) throw new AppError("Authentication required", 401);
  return req.auth.userId;
};

export const prescriptionController = {
  create: async (req: Request, res: Response) => {
    const { id } = appointmentPrescriptionIdSchema.parse(req.params);
    const input = createPrescriptionSchema.parse(req.body);
    const data = await createPrescription(userId(req), id, input);
    res.status(201).json({ success: true, data });
  },
  update: async (req: Request, res: Response) => {
    const { id } = prescriptionIdSchema.parse(req.params);
    const data = await updatePrescription(userId(req), id, updatePrescriptionSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },
  replaceItems: async (req: Request, res: Response) => {
    const { id } = prescriptionIdSchema.parse(req.params);
    const { items } = replacePrescriptionItemsSchema.parse(req.body);
    const data = await replacePrescriptionItems(userId(req), id, items);
    res.status(200).json({ success: true, data });
  },
  send: async (req: Request, res: Response) => {
    const { id } = prescriptionIdSchema.parse(req.params);
    const data = await sendPrescription(userId(req), id);
    res.status(200).json({ success: true, message: "Prescription sent successfully", data });
  },
  listMine: async (req: Request, res: Response) => {
    const { page, limit } = prescriptionListSchema.parse(req.query);
    const data = await listPatientPrescriptions(userId(req), page, limit);
    res.status(200).json({ success: true, data: data.prescriptions, pagination: data.pagination });
  },
  getMine: async (req: Request, res: Response) => {
    const { id } = prescriptionIdSchema.parse(req.params);
    const data = await getPatientPrescription(userId(req), id);
    res.status(200).json({ success: true, data });
  },
};
