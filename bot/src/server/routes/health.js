import express from 'express';

const router = express.Router();

/**
 * GET /health
 * Route de santé du bot
 */
router.get('/', (req, res) => {
    const { client } = req.app.locals;
    
    res.json({
        status: 'ok',
        bot: client?.user?.tag || 'Not ready',
        uptime: process.uptime()
    });
});

export default router;
