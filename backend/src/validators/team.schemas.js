import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del equipo debe tener al menos 2 caracteres')
    .max(80, 'El nombre del equipo no puede superar los 80 caracteres'),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('El email no es válido'),
});

// Fase 7: cambiar el rol de un miembro. 'owner' queda fuera a propósito —
// solo puede haber un owner por equipo (es quien lo creó) y transferir esa
// titularidad no es parte del alcance de este proyecto.
export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], { message: 'Rol inválido' }),
});

export const createBoardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del tablero es obligatorio')
    .max(120, 'El nombre del tablero no puede superar los 120 caracteres'),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción no puede superar los 500 caracteres')
    .optional()
    .default(''),
});
