const express = require('express');
const activityService = require('../services/activityService');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get user activities
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const activities = await activityService.getUserActivities(req.session.userId, limit);

        res.json({ activities });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des activités' });
    }
});

module.exports = router;
