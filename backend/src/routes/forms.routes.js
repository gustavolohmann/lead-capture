import { Router } from 'express';
import {
  formsController,
  formSubmissionsController,
} from '../controllers/forms.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
} from '../validators/form.validator.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';

const formsRoutes = Router();

// Público (landing / preview)
formsRoutes.get('/:id/public', formsController.getPublic);
formsRoutes.post(
  '/:id/submit',
  oauthRateLimiter,
  validate(submitFormSchema),
  formSubmissionsController.submit
);

// Autenticado
formsRoutes.use(authMiddleware);
formsRoutes.get('/', formsController.list);
formsRoutes.post('/', validate(createFormSchema), formsController.create);
formsRoutes.get('/:id', formsController.getById);
formsRoutes.put('/:id', validate(updateFormSchema), formsController.update);
formsRoutes.delete('/:id', formsController.remove);

export { formsRoutes };
