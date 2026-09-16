import { Router } from 'express';
import {
  createTeam,
  listMyTeams,
  getTeamDetail,
  inviteMember,
  updateMemberRole,
  removeMember,
  createBoard,
} from '../controllers/teams.controller.js';
import {
  createTeamSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  createBoardSchema,
} from '../validators/team.schemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTeamMember } from '../middleware/requireTeamMember.js';
import { requireRole } from '../middleware/requireRole.js';

export const teamsRouter = Router();

// Todas las rutas de teams requieren sesión
teamsRouter.use(requireAuth);

teamsRouter.post('/teams', validate(createTeamSchema), createTeam);
teamsRouter.get('/teams', listMyTeams);
teamsRouter.get('/teams/:teamId', requireTeamMember, getTeamDetail);
teamsRouter.post(
  '/teams/:teamId/members',
  requireTeamMember,
  requireRole('owner', 'admin'),
  validate(inviteMemberSchema),
  inviteMember
);
teamsRouter.patch(
  '/teams/:teamId/members/:userId',
  requireTeamMember,
  requireRole('owner'),
  validate(updateMemberRoleSchema),
  updateMemberRole
);
teamsRouter.delete(
  '/teams/:teamId/members/:userId',
  requireTeamMember,
  requireRole('owner', 'admin'),
  removeMember
);
teamsRouter.post('/teams/:teamId/boards', requireTeamMember, validate(createBoardSchema), createBoard);
