import { pool } from '../config/postgres.js';

/**
 * Carga el equipo del parámetro :teamId y verifica que el usuario autenticado
 * sea miembro. Si lo es, deja req.team (la fila del equipo) y
 * req.membershipRole ('owner' | 'admin' | 'member').
 *
 * Devuelve 404 (no 403) cuando no hay membresía: así no se revela a usuarios
 * ajenos si un equipo existe o no (evita enumerar equipos privados).
 *
 * Requiere que la ruta ya haya pasado por validateIdParam('teamId') — deja
 * req.params.teamId como Number.
 */
export async function requireTeamMember(req, res, next) {
  const teamId = req.params.teamId;

  try {
    const { rows } = await pool.query(
      `SELECT t.*, tm.role AS membership_role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE t.id = $1 AND tm.user_id = $2`,
      [teamId, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado o no eres miembro' });
    }

    req.team = rows[0];
    req.membershipRole = rows[0].membership_role;
    next();
  } catch (err) {
    next(err);
  }
}
