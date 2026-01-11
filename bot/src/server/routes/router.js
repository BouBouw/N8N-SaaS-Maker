import express from 'express';
import healthRouter from './health.js';
import forumRouter from './forum.js';
import roleRouter from './role.js';
import userRouter from './user.js';

const router = express.Router();

// Monter les routes
router.use('/health', healthRouter);
router.use('/forum-post', forumRouter);
router.use('/discord-role', roleRouter);
router.use('/discord-user', userRouter);

export default router;

