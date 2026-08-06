import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .transform((value) => value.toLowerCase().trim()),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter no mínimo 8 caracteres'),
});
