const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const crypto = require('crypto');

const router = express.Router();

// Get io instance for WebSocket events
let io;
setTimeout(() => {
    io = require('../server').io;
}, 1000);

/**
 * Webhook receiver for N8N workflow executions
 * N8N can call this after each workflow execution to track stats
 */
router.post('/n8n/execution', async (req, res) => {
    try {
        const { 
            workflowId, 
            workflowName,
            executionId, 
            finished,
            mode,
            startedAt,
            stoppedAt,
            instancePort // Custom field to identify the instance
        } = req.body;

        console.log('📥 Webhook N8N execution received:', {
            workflowId,
            workflowName,
            executionId,
            finished,
            instancePort
        });

        // Find instance by port
        const [instances] = await pool.query(
            'SELECT id, user_id, name FROM n8n_instances WHERE docker_port = ?',
            [instancePort]
        );

        if (instances.length === 0) {
            console.log('⚠️ Instance not found for port:', instancePort);
            return res.status(404).json({ error: 'Instance not found' });
        }

        const instance = instances[0];

        // Create activity entry
        await pool.query(
            `INSERT INTO activities (
                user_id, 
                instance_id, 
                action,
                title,
                description,
                metadata,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                instance.user_id,
                instance.id,
                'workflow_executed',
                `Workflow: ${workflowName || 'Unknown'}`,
                `Exécution ${finished ? 'réussie' : 'en cours'}`,
                JSON.stringify({
                    workflow_id: workflowId,
                    workflow_name: workflowName,
                    execution_id: executionId,
                    status: finished ? 'success' : 'running',
                    mode: mode,
                    duration: stoppedAt && startedAt 
                        ? new Date(stoppedAt) - new Date(startedAt) 
                        : null
                })
            ]
        );

        console.log('✅ Workflow execution tracked in activities');

        // Emit WebSocket event to user
        if (io) {
            io.to(`user:${instance.user_id}`).emit('workflow:executed', {
                instanceId: instance.id,
                workflowId,
                workflowName,
                executionId,
                status: finished ? 'success' : 'running',
                timestamp: new Date()
            });
            console.log('📡 WebSocket event emitted to user:', instance.user_id);
        }

        res.json({ 
            success: true, 
            message: 'Execution tracked successfully' 
        });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

/**
 * Sync workflow executions from N8N instance
 * Manual sync endpoint to fetch all executions
 */
router.post('/n8n/sync-executions', async (req, res) => {
    try {
        const { instanceId } = req.body;
        const userId = req.session?.userId;

        if (!instanceId || !userId) {
            return res.status(400).json({ error: 'Instance ID required and user must be authenticated' });
        }

        // Get instance
        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ? AND user_id = ?',
            [instanceId, userId]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const instance = instances[0];
        const n8nUrl = `http://localhost:${instance.docker_port}`;

        console.log('🔍 Syncing executions for instance:', instance.name);
        console.log('🌐 N8N URL:', n8nUrl);

        // Get user credentials for N8N authentication
        const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [instance.user_id]);
        const userEmail = users[0]?.email;
        const password = instance.owner_password;

        console.log('👤 Email:', userEmail ? 'Found' : 'Missing');
        console.log('🔑 Password:', password ? 'Found' : 'Missing');

        if (!password || !userEmail) {
            console.log('⚠️ Missing credentials, skipping instance');
            return res.status(200).json({ 
                success: false,
                synced: 0,
                total: 0,
                message: 'N8N credentials not available. Please reconnect to this instance.',
                requiresAuth: true
            });
        }

        // Login to N8N to get session cookies
        let cookies = '';
        try {
            console.log('🔐 Attempting N8N login...');
            console.log('🔐 Attempting N8N login...');
            const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                emailOrLdapLoginId: userEmail,
                password: password
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                validateStatus: () => true
            });

            console.log('📥 Login response status:', loginResponse.status);
            console.log('🍪 Set-Cookie header:', loginResponse.headers['set-cookie'] ? 'Present' : 'Missing');

            if (loginResponse.status === 200 && loginResponse.headers['set-cookie']) {
                cookies = loginResponse.headers['set-cookie'].join('; ');
                console.log('✅ N8N authentication successful');
            } else {
                console.log('❌ N8N authentication failed');
                console.log('📄 Response data:', JSON.stringify(loginResponse.data));
                return res.status(200).json({ 
                    success: false,
                    synced: 0,
                    total: 0,
                    message: 'N8N authentication failed. Please check your credentials.',
                    requiresAuth: true
                });
            }
        } catch (loginError) {
            console.error('❌ N8N login error:', loginError.message);
            return res.status(200).json({ 
                success: false,
                synced: 0,
                total: 0,
                message: 'Failed to connect to N8N instance',
                error: loginError.message
            });
        }

        // Fetch executions from N8N with authentication
        const response = await axios.get(`${n8nUrl}/rest/executions`, {
            headers: {
                'Accept': 'application/json',
                'Cookie': cookies
            },
            timeout: 10000
        });

        console.log('📥 N8N Response status:', response.status);
        console.log('📥 N8N Response data type:', typeof response.data);
        console.log('📥 N8N Response data:', JSON.stringify(response.data).substring(0, 200));

        // Handle different response formats from N8N
        let executions = [];
        if (Array.isArray(response.data)) {
            executions = response.data;
        } else if (response.data && response.data.data && Array.isArray(response.data.data.results)) {
            // N8N v1.x format: { data: { results: [...], count: N } }
            executions = response.data.data.results;
        } else if (response.data && Array.isArray(response.data.data)) {
            executions = response.data.data;
        } else if (response.data && response.data.results) {
            executions = response.data.results;
        }

        console.log('📊 Found', executions.length, 'executions');
        let syncedCount = 0;

        // Add each execution as activity if not already tracked
        for (const execution of executions) {
            // Check if already tracked (use metadata field instead of details)
            const [existing] = await pool.query(
                `SELECT id FROM activities 
                 WHERE user_id = ? 
                 AND instance_id = ? 
                 AND metadata LIKE ?`,
                [userId, instanceId, `%"execution_id":"${execution.id}"%`]
            );

            if (existing.length === 0) {
                console.log('📝 Inserting execution:', execution.id, 'for user:', userId, 'instance:', instanceId);
                
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
                console.log('✅ Execution inserted successfully');
                
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
            } else {
                console.log('⏭️ Execution', execution.id, 'already tracked');
            }
        }

        console.log(`✅ Synced ${syncedCount} executions from N8N`);

        res.json({ 
            success: true, 
            synced: syncedCount,
            total: executions.length,
            message: `${syncedCount} nouvelles exécutions synchronisées` 
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({ 
            error: 'Failed to sync executions',
            details: error.message 
        });
    }
});

module.exports = router;
