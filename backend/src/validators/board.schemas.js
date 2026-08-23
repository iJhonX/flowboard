import { z } from 'zod';

const columnName = z
  .string()
  .trim()
  .min(1, 'El nombre de la columna es obligatorio')
  .max(120, 'El nombre de la columna no puede superar los 120 caracteres');

const title = z
  .string()
  .trim()
  .min(1, 'El título de la tarjeta es obligatorio')
  .max(200, 'El título no puede superar los 200 caracteres');

// Validación de fecha con regex + round-trip: el regex solo comprueba la forma
// (YYYY-MM-DD); el refine rechaza fechas imposibles (2024-02-31, 2024-13-01)
// que Postgres rechazaría con un 22008/22P02 y convertiríamos en 500.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine(
    (value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    },
    'La fecha no es válida'
  );

export const createColumnSchema = z.object({ name: columnName });

export const updateColumnSchema = z.object({ name: columnName });

export const createCardSchema = z.object({
  column_id: z.number().int().positive('La columna es obligatoria'),
  title,
  description: z
    .string()
    .trim()
    .max(5000, 'La descripción no puede superar los 5000 caracteres')
    .optional()
    .default(''),
  due_date: dateString.nullable().optional(),
});

export const updateCardSchema = z.object({
  title,
  description: z
    .string()
    .trim()
    .max(5000, 'La descripción no puede superar los 5000 caracteres')
    .optional()
    .default(''),
  // Semántica de PATCH: reemplazo completo de los campos editables. El frontend
  // envía SIEMPRE los tres campos; si un cliente futuro omite description se
  // sobreescribirá con ''. Aceptado a propósito por simplicidad en Fase 3.
  due_date: dateString.nullable().optional(),
});
