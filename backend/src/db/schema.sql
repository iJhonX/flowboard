-- Esquema de la base de datos relacional (PostgreSQL)
-- Fase 1: tabla users. Las fases siguientes irán añadiendo tablas aquí.
-- Idempotente: se puede ejecutar varias veces sin errores.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
