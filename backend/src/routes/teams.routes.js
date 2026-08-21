import { Router } from 'express';
import { createTeam, listMyTeams, getTeamDetail, inviteMember, createBoard } from '../controllers/teams.controller.js';
import { createTeamSchema, inviteMemberSchema, createBoardSchema } from '../validators/team.schemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTeamMember } from '../middleware/requireTeamMember.js';

export const teamsRouter = Router();

// Todas las rutas de teams requieren sesión
teamsRouter.use(requireAuth);

teamsRouter.post('/teams', validate(createTeamSchema), createTeam);
teamsRouter.get('/teams', listMyTeams);
teamsRouter.get('/teams/:teamId', requireTeamMember, getTeamDetail);
teamsRouter.post('/teams/:teamId/members', requireTeamMember, validate(inviteMemberSchema), inviteMember);
teamsRouter.post('/teams/:teamId/boards', requireTeamMember, validate(createBoardSchema), createBoard);
