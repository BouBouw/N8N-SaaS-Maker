const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

/**
 * Import a workflow to a N8N instance
 */
router.post('/import', isAuthenticated, async (req, res) => {
    try {
        const { instanceId, workflowContent } = req.body;
        
        console.log('\n🔄 === DÉBUT IMPORT WORKFLOW ===');
        console.log('📌 Instance ID:', instanceId);
        console.log('📌 User ID:', req.session.userId);
        console.log('📌 Workflow content length:', workflowContent?.length || 0);

        if (!instanceId || !workflowContent) {
            console.log('❌ Données manquantes');
            return res.status(400).json({ error: 'Instance ID et contenu du workflow requis' });
        }

        // Get instance info
        const [instances] = await pool.query(
            'SELECT * FROM n8n_instances WHERE id = ? AND (user_id = ? OR id IN (SELECT instance_id FROM instance_members WHERE user_id = ? AND status = "active"))',
            [instanceId, req.session.userId, req.session.userId]
        );

        if (instances.length === 0) {
            console.log('❌ Instance non trouvée ou accès refusé');
            return res.status(404).json({ error: 'Instance non trouvée ou accès refusé' });
        }

        const instance = instances[0];
        console.log('✅ Instance trouvée:', instance.name, '- Port:', instance.docker_port);
        console.log('📌 Statut instance:', instance.status);

        if (instance.status !== 'running') {
            console.log('❌ Instance non démarrée');
            return res.status(400).json({ error: 'L\'instance doit être démarrée pour importer un workflow' });
        }

        // Parse workflow content
        let workflowData;
        try {
            console.log('🔍 Parsing workflow content...');
            // Extract JSON from markdown if needed
            const jsonMatch = workflowContent.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                console.log('📝 JSON extrait du markdown');
                workflowData = JSON.parse(jsonMatch[1].trim());
            } else {
                console.log('📝 JSON direct');
                workflowData = JSON.parse(workflowContent);
            }
            console.log('✅ Workflow parsé:', workflowData.name || 'Sans nom');
            
            // Ensure required fields are present
            if (!workflowData.active) {
                workflowData.active = false;
            }
            if (!workflowData.settings) {
                workflowData.settings = {};
            }
            if (!workflowData.tags) {
                workflowData.tags = [];
            }
            
            console.log('📝 Champs obligatoires ajoutés (active, settings, tags)');
        } catch (error) {
            console.log('❌ Erreur parsing workflow:', error.message);
            return res.status(400).json({ error: 'Format de workflow invalide' });
        }

        // Get N8N URL
        const n8nUrl = `http://localhost:${instance.docker_port}`;
        console.log('🌐 URL N8N:', n8nUrl);

        // Get user info for authentication
        console.log('🔐 Récupération des credentials...');
        const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [instance.user_id]);
        const userEmail = users[0]?.email;
        const password = instance.owner_password;
        
        console.log('📧 Email:', userEmail || 'NON TROUVÉ');
        console.log('🔑 Password:', password ? '✅ Présent' : '❌ Manquant');

        if (!password || !userEmail) {
            console.log('❌ Credentials manquants');
            return res.status(400).json({ 
                error: 'Credentials N8N non disponibles. Reconnectez-vous à votre instance.',
                requiresAuth: true,
                instanceUrl: n8nUrl
            });
        }

        // Login to N8N first
        let cookies = '';
        let loginAttempts = 0;
        const maxLoginAttempts = 2;

        while (loginAttempts < maxLoginAttempts) {
            try {
                console.log(`\n🔐 === AUTHENTIFICATION N8N (Tentative ${loginAttempts + 1}/${maxLoginAttempts}) ===`);
                console.log('📤 POST', `${n8nUrl}/rest/login`);
                console.log('📧 Email:', userEmail);
                
                const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                    email: userEmail,
                    password: password
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000,
                    validateStatus: () => true
                });

                console.log('📥 Status:', loginResponse.status);
                console.log('🍪 Cookies reçus:', loginResponse.headers['set-cookie'] ? 'OUI' : 'NON');

                if (loginResponse.status === 200 && loginResponse.headers['set-cookie']) {
                    cookies = loginResponse.headers['set-cookie'].join('; ');
                    console.log('✅ Authentifié sur N8N');
                    console.log('🍪 Cookie string length:', cookies.length);
                    break; // Success, exit loop
                } else {
                    console.log('❌ Échec authentification N8N');
                    console.log('📊 Response data:', JSON.stringify(loginResponse.data));
                    loginAttempts++;
                    
                    if (loginAttempts >= maxLoginAttempts) {
                        return res.status(401).json({ 
                            error: 'Échec de l\'authentification N8N après plusieurs tentatives',
                            requiresAuth: true,
                            instanceUrl: n8nUrl
                        });
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (loginError) {
                console.log('❌ Erreur lors de la connexion N8N');
                console.error('💥 Error:', loginError.message);
                loginAttempts++;
                
                if (loginAttempts >= maxLoginAttempts) {
                    return res.status(401).json({ 
                        error: 'Impossible de se connecter à N8N',
                        requiresAuth: true,
                        instanceUrl: n8nUrl
                    });
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Import workflow to N8N
        let importAttempts = 0;
        const maxImportAttempts = 2;
        let lastError = null;

        while (importAttempts < maxImportAttempts) {
            try {
                console.log(`\n📤 === IMPORT WORKFLOW (Tentative ${importAttempts + 1}/${maxImportAttempts}) ===`);
                console.log('🌐 POST', `${n8nUrl}/rest/workflows`);
                console.log('📋 Workflow name:', workflowData.name || 'Sans nom');
                console.log('🍪 Using cookies:', cookies.substring(0, 50) + '...');
                
                const response = await axios.post(`${n8nUrl}/rest/workflows`, workflowData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': cookies
                    },
                    timeout: 15000,
                    validateStatus: (status) => status < 500
                });

                console.log('📥 Status:', response.status);
                console.log('📊 Response data:', JSON.stringify(response.data).substring(0, 200));

                if (response.status === 200 || response.status === 201) {
                    const workflowId = response.data?.data?.id || response.data?.id;
                    console.log('✅ Workflow importé avec succès!');
                    console.log('🆔 Workflow ID:', workflowId);
                    
                    // Build workflow URL
                    const workflowUrl = `${n8nUrl}/workflow/${workflowId}`;
                    console.log('🔗 Workflow URL:', workflowUrl);
                    console.log('\n🎉 === FIN IMPORT WORKFLOW (SUCCÈS) ===\n');
                    
                    return res.json({
                        success: true,
                        message: 'Workflow importé avec succès',
                        workflow: response.data,
                        workflowUrl: workflowUrl,
                        workflowId: workflowId
                    });
                } else if (response.status === 401) {
                    console.log('❌ Authentification expirée, réessai...');
                    importAttempts++;
                    
                    if (importAttempts >= maxImportAttempts) {
                        return res.status(401).json({ 
                            error: 'Authentification requise sur l\'instance N8N',
                            requiresAuth: true,
                            instanceUrl: n8nUrl
                        });
                    }
                    
                    // Re-authenticate before retry
                    console.log('🔄 Réauthentification...');
                    const reloginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                        email: userEmail,
                        password: password
                    }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000,
                        validateStatus: () => true
                    });

                    if (reloginResponse.status === 200 && reloginResponse.headers['set-cookie']) {
                        cookies = reloginResponse.headers['set-cookie'].join('; ');
                        console.log('✅ Réauthentifié');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue; // Retry import
                    } else {
                        return res.status(401).json({ 
                            error: 'Échec de la réauthentification',
                            requiresAuth: true,
                            instanceUrl: n8nUrl
                        });
                    }
                } else if (response.status === 400) {
                    console.log('❌ Requête invalide (400)');
                    console.log('📊 Details:', JSON.stringify(response.data));
                    return res.status(400).json({ 
                        error: response.data?.message || 'Format de workflow invalide',
                        details: response.data
                    });
                } else {
                    console.log('❌ Échec de l\'import');
                    console.log('📊 Details:', response.data);
                    return res.status(400).json({ 
                        error: 'Échec de l\'import du workflow',
                        details: response.data
                    });
                }
            } catch (error) {
                console.log(`❌ Erreur lors de l'import du workflow (tentative ${importAttempts + 1})`);
                console.error('💥 Error:', error.message);
                lastError = error;
                importAttempts++;
                
                if (error.response) {
                    console.log('📊 Response status:', error.response.status);
                    console.log('📊 Response data:', JSON.stringify(error.response.data));
                    
                    if (error.response.status === 401 && importAttempts < maxImportAttempts) {
                        console.log('🔄 Réauthentification après erreur 401...');
                        try {
                            const reloginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                                email: userEmail,
                                password: password
                            }, {
                                headers: { 'Content-Type': 'application/json' },
                                timeout: 10000,
                                validateStatus: () => true
                            });

                            if (reloginResponse.status === 200 && reloginResponse.headers['set-cookie']) {
                                cookies = reloginResponse.headers['set-cookie'].join('; ');
                                console.log('✅ Réauthentifié');
                                await new Promise(resolve => setTimeout(resolve, 500));
                                continue; // Retry import
                            }
                        } catch (reloginError) {
                            console.log('❌ Échec de la réauthentification');
                        }
                    }
                    
                    if (error.response.status === 400) {
                        return res.status(400).json({ 
                            error: error.response.data?.message || 'Format de workflow invalide',
                            details: error.response.data
                        });
                    }
                }
                
                if (importAttempts >= maxImportAttempts) {
                    if (lastError?.response?.status === 401) {
                        return res.status(401).json({ 
                            error: 'Authentification requise. Veuillez vous connecter à votre instance N8N.',
                            requiresAuth: true,
                            instanceUrl: n8nUrl
                        });
                    }
                    
                    return res.status(500).json({ 
                        error: 'Erreur lors de l\'import du workflow après plusieurs tentatives',
                        details: lastError?.message
                    });
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        console.log('\n💥 === ERREUR GÉNÉRALE ===');
        console.error('❌ Import workflow error:', error.message);
        console.error('🔍 Stack:', error.stack);
        console.log('\n🛑 === FIN IMPORT WORKFLOW (ERREUR) ===\n');
        res.status(500).json({ error: 'Erreur serveur lors de l\'import' });
    }
});

/**
 * Get all workflows from user's N8N instances
 */
router.get('/list', isAuthenticated, async (req, res) => {
    try {
        console.log('\n📋 === RÉCUPÉRATION WORKFLOWS N8N ===');
        console.log('📌 User ID:', req.session.userId);

        // Get all user's running instances
        const [instances] = await pool.query(
            `SELECT id, name, docker_port, owner_password, status 
             FROM n8n_instances 
             WHERE user_id = ? AND status = 'running'`,
            [req.session.userId]
        );

        console.log('✅ Instances trouvées:', instances.length);

        if (instances.length === 0) {
            return res.json({ workflows: [] });
        }

        // Get user email for authentication
        const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [req.session.userId]);
        const userEmail = users[0]?.email;

        const allWorkflows = [];

        // Fetch workflows from each instance
        for (const instance of instances) {
            try {
                console.log(`\n🔄 Instance: ${instance.name} (Port: ${instance.docker_port})`);
                
                if (!instance.owner_password) {
                    console.log('⚠️ Pas de mot de passe stocké, skip');
                    continue;
                }

                const n8nUrl = `http://localhost:${instance.docker_port}`;

                // Login to N8N
                const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
                    emailOrLdapLoginId: userEmail,
                    password: instance.owner_password
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000,
                    validateStatus: () => true
                });

                if (loginResponse.status !== 200 || !loginResponse.headers['set-cookie']) {
                    console.log('❌ Échec authentification');
                    continue;
                }

                const cookies = loginResponse.headers['set-cookie'].join('; ');
                console.log('✅ Authentifié');

                // Get workflows
                const workflowsResponse = await axios.get(`${n8nUrl}/rest/workflows`, {
                    headers: { 'Cookie': cookies },
                    timeout: 5000
                });

                const workflows = workflowsResponse.data?.data || workflowsResponse.data || [];
                console.log('📊 Workflows trouvés:', workflows.length);

                // Add instance info to each workflow
                workflows.forEach(workflow => {
                    allWorkflows.push({
                        ...workflow,
                        instanceId: instance.id,
                        instanceName: instance.name,
                        instancePort: instance.docker_port,
                        workflowUrl: `${n8nUrl}/workflow/${workflow.id}`
                    });
                });

            } catch (error) {
                console.error(`❌ Erreur instance ${instance.name}:`, error.message);
                continue;
            }
        }

        console.log(`\n✅ Total workflows: ${allWorkflows.length}`);
        console.log('🎉 === FIN RÉCUPÉRATION WORKFLOWS ===\n');

        res.json({ workflows: allWorkflows });

    } catch (error) {
        console.error('❌ Error fetching workflows:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
    }
});

module.exports = router;
