import { pool } from '../config/postgres.js';

/** POST /api/teams — crea un equipo; quien lo crea queda como owner. */
export async function createTeam(req, res, next) {
  const { name } = req.body;
  const client = await pool.connect();

  try {
    // Transacción: si falla la membresía, no debe quedar un equipo huérfano
    await client.query('BEGIN');
    const {
      rows: [team],
    } = await client.query(
      'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
      [name, req.userId]
    );
    await client.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [team.id, req.userId, 'owner']
    );
    await client.query('COMMIT');
    res.status(201).json({ team });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** GET /api/teams — lista los equipos del usuario autenticado. */
export async function listMyTeams(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.owner_id, t.created_at,
              tm.role AS my_role,
              (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.userId]
    );
    res.json({ teams: rows });
  } catch (err) {
    next(err);
  }
}

/** GET /api/teams/:teamId — detalle del equipo: miembros + tableros. */
export async function getTeamDetail(req, res, next) {
  try {
    const teamId = req.team.id;

    const [membersRes, boardsRes] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, tm.role, tm.joined_at
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1
         ORDER BY tm.joined_at`,
        [teamId]
      ),
      pool.query('SELECT * FROM boards WHERE team_id = $1 ORDER BY created_at DESC', [teamId]),
    ]);

    // req.team trae membership_role (del JOIN del middleware): no exponerlo aquí
    const team = {
      id: req.team.id,
      name: req.team.name,
      owner_id: req.team.owner_id,
      created_at: req.team.created_at,
    };

    res.json({ team, members: membersRes.rows, boards: boardsRes.rows, myRole: req.membershipRole });
  } catch (err) {
    next(err);
  }
}

/** POST /api/teams/:teamId/members — invita a un usuario por email (rol member).
 *  Restringido a owner/admin por el middleware requireRole en la ruta. */
export async function inviteMember(req, res, next) {
  const { email } = req.body;

  try {
    const {
      rows: [user],
    } = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (!user) {
      return res.status(404).json({ error: 'No existe un usuario con ese email' });
    }

    const {
      rows: [existing],
    } = await pool.query('SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [
      req.team.id,
      user.id,
    ]);
    if (existing) {
      return res.status(409).json({ error: 'Ese usuario ya es miembro del equipo' });
    }

    const {
      rows: [membership],
    } = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING role, joined_at`,
      [req.team.id, user.id]
    );

    res.status(201).json({ member: { ...user, ...membership } });
  } catch (err) {
    // Carrera entre el SELECT previo y el INSERT: violación de la PK (team_id, user_id)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese usuario ya es miembro del equipo' });
    }
    next(err);
  }
}

/**
 * PATCH /api/teams/:teamId/members/:userId — cambia el rol de un miembro
 * entre 'admin' y 'member'. Restringido a owner (middleware requireRole en
 * la ruta): dejar que un admin reasigne roles abriría la puerta a que se
 * ascienda a sí mismo o a otro admin sin control.
 */
export async function updateMemberRole(req, res, next) {
  const targetUserId = Number(req.params.userId);
  const { role } = req.body;

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }
  if (targetUserId === req.team.owner_id) {
    return res.status(400).json({ error: 'El owner del equipo no puede cambiar su propio rol' });
  }

  try {
    const {
      rows: [membership],
    } = await pool.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3
       RETURNING user_id, role`,
      [role, req.team.id, targetUserId]
    );
    if (!membership) {
      return res.status(404).json({ error: 'Ese usuario no es miembro del equipo' });
    }
    res.json({ member: membership });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/teams/:teamId/members/:userId — expulsa a un miembro.
 * Restringido a owner/admin (middleware requireRole en la ruta), con dos
 * reglas extra que el middleware no puede expresar por sí solo: no se
 * puede expulsar al owner, y un admin no puede expulsar a otro admin (solo
 * el owner puede) — evita que dos admins se saquen entre sí.
 */
export async function removeMember(req, res, next) {
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }
  if (targetUserId === req.team.owner_id) {
    return res.status(400).json({ error: 'No se puede expulsar al owner del equipo' });
  }

  try {
    const {
      rows: [target],
    } = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [
      req.team.id,
      targetUserId,
    ]);
    if (!target) {
      return res.status(404).json({ error: 'Ese usuario no es miembro del equipo' });
    }
    if (target.role === 'admin' && req.membershipRole !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede expulsar a un admin' });
    }

    await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [
      req.team.id,
      targetUserId,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** POST /api/teams/:teamId/boards — crea un tablero vacío dentro del equipo.
 *  Cualquier miembro (owner/admin/member) puede crear tableros: es la misma
 *  regla que Trello, donde crear contenido no es una acción restringida. */
export async function createBoard(req, res, next) {
  const { name, description } = req.body;

  try {
    const {
      rows: [board],
    } = await pool.query(
      'INSERT INTO boards (team_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.team.id, name, description]
    );
    res.status(201).json({ board });
  } catch (err) {
    next(err);
  }
}
