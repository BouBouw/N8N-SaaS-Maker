const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const apiKeyService = require('../services/apiKeyService');

const router = express.Router();

/**
 * Get API key info for an instance
 * GET /api-keys/:instanceId
 */
router.get('/:instanceId', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const keyInfo = await apiKeyService.getApiKeyInfo(instanceId, req.session.userId);
        
        res.json({ apiKey: keyInfo });
    } catch (error) {
        console.error('Get API key error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la clé API' });
    }
});

/**
 * Create API key for an instance
 * POST /api-keys/:instanceId
 */
router.post('/:instanceId', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const result = await apiKeyService.createApiKey(instanceId, req.session.userId);
        
        res.json({
            success: true,
            apiKey: result.apiKey,
            keyPreview: result.keyPreview,
            message: 'Clé API créée avec succès. Copiez-la maintenant, elle ne sera plus affichée.'
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Regenerate API key
 * PUT /api-keys/:instanceId/regenerate
 */
router.put('/:instanceId/regenerate', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const result = await apiKeyService.regenerateApiKey(instanceId, req.session.userId);
        
        res.json({
            success: true,
            apiKey: result.apiKey,
            keyPreview: result.keyPreview,
            message: 'Clé API régénérée avec succès. L\'ancienne clé ne fonctionne plus.'
        });
    } catch (error) {
        console.error('Regenerate API key error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Revoke API key
 * DELETE /api-keys/:instanceId
 */
router.delete('/:instanceId', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;
        await apiKeyService.revokeApiKey(instanceId, req.session.userId);
        
        res.json({
            success: true,
            message: 'Clé API révoquée avec succès'
        });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ error: 'Erreur lors de la révocation de la clé API' });
    }
});

/**
 * Get API usage stats
 * GET /api-keys/:instanceId/stats
 */
router.get('/:instanceId/stats', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const stats = await apiKeyService.getApiStats(instanceId, req.session.userId);
        
        res.json({ stats });
    } catch (error) {
        console.error('Get API stats error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

module.exports = router;
