import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema } from '../validators/auth.validator.js';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware.js';

const authRoutes = Router();

authRoutes.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  authController.login
);

export { authRoutes };
