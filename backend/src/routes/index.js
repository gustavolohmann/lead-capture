import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { metaRoutes } from './meta.routes.js';
import { leadsRoutes } from './leads.routes.js';
import { campaignsRoutes } from './campaigns.routes.js';
import { conversationsRoutes } from './conversations.routes.js';
import { automationRoutes } from './automation.routes.js';
import {
  leadFormsRoutes,
  adsBuilderRoutes,
} from './adsBuilder.routes.js';
import { formsRoutes } from './forms.routes.js';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/meta', metaRoutes);
routes.use('/leads', leadsRoutes);
routes.use('/campaigns', campaignsRoutes);
routes.use('/campaigns', adsBuilderRoutes);
routes.use('/lead-forms', leadFormsRoutes);
routes.use('/forms', formsRoutes);
routes.use('/conversations', conversationsRoutes);
routes.use('/automations', automationRoutes);

export { routes };
