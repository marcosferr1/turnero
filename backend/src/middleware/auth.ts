import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  doctorId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Solo el administrador puede hacer esto" });
    return;
  }
  next();
}

/**
 * Doctor al que está restringido el usuario actual.
 * - Rol DOCTOR: su propio doctorId (todas las consultas se fuerzan a él).
 * - Admin/secretaria: undefined (sin restricción).
 */
export function scopedDoctorId(req: Request): number | undefined {
  if (req.user?.role === "DOCTOR" && req.user.doctorId) return req.user.doctorId;
  return undefined;
}
