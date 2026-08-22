import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  calendarController,
  schedulingController,
} from '../controllers/scheduling.controller.js';
import {
  createMeetingSchema,
  createMeetingTypeSchema,
  publicBookSchema,
  putAvailabilitySchema,
  rescheduleMeetingSchema,
  updateMeetingTypeSchema,
  updateSchedulingProfileSchema,
} from '../validators/scheduling.validator.js';

const calendarRoutes = Router();
const schedulingRoutes = Router();
const publicSchedulingRoutes = Router();

// --- Autenticado: calendar ---
calendarRoutes.use(authMiddleware);
calendarRoutes.get('/integrations', calendarController.getIntegration);
calendarRoutes.get('/google/connect', calendarController.connectGoogle);
calendarRoutes.delete('/google', calendarController.disconnectGoogle);

// --- Autenticado: agenda ---
schedulingRoutes.use(authMiddleware);
schedulingRoutes.get('/profile', schedulingController.getProfile);
schedulingRoutes.patch(
  '/profile',
  validate(updateSchedulingProfileSchema),
  schedulingController.updateProfile
);
schedulingRoutes.get('/availability', schedulingController.getAvailability);
schedulingRoutes.put(
  '/availability',
  validate(putAvailabilitySchema),
  schedulingController.putAvailability
);
schedulingRoutes.get('/meeting-types', schedulingController.listMeetingTypes);
schedulingRoutes.post(
  '/meeting-types',
  validate(createMeetingTypeSchema),
  schedulingController.createMeetingType
);
schedulingRoutes.patch(
  '/meeting-types/:id',
  validate(updateMeetingTypeSchema),
  schedulingController.updateMeetingType
);
schedulingRoutes.delete(
  '/meeting-types/:id',
  schedulingController.deleteMeetingType
);
schedulingRoutes.get('/meetings', schedulingController.listMeetings);
schedulingRoutes.get('/meetings/:id', schedulingController.getMeeting);
schedulingRoutes.post(
  '/meetings',
  validate(createMeetingSchema),
  schedulingController.createMeeting
);
schedulingRoutes.post(
  '/meetings/:id/reschedule',
  validate(rescheduleMeetingSchema),
  schedulingController.rescheduleMeeting
);
schedulingRoutes.post('/meetings/:id/cancel', schedulingController.cancelMeeting);

// --- Público ---
publicSchedulingRoutes.get(
  '/:sellerSlug/:meetingSlug',
  oauthRateLimiter,
  schedulingController.publicGetPage
);
publicSchedulingRoutes.get(
  '/:sellerSlug/:meetingSlug/availability',
  oauthRateLimiter,
  schedulingController.publicAvailability
);
publicSchedulingRoutes.post(
  '/:sellerSlug/:meetingSlug/book',
  oauthRateLimiter,
  validate(publicBookSchema),
  schedulingController.publicBook
);
publicSchedulingRoutes.post(
  '/manage/:token/cancel',
  oauthRateLimiter,
  schedulingController.publicCancel
);

export { calendarRoutes, schedulingRoutes, publicSchedulingRoutes };
