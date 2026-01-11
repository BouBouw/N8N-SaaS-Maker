const apiKeyService = require('../services/apiKeyService');

/**
 * Middleware to authenticate API requests using API key
 */
async function authenticateApiKey(req, res, next) {
    try {
        // Get API key from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'API key manquante. Format: Authorization: Bearer YOUR_API_KEY'
            });
        }

        const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Validate API key
        const keyInfo = await apiKeyService.validateApiKey(apiKey);

        if (!keyInfo) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Clé API invalide ou révoquée'
            });
        }

        // Check subscription plan
        if (keyInfo.subscription_plan !== 'pro' && keyInfo.subscription_plan !== 'business') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Votre plan ne permet pas l\'utilisation de l\'API'
            });
        }

        // Attach key info to request
        req.apiKeyInfo = keyInfo;
        next();
    } catch (error) {
        console.error('API Key authentication error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
}

module.exports = { authenticateApiKey };
