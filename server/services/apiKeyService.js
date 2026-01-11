const crypto = require('crypto');
const pool = require('../config/database');

class ApiKeyService {
    /**
     * Generate a secure API key
     */
    generateApiKey() {
        const prefix = 'sk_live_';
        const randomBytes = crypto.randomBytes(32).toString('hex');
        return prefix + randomBytes;
    }

    /**
     * Hash API key for storage
     */
    hashApiKey(apiKey) {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    /**
     * Create API key for an instance
     */
    async createApiKey(instanceId, userId) {
        try {
            // Check if instance belongs to user and has Pro/Business plan
            const [instances] = await pool.query(
                `SELECT i.*, COALESCE(us.plan, 'free') as subscription_plan
                 FROM n8n_instances i
                 JOIN users u ON i.user_id = u.id
                 LEFT JOIN user_subscriptions us ON u.id = us.user_id
                 WHERE i.id = ? AND i.user_id = ?`,
                [instanceId, userId]
            );

            if (instances.length === 0) {
                throw new Error('Instance non trouvée');
            }

            const instance = instances[0];
            const plan = instance.subscription_plan;

            if (plan !== 'pro' && plan !== 'business') {
                throw new Error('L\'API nécessite un plan Pro ou Business');
            }

            // Check if API key already exists
            const [existing] = await pool.query(
                'SELECT id FROM api_keys WHERE instance_id = ?',
                [instanceId]
            );

            if (existing.length > 0) {
                throw new Error('Une clé API existe déjà pour cette instance. Veuillez la régénérer.');
            }

            // Generate new API key
            const apiKey = this.generateApiKey();
            const hashedKey = this.hashApiKey(apiKey);
            const keyPreview = apiKey.substring(0, 20) + '...';

            await pool.query(
                `INSERT INTO api_keys (instance_id, api_key, key_preview)
                 VALUES (?, ?, ?)`,
                [instanceId, hashedKey, keyPreview]
            );

            console.log(`✅ API key created for instance ${instanceId}`);

            return {
                apiKey, // Return plain key only once
                keyPreview
            };
        } catch (error) {
            console.error('❌ Error creating API key:', error);
            throw error;
        }
    }

    /**
     * Regenerate API key
     */
    async regenerateApiKey(instanceId, userId) {
        try {
            // Delete old key
            await pool.query(
                `DELETE FROM api_keys 
                 WHERE instance_id IN (
                     SELECT id FROM n8n_instances WHERE id = ? AND user_id = ?
                 )`,
                [instanceId, userId]
            );

            // Create new key
            return await this.createApiKey(instanceId, userId);
        } catch (error) {
            console.error('❌ Error regenerating API key:', error);
            throw error;
        }
    }

    /**
     * Validate API key and get instance info
     */
    async validateApiKey(apiKey) {
        try {
            const hashedKey = this.hashApiKey(apiKey);

            const [keys] = await pool.query(
                `SELECT 
                    k.id as key_id,
                    k.instance_id,
                    k.is_active,
                    i.name as instance_name,
                    i.docker_port,
                    i.status as instance_status,
                    i.owner_password,
                    u.email as owner_email,
                    COALESCE(us.plan, 'free') as subscription_plan
                 FROM api_keys k
                 JOIN n8n_instances i ON k.instance_id = i.id
                 JOIN users u ON i.user_id = u.id
                 LEFT JOIN user_subscriptions us ON u.id = us.user_id
                 WHERE k.api_key = ? AND k.is_active = TRUE`,
                [hashedKey]
            );

            if (keys.length === 0) {
                return null;
            }

            const keyInfo = keys[0];

            // Check if instance is running
            if (keyInfo.instance_status !== 'running') {
                throw new Error('L\'instance N8N n\'est pas en cours d\'exécution');
            }

            // Update last used timestamp and request count
            await pool.query(
                `UPDATE api_keys 
                 SET last_used_at = NOW(), request_count = request_count + 1
                 WHERE id = ?`,
                [keyInfo.key_id]
            );

            return keyInfo;
        } catch (error) {
            console.error('❌ Error validating API key:', error);
            throw error;
        }
    }

    /**
     * Get API key info for an instance
     */
    async getApiKeyInfo(instanceId, userId) {
        try {
            const [keys] = await pool.query(
                `SELECT 
                    k.id,
                    k.key_preview,
                    k.is_active,
                    k.created_at,
                    k.last_used_at,
                    k.request_count
                 FROM api_keys k
                 JOIN n8n_instances i ON k.instance_id = i.id
                 WHERE k.instance_id = ? AND i.user_id = ?`,
                [instanceId, userId]
            );

            return keys[0] || null;
        } catch (error) {
            console.error('❌ Error getting API key info:', error);
            throw error;
        }
    }

    /**
     * Revoke API key
     */
    async revokeApiKey(instanceId, userId) {
        try {
            await pool.query(
                `UPDATE api_keys k
                 JOIN n8n_instances i ON k.instance_id = i.id
                 SET k.is_active = FALSE
                 WHERE k.instance_id = ? AND i.user_id = ?`,
                [instanceId, userId]
            );

            console.log(`✅ API key revoked for instance ${instanceId}`);
        } catch (error) {
            console.error('❌ Error revoking API key:', error);
            throw error;
        }
    }

    /**
     * Log API request
     */
    async logApiRequest(keyId, instanceId, workflowId, endpoint, method, statusCode, responseTime, errorMessage = null) {
        try {
            await pool.query(
                `INSERT INTO api_logs 
                 (api_key_id, instance_id, workflow_id, endpoint, method, status_code, response_time, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [keyId, instanceId, workflowId, endpoint, method, statusCode, responseTime, errorMessage]
            );
        } catch (error) {
            console.error('❌ Error logging API request:', error);
            // Don't throw - logging failures shouldn't break API calls
        }
    }

    /**
     * Get API usage stats
     */
    async getApiStats(instanceId, userId) {
        try {
            const [stats] = await pool.query(
                `SELECT 
                    COUNT(*) as total_requests,
                    COUNT(DISTINCT DATE(l.created_at)) as active_days,
                    AVG(response_time) as avg_response_time,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
                 FROM api_logs l
                 JOIN api_keys k ON l.api_key_id = k.id
                 JOIN n8n_instances i ON k.instance_id = i.id
                 WHERE k.instance_id = ? AND i.user_id = ?`,
                [instanceId, userId]
            );

            return stats[0];
        } catch (error) {
            console.error('❌ Error getting API stats:', error);
            throw error;
        }
    }
}

module.exports = new ApiKeyService();
