import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const leadsRoutes = Router();

leadsRoutes.get('/', authMiddleware, leadsController.list);
leadsRoutes.get('/:id', authMiddleware, leadsController.getById);

export { leadsRoutes };
