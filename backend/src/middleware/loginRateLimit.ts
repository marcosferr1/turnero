import rateLimit from "express-rate-limit";
import { config } from "../config";

export const loginRateLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de login. Probá de nuevo más tarde." },
});
