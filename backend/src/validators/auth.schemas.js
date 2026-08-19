import { z } from 'zod';

// bcrypt solo considera los primeros 72 bytes de la contraseña;
// validar el máximo evita que dos contraseñas distintas colisionen.
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres');

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede superar los 80 caracteres'),
  email: z.string().trim().toLowerCase().email('El email no es válido'),
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('El email no es válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
