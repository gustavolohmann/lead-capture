import { authService } from '../services/auth.service.js';

export const authController = {
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);

      return res.status(200).json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      return next(error);
    }
  },
};
