const axios = require('axios');
const pool = require('../config/database');

// Get io instance for WebSocket events
let io;
setTimeout(() => {
    try {
        io = require('../server').io;
    } catch (error) {
        console.log('⚠️ IO not available yet');
    }
}, 2000);

/**
 * Auto-sync executions for a specific instance
 */
async function syncInstanceExecutions(instanceId, userId) {
    try {
        // Get instance
        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ? AND user_id = ?',
            [instanceId, userId]
        );

        if (instances.length === 0) {
            return { success: false, error: 'Instance not found' };
        }

        const instance = instances[0];
        
        // Skip if instance is not running
        if (instance.status !== 'running') {
            return { success: false, error: 'Instance not running' };
        }

        const n8nUrl = `http://localhost:${instance.docker_port}`;

        // Get user credentials for N8N authentication
        const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
        const userEmail = users[0]?.email;
        const password = instance.owner_password;

        if (!password || !userEmail) {
            return { success: false, error: 'Missing credentials' };
        }

        // Login to N8N to get session cookies
        let cookies = '';
        try {
            const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                emailOrLdapLoginId: userEmail,
                password: password
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
                validateStatus: () => true
            });

            if (loginResponse.status === 200 && loginResponse.headers['set-cookie']) {
                cookies = loginResponse.headers['set-cookie'].join('; ');
            } else {
                return { success: false, error: 'Authentication failed' };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }

        // Fetch executions from N8N with authentication
        const response = await axios.get(`${n8nUrl}/rest/executions`, {
            headers: {
                'Accept': 'application/json',
                'Cookie': cookies
            },
            timeout: 5000
        });

        // Handle different response formats from N8N
        let executions = [];
        if (Array.isArray(response.data)) {
            executions = response.data;
        } else if (response.data && response.data.data && Array.isArray(response.data.data.results)) {
            executions = response.data.data.results;
        } else if (response.data && Array.isArray(response.data.data)) {
            executions = response.data.data;
        } else if (response.data && response.data.results) {
            executions = response.data.results;
        }

        let syncedCount = 0;

        // Add each execution as activity if not already tracked
        for (const execution of executions) {
            // Check if already tracked
            const [existing] = await pool.query(
                `SELECT id FROM activities 
                 WHERE user_id = ? 
                 AND instance_id = ? 
                 AND metadata LIKE ?`,
                [userId, instanceId, `%"execution_id":"${execution.id}"%`]
            );

            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO activities (
                        user_id, 
                        instance_id, 
                        action,
                        title,
                        description,
                        metadata,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        instanceId,
                        'workflow_executed',
                        `Workflow: ${execution.workflowData?.name || execution.workflowId || 'Unknown'}`,
                        `Exécution ${execution.status === 'success' ? 'réussie' : 'échouée'}`,
                        JSON.stringify({
                            workflow_id: execution.workflowId,
                            workflow_name: execution.workflowData?.name || 'Unknown',
                            execution_id: execution.id,
                            status: execution.status,
                            mode: execution.mode
                        }),
                        execution.startedAt || new Date()
                    ]
                );
                syncedCount++;
                
                // Emit WebSocket event to user
                if (io) {
                    io.to(`user:${userId}`).emit('workflow:executed', {
                        instanceId: instanceId,
                        workflowId: execution.workflowId,
                        workflowName: execution.workflowData?.name || 'Unknown',
                        executionId: execution.id,
                        status: execution.status,
                        timestamp: new Date(execution.startedAt || new Date())
                    });
                }
            }
        }

        return { 
            success: true, 
            synced: syncedCount,
            total: executions.length
        };

    } catch (error) {
        console.error('❌ Auto-sync error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Auto-sync all running instances for all users
 * Called periodically by background job
 */
async function autoSyncAllInstances() {
    try {
        // Get all running instances
        const [instances] = await pool.query(
            `SELECT id, user_id, name FROM n8n_instances WHERE status = 'running'`
        );

        console.log(`🔄 Auto-syncing ${instances.length} running instances...`);

        for (const instance of instances) {
            const result = await syncInstanceExecutions(instance.id, instance.user_id);
            if (result.success && result.synced > 0) {
                console.log(`  ✅ ${instance.name}: ${result.synced} new executions`);
            }
        }

    } catch (error) {
        console.error('❌ Auto-sync all error:', error);
    }
}

// Start auto-sync background job (every 10 seconds)
let syncInterval;
function startAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    console.log('🔄 Starting auto-sync service (every 10 seconds)...');
    
    // Run immediately
    setTimeout(autoSyncAllInstances, 5000);
    
    // Then every 10 seconds
    syncInterval = setInterval(autoSyncAllInstances, 10000);
}

function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        console.log('🛑 Auto-sync service stopped');
    }
}

module.exports = {
    syncInstanceExecutions,
    autoSyncAllInstances,
    startAutoSync,
    stopAutoSync
};
