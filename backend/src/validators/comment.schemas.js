import { z } from 'zod';

export const createCommentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'El comentario no puede estar vacío')
    .max(2000, 'El comentario no puede superar los 2000 caracteres'),
});
