import { z } from 'zod';
import { FormFieldType, FormStatus } from '../models/form.model.js';

const fieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const fieldValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    regex: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

export const formFieldInputSchema = z.object({
  type: z.nativeEnum(FormFieldType),
  label: z.string().trim().min(1).max(255),
  placeholder: z.string().trim().max(255).optional().nullable(),
  required: z.boolean().optional().default(false),
  position: z.number().int().nonnegative().optional(),
  options: z.array(fieldOptionSchema).optional().nullable(),
  validation: fieldValidationSchema,
});

export const createFormSchema = z.object({
  name: z.string().trim().min(3).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.nativeEnum(FormStatus).optional(),
  fields: z.array(formFieldInputSchema).min(1, 'Informe ao menos um campo'),
});

export const updateFormSchema = z.object({
  name: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.nativeEnum(FormStatus).optional(),
  fields: z.array(formFieldInputSchema).min(1).optional(),
});

export const submitFormSchema = z.object({
  answers: z
    .array(
      z.object({
        field_id: z.coerce.number().int().positive(),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.union([z.string(), z.number()])),
          z.null(),
        ]),
      })
    )
    .min(1),
});
