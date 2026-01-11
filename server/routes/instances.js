const express = require('express');
const pool = require('../config/database');
const dockerService = require('../services/dockerService');
const activityService = require('../services/activityService');
const memberService = require('../services/memberService');
const emailService = require('../services/emailService');
const nginxService = require('../services/nginxService');
const { isAuthenticated } = require('../middleware/auth');

// Helper function to get user-friendly error messages
function getErrorMessage(error) {
    if (error.message === 'DOCKER_NOT_RUNNING') {
        return 'Docker Desktop n\'est pas démarré. Veuillez lancer Docker Desktop et réessayer.';
    }
    if (error.code === 'ENOENT' && error.message.includes('docker_engine')) {
        return 'Docker Desktop n\'est pas installé ou n\'est pas démarré sur votre machine.';
    }
    if (error.message.includes('Cannot connect to the Docker daemon')) {
        return 'Impossible de se connecter au service Docker. Vérifiez que Docker Desktop est en cours d\'exécution.';
    }
    return error.message || 'Erreur lors de la création de l\'instance';
}

const router = express.Router();

// Get user subscription info
router.get('/subscription', isAuthenticated, async (req, res) => {
    try {
        const [subscriptions] = await pool.query(
            'SELECT * FROM user_subscriptions WHERE user_id = ?',
            [req.session.userId]
        );

        if (subscriptions.length === 0) {
            // Create default free plan
            await pool.query(
                'INSERT INTO user_subscriptions (user_id, plan) VALUES (?, ?)',
                [req.session.userId, 'free']
            );

            return res.json({
                plan: 'free',
                max_instances: 1,
                storage_per_instance: 5,
                ram_per_instance: 6,
                bandwidth_per_instance: 2,
                api_enabled: false
            });
        }

        res.json(subscriptions[0]);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'abonnement' });
    }
});

// Get dashboard statistics (MUST be before /:identifier route)
router.get('/dashboard-stats', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const period = req.query.period || 'week'; // 'week' or 'month'
        const days = period === 'month' ? 30 : 7;

        console.log('📊 Dashboard stats - userId:', userId);

        // Get instance counts
        const [instanceCounts] = await pool.query(
            `SELECT 
                COUNT(*) as total_instances,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_instances
             FROM n8n_instances 
             WHERE user_id = ?`,
            [userId]
        );

        console.log('📊 Instance counts:', instanceCounts[0]);

        // Get API stats from api_keys table
        const [apiStats] = await pool.query(
            `SELECT 
                COALESCE(SUM(ak.request_count), 0) as total_requests
             FROM api_keys ak
             JOIN n8n_instances i ON ak.instance_id = i.id
             WHERE i.user_id = ?`,
            [userId]
        );

        // Get activity data for the specified period
        let periodActivity;
        if (period === 'month') {
            // Group by week for monthly view (4 weeks)
            [periodActivity] = await pool.query(
                `SELECT 
                    FLOOR(DATEDIFF(NOW(), created_at) / 7) + 1 as week_number,
                    COUNT(*) as activity_count
                 FROM activities
                 WHERE user_id = ? 
                 AND action = 'workflow_executed'
                 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY week_number
                 ORDER BY week_number ASC`,
                [userId]
            );
        } else {
            // Daily data for weekly view
            [periodActivity] = await pool.query(
                `SELECT 
                    DATE(created_at) as activity_date,
                    COUNT(*) as activity_count
                 FROM activities
                 WHERE user_id = ? 
                 AND action = 'workflow_executed'
                 AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                 GROUP BY DATE(created_at)
                 ORDER BY activity_date ASC`,
                [userId, days]
            );
        }

        // Get total workflow executions (from activities)
        const [workflowStats] = await pool.query(
            `SELECT COUNT(*) as total_workflows
             FROM activities
             WHERE user_id = ?
             AND action = 'workflow_executed'`,
            [userId]
        );

        console.log('📊 Workflow stats:', workflowStats[0]);
        
        // Debug: Check all actions
        const [allActions] = await pool.query(
            `SELECT action, COUNT(*) as count FROM activities WHERE user_id = ? GROUP BY action`,
            [userId]
        );
        console.log('📊 All actions for user:', allActions);

        res.json({
            instances: {
                total: instanceCounts[0].total_instances,
                running: instanceCounts[0].running_instances
            },
            api: {
                total_requests: parseInt(apiStats[0].total_requests),
                avg_response_time: 0 // Not tracked in current schema
            },
            workflows: {
                total_executions: workflowStats[0].total_workflows
            },
            activity: periodActivity,
            period: period
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Get all user instances
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Get instances owned by user
        const [ownedInstances] = await pool.query(
            `SELECT id, uuid, name, subdomain, container_id, docker_port, status, 
                    storage_limit, storage_used, ram_limit, bandwidth_limit, bandwidth_used,
                    created_at, last_activity, user_id as owner_id
             FROM n8n_instances 
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        // Get instances where user is a member
        const [sharedInstances] = await pool.query(
            `SELECT i.id, i.uuid, i.name, i.subdomain, i.container_id, i.docker_port, i.status,
                    i.storage_limit, i.storage_used, i.ram_limit, i.bandwidth_limit, i.bandwidth_used,
                    i.created_at, i.last_activity, i.user_id as owner_id,
                    im.role as member_role
             FROM n8n_instances i
             INNER JOIN instance_members im ON i.id = im.instance_id
             WHERE im.user_id = ? AND im.status = 'active'
             ORDER BY i.created_at DESC`,
            [req.session.userId]
        );

        // Combine both lists
        const allInstances = [...ownedInstances, ...sharedInstances];

        // Update status from Docker
        for (let instance of allInstances) {
            if (instance.container_id) {
                const status = await dockerService.getContainerStatus(instance.container_id);
                if (status !== instance.status) {
                    await pool.query(
                        'UPDATE n8n_instances SET status = ? WHERE id = ?',
                        [status, instance.id]
                    );
                    instance.status = status;
                }
            }
            
            // Mark if instance is shared
            instance.is_shared = instance.owner_id !== req.session.userId;
        }

        res.json({ instances: allInstances });
    } catch (error) {
        console.error('Get instances error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des instances' });
    }
});

// Get single instance (by ID or UUID)
router.get('/:identifier', isAuthenticated, async (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Check if identifier is UUID (contains dashes) or numeric ID
        const isUUID = identifier.includes('-');
        const field = isUUID ? 'uuid' : 'id';
        
        // First try to get instance where user is owner
        let [instances] = await pool.query(
            `SELECT * FROM n8n_instances 
             WHERE ${field} = ? AND user_id = ?`,
            [identifier, req.session.userId]
        );

        let isMember = false;
        let memberRole = null;

        // If not found as owner, check if user is a member
        if (instances.length === 0) {
            [instances] = await pool.query(
                `SELECT i.*, im.role as member_role
                 FROM n8n_instances i
                 INNER JOIN instance_members im ON i.id = im.instance_id
                 WHERE i.${field} = ? AND im.user_id = ? AND im.status = 'active'`,
                [identifier, req.session.userId]
            );
            
            if (instances.length > 0) {
                isMember = true;
                memberRole = instances[0].member_role;
            }
        }

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];
        instance.is_shared = isMember;
        instance.user_role = memberRole || 'owner';

        // Get live stats from Docker
        if (instance.container_id && instance.status === 'running') {
            try {
                const stats = await dockerService.getContainerStats(instance.container_id);
                instance.live_stats = stats;
            } catch (error) {
                console.error('Error getting container stats:', error);
                instance.live_stats = null;
            }
        }

        res.json({ instance });
    } catch (error) {
        console.error('Get instance error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'instance' });
    }
});

// Create new instance
router.post('/', isAuthenticated, async (req, res) => {
    try {

        // Get user subscription
        const [subscriptions] = await pool.query(
            'SELECT * FROM user_subscriptions WHERE user_id = ?',
            [req.session.userId]
        );

        let subscription;
        if (subscriptions.length === 0) {
            // Create default free plan
            await pool.query(
                'INSERT INTO user_subscriptions (user_id, plan) VALUES (?, ?)',
                [req.session.userId, 'free']
            );
            subscription = {
                plan: 'free',
                max_instances: 1,
                storage_per_instance: 5,
                ram_per_instance: 6,
                bandwidth_per_instance: 2
            };
        } else {
            subscription = subscriptions[0];
        }

        // Check instance limit
        const [existingInstances] = await pool.query(
            'SELECT COUNT(*) as count FROM n8n_instances WHERE user_id = ?',
            [req.session.userId]
        );

        if (existingInstances[0].count >= subscription.max_instances) {
            return res.status(403).json({ 
                error: `Limite d'instances atteinte (${subscription.max_instances} max pour le plan ${subscription.plan})` 
            });
        }

        // Create instance record
        const uuid = require('uuid').v4();
        
        // Generate subdomain from UUID only (first 12 characters for shorter URL)
        const subdomain = uuid.split('-').slice(0, 2).join('');
        
        // Use first 8 characters of UUID as instance name
        const name = `instance-${uuid.split('-')[0]}`;
        
        const [result] = await pool.query(
            `INSERT INTO n8n_instances 
             (user_id, uuid, name, subdomain, status, storage_limit, ram_limit, bandwidth_limit) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                uuid,
                name,
                subdomain,
                'creating',
                subscription.storage_per_instance,
                subscription.ram_per_instance,
                subscription.bandwidth_per_instance
            ]
        );

        const instanceId = result.insertId;

        // Get user info for N8N setup
        const [users] = await pool.query(
            'SELECT email, name FROM users WHERE id = ?',
            [req.session.userId]
        );
        const user = users[0];

        // Create Docker container (async)
        dockerService.createN8NInstance({
            instanceName: name,
            userId: req.session.userId,
            userEmail: user.email,
            userName: user.name,
            ramLimit: subscription.ram_per_instance,
            storageLimit: subscription.storage_per_instance
        })
        .then(async (containerInfo) => {
            // Update instance with container info
            await pool.query(
                `UPDATE n8n_instances 
                 SET container_id = ?, container_name = ?, docker_port = ?, status = ?, owner_password = ?
                 WHERE id = ?`,
                [
                    containerInfo.containerId,
                    containerInfo.containerName,
                    containerInfo.port,
                    'running',
                    containerInfo.password,
                    instanceId
                ]
            );

            // Log activity
            await activityService.logInstanceCreated(req.session.userId, instanceId, name);

            // Configure Nginx subdomain with SSL automatically
            console.log(`🌐 Configuration automatique du sous-domaine: ${subdomain}.logicai.fr`);
            try {
                const nginxResult = await nginxService.setupSubdomain(subdomain, containerInfo.port);
                
                if (nginxResult.success) {
                    console.log(`✅ Sous-domaine configuré: ${nginxResult.url}`);
                    
                    // Update instance with public URL
                    await pool.query(
                        'UPDATE n8n_instances SET public_url = ? WHERE id = ?',
                        [nginxResult.url, instanceId]
                    );

                    // Send email with instance credentials (with public URL)
                    try {
                        await emailService.sendInstanceCreatedEmail(user.email, user.name, {
                            instanceName: name,
                            instanceUrl: nginxResult.url,
                            email: user.email,
                            password: containerInfo.password,
                            port: containerInfo.port
                        });
                        console.log(`📧 Credentials email sent to ${user.email}`);
                    } catch (emailError) {
                        console.error('❌ Error sending credentials email:', emailError);
                    }
                } else {
                    console.error(`❌ Échec de la configuration du sous-domaine: ${nginxResult.error}`);
                    console.error('   L\'instance reste accessible via le port local');
                    
                    // Send email with localhost URL as fallback
                    try {
                        await emailService.sendInstanceCreatedEmail(user.email, user.name, {
                            instanceName: name,
                            instanceUrl: `http://localhost:${containerInfo.port}`,
                            email: user.email,
                            password: containerInfo.password,
                            port: containerInfo.port
                        });
                        console.log(`📧 Credentials email sent to ${user.email} (localhost URL)`);
                    } catch (emailError) {
                        console.error('❌ Error sending credentials email:', emailError);
                    }
                }
            } catch (nginxError) {
                console.error('❌ Erreur critique lors de la configuration Nginx:', nginxError);
                // Don't fail the instance creation, just log the error
            }

            console.log(`✅ Instance ${name} created successfully`);
        })
        .catch(async (error) => {
            // Update instance status to error
            await pool.query(
                'UPDATE n8n_instances SET status = ? WHERE id = ?',
                ['error', instanceId]
            );

            console.error(`❌ Failed to create instance ${name}:`, error);
        });

        res.json({
            success: true,
            instanceId,
            message: 'Instance en cours de création...'
        });

    } catch (error) {
        console.error('Create instance error:', error);
        const errorMessage = getErrorMessage(error);
        res.status(500).json({ error: errorMessage });
    }
});

// Start instance
router.post('/:id/start', isAuthenticated, async (req, res) => {
    try {
        // Check permissions - owner, admin, or editor can start
        const userRole = await memberService.getMemberRole(req.session.userId, req.params.id);
        if (!userRole || userRole === 'viewer') {
            return res.status(403).json({ error: 'Vous n\'avez pas la permission de démarrer cette instance' });
        }

        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ?',
            [req.params.id]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];

        if (!instance.container_id) {
            return res.status(400).json({ error: 'Container non trouvé' });
        }

        await dockerService.startContainer(instance.container_id);
        await pool.query(
            'UPDATE n8n_instances SET status = ?, last_activity = NOW() WHERE id = ?',
            ['running', instance.id]
        );

        // Log activity
        await activityService.logInstanceStarted(req.session.userId, instance.id, instance.name);

        res.json({ success: true, message: 'Instance démarrée' });
    } catch (error) {
        console.error('Start instance error:', error);
        res.status(500).json({ error: 'Erreur lors du démarrage de l\'instance' });
    }
});

// Stop instance
router.post('/:id/stop', isAuthenticated, async (req, res) => {
    try {
        // Check permissions - owner, admin, or editor can stop
        const userRole = await memberService.getMemberRole(req.session.userId, req.params.id);
        if (!userRole || userRole === 'viewer') {
            return res.status(403).json({ error: 'Vous n\'avez pas la permission d\'arrêter cette instance' });
        }

        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ?',
            [req.params.id]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];

        if (!instance.container_id) {
            return res.status(400).json({ error: 'Container non trouvé' });
        }

        await dockerService.stopContainer(instance.container_id);
        await pool.query(
            'UPDATE n8n_instances SET status = ? WHERE id = ?',
            ['stopped', instance.id]
        );

        // Log activity
        await activityService.logInstanceStopped(req.session.userId, instance.id, instance.name);

        res.json({ success: true, message: 'Instance arrêtée' });
    } catch (error) {
        console.error('Stop instance error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'arrêt de l\'instance' });
    }
});

// Restart instance
router.post('/:id/restart', isAuthenticated, async (req, res) => {
    try {
        // Check permissions - owner, admin, or editor can restart
        const userRole = await memberService.getMemberRole(req.session.userId, req.params.id);
        if (!userRole || userRole === 'viewer') {
            return res.status(403).json({ error: 'Vous n\'avez pas la permission de redémarrer cette instance' });
        }

        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ?',
            [req.params.id]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];

        if (!instance.container_id) {
            return res.status(400).json({ error: 'Container non trouvé' });
        }

        await dockerService.restartContainer(instance.container_id);
        await pool.query(
            'UPDATE n8n_instances SET status = ?, last_activity = NOW() WHERE id = ?',
            ['running', instance.id]
        );

        // Log activity
        await activityService.logInstanceRestarted(req.session.userId, instance.id, instance.name);

        res.json({ success: true, message: 'Instance redémarrée' });
    } catch (error) {
        console.error('Restart instance error:', error);
        res.status(500).json({ error: 'Erreur lors du redémarrage de l\'instance' });
    }
});

// Get instance logs
router.get('/:id/logs', isAuthenticated, async (req, res) => {
    try {
        // Check if user has access (owner or member)
        const userRole = await memberService.getMemberRole(req.session.userId, req.params.id);
        if (!userRole) {
            return res.status(403).json({ error: 'Vous n\'avez pas accès à cette instance' });
        }

        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ?',
            [req.params.id]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];

        if (!instance.container_id) {
            return res.status(400).json({ error: 'Container non trouvé' });
        }

        const tail = req.query.tail || 100;
        const logs = await dockerService.getContainerLogs(instance.container_id, parseInt(tail));

        res.json({ logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
    }
});

// Delete instance
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        // Only owner can delete
        const isOwner = await memberService.isInstanceOwner(req.session.userId, req.params.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'Seul le propriétaire peut supprimer l\'instance' });
        }

        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ?',
            [req.params.id]
        );

        if (instances.length === 0) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        const instance = instances[0];

        // Log activity before deletion
        await activityService.logInstanceDeleted(req.session.userId, instance.id, instance.name);

        // Delete Docker container
        if (instance.container_id) {
            try {
                await dockerService.deleteContainer(instance.container_id);
            } catch (error) {
                console.error('Error deleting container:', error);
            }
        }

        // Remove Nginx subdomain configuration
        if (instance.subdomain) {
            try {
                console.log(`🗑️  Suppression du sous-domaine: ${instance.subdomain}.logicai.fr`);
                const nginxResult = await nginxService.removeSubdomain(instance.subdomain);
                
                if (nginxResult.success) {
                    console.log(`✅ Sous-domaine supprimé avec succès`);
                } else {
                    console.error(`⚠️  Échec de la suppression du sous-domaine: ${nginxResult.error}`);
                }
            } catch (nginxError) {
                console.error('❌ Erreur lors de la suppression du sous-domaine:', nginxError);
                // Don't fail the instance deletion if subdomain removal fails
            }
        }

        // Delete instance from database
        await pool.query('DELETE FROM n8n_instances WHERE id = ?', [instance.id]);

        res.json({ success: true, message: 'Instance supprimée' });
    } catch (error) {
        console.error('Delete instance error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'instance' });
    }
});

module.exports = router;
