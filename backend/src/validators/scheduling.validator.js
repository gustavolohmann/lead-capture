import { z } from 'zod';

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateSchedulingProfileSchema = z
  .object({
    timezone: z.string().min(3).max(64).optional(),
    schedulingSlug: z.string().min(3).max(80).optional(),
  })
  .strict();

export const putAvailabilitySchema = z
  .object({
    timezone: z.string().min(3).max(64).optional(),
    rules: z
      .array(
        z
          .object({
            dayOfWeek: z.number().int().min(0).max(6),
            startTime: z.string().regex(timeRe, 'Use HH:mm'),
            endTime: z.string().regex(timeRe, 'Use HH:mm'),
          })
          .strict()
      )
      .max(50),
  })
  .strict();

export const createMeetingTypeSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: z.string().min(2).max(80).optional(),
    description: z.string().max(2000).optional().nullable(),
    durationMinutes: z.number().int().positive().max(8 * 60),
    locationType: z.enum(['GOOGLE_MEET', 'PRESENTIAL', 'NONE']).optional(),
    isActive: z.boolean().optional(),
    bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
    bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
    minimumNoticeMinutes: z.number().int().min(0).max(60 * 24 * 14).optional(),
    bookingWindowDays: z.number().int().min(1).max(90).optional(),
  })
  .strict();

export const updateMeetingTypeSchema = createMeetingTypeSchema.partial().strict();

export const createMeetingSchema = z
  .object({
    meetingTypeId: z.coerce.number().int().positive(),
    startAt: z.string().min(10),
    leadId: z.coerce.number().int().positive().optional().nullable(),
    customer: z
      .object({
        name: z.string().min(2).max(180),
        email: z.string().email().max(180),
        phone: z.string().max(50).optional().nullable(),
      })
      .strict(),
  })
  .strict();

export const rescheduleMeetingSchema = z
  .object({
    startAt: z.string().min(10),
  })
  .strict();

export const publicBookSchema = z
  .object({
    startAt: z.string().min(10),
    name: z.string().min(2).max(180),
    email: z.string().email().max(180),
    phone: z.string().max(50).optional().nullable(),
  })
  .strict();
