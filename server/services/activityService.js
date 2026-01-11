const pool = require('../config/database');

class ActivityService {
    /**
     * Create a new activity log
     * @param {number} userId - User ID
     * @param {string} action - Action type (instance_created, instance_deleted, etc.)
     * @param {string} title - Activity title
     * @param {string} description - Activity description
     * @param {number|null} instanceId - Optional instance ID
     * @param {object|null} metadata - Optional metadata
     */
    async createActivity(userId, action, title, description = '', instanceId = null, metadata = null) {
        try {
            const [result] = await pool.query(
                `INSERT INTO activities (user_id, instance_id, action, title, description, metadata)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, instanceId, action, title, description, metadata ? JSON.stringify(metadata) : null]
            );

            console.log(`📝 Activity created: ${action} for user ${userId}`);
            return result.insertId;
        } catch (error) {
            console.error('❌ Error creating activity:', error);
            // Don't throw - activities should not break main flow
            return null;
        }
    }

    /**
     * Get recent activities for a user
     * @param {number} userId - User ID
     * @param {number} limit - Number of activities to retrieve
     */
    async getUserActivities(userId, limit = 10) {
        try {
            const [activities] = await pool.query(
                `SELECT 
                    a.*,
                    i.name as instance_name,
                    i.uuid as instance_uuid,
                    i.subdomain as instance_subdomain
                 FROM activities a
                 LEFT JOIN n8n_instances i ON a.instance_id = i.id
                 WHERE a.user_id = ? AND a.action = 'workflow_executed'
                 ORDER BY a.created_at DESC
                 LIMIT ?`,
                [userId, limit]
            );

            return activities;
        } catch (error) {
            console.error('❌ Error fetching activities:', error);
            return [];
        }
    }

    /**
     * Helper methods for common actions
     */
    async logInstanceCreated(userId, instanceId, instanceName) {
        return this.createActivity(
            userId,
            'instance_created',
            'Instance créée',
            `L'instance "${instanceName}" a été créée avec succès`,
            instanceId,
            { instance_name: instanceName }
        );
    }

    async logInstanceDeleted(userId, instanceId, instanceName) {
        return this.createActivity(
            userId,
            'instance_deleted',
            'Instance supprimée',
            `L'instance "${instanceName}" a été supprimée`,
            instanceId,
            { instance_name: instanceName }
        );
    }

    async logInstanceStarted(userId, instanceId, instanceName) {
        return this.createActivity(
            userId,
            'instance_started',
            'Instance démarrée',
            `L'instance "${instanceName}" est maintenant en cours d'exécution`,
            instanceId,
            { instance_name: instanceName }
        );
    }

    async logInstanceStopped(userId, instanceId, instanceName) {
        return this.createActivity(
            userId,
            'instance_stopped',
            'Instance arrêtée',
            `L'instance "${instanceName}" a été arrêtée`,
            instanceId,
            { instance_name: instanceName }
        );
    }

    async logInstanceRestarted(userId, instanceId, instanceName) {
        return this.createActivity(
            userId,
            'instance_restarted',
            'Instance redémarrée',
            `L'instance "${instanceName}" a été redémarrée`,
            instanceId,
            { instance_name: instanceName }
        );
    }

    async logInstanceError(userId, instanceId, instanceName, errorMessage) {
        return this.createActivity(
            userId,
            'instance_error',
            'Erreur d\'instance',
            `Erreur sur l'instance "${instanceName}": ${errorMessage}`,
            instanceId,
            { instance_name: instanceName, error: errorMessage }
        );
    }
}

module.exports = new ActivityService();
