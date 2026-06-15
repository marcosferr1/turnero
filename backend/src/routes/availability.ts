import { Router } from "express";
import { getAvailableDays, getSlotsForDate } from "../services/slots";
import { isValidDate } from "../lib/dates";
import { scopedDoctorId } from "../middleware/auth";

export const availabilityRouter = Router();

availabilityRouter.get("/slots", async (req, res) => {
  const doctorId = scopedDoctorId(req) ?? parseInt(String(req.query.doctorId), 10);
  const locationId = parseInt(String(req.query.locationId), 10);
  const date = String(req.query.date || "");
  if (isNaN(doctorId) || isNaN(locationId) || !isValidDate(date)) {
    res.status(400).json({ error: "doctorId, locationId y date (YYYY-MM-DD) son requeridos" });
    return;
  }
  res.json(await getSlotsForDate(doctorId, locationId, date));
});

availabilityRouter.get("/days", async (req, res) => {
  const doctorId = scopedDoctorId(req) ?? parseInt(String(req.query.doctorId), 10);
  const locationId = parseInt(String(req.query.locationId), 10);
  const from = req.query.from ? String(req.query.from) : undefined;
  if (isNaN(doctorId) || isNaN(locationId)) {
    res.status(400).json({ error: "doctorId y locationId son requeridos" });
    return;
  }
  res.json(await getAvailableDays(doctorId, locationId, from));
});
