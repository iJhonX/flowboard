/**
 * Middleware genérico de autorización por rol (Fase 7). Debe ir DESPUÉS de
 * `requireTeamMember` o `requireBoardMember` — ambos dejan `req.membershipRole`
 * ('owner' | 'admin' | 'member') antes de llegar aquí, así que este
 * middleware no necesita saber si la ruta es de equipo o de tablero.
 *
 * Uso: router.delete('/teams/:teamId/members/:userId', requireTeamMember, requireRole('owner'), removeMember)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.membershipRole)) {
      return res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
    }
    next();
  };
}
