const express = require('express');
const axios = require('axios');
const { authenticateApiKey } = require('../middleware/apiAuth');
const apiKeyService = require('../services/apiKeyService');

const router = express.Router();

/**
 * Execute a workflow via API
 * POST /api/v1/workflows/:workflowId/execute
 */
router.post('/workflows/:workflowId/execute', authenticateApiKey, async (req, res) => {
    const startTime = Date.now();
    const { workflowId } = req.params;
    const keyInfo = req.apiKeyInfo;

    try {
        console.log(`\n🚀 === EXÉCUTION WORKFLOW VIA API ===`);
        console.log(`📌 Workflow ID: ${workflowId}`);
        console.log(`📌 Instance: ${keyInfo.instance_name}`);
        console.log(`📌 API Key ID: ${keyInfo.key_id}`);

        // Get N8N URL
        const n8nUrl = `http://localhost:${keyInfo.docker_port}`;
        
        // Authenticate with N8N
        console.log('🔐 Authentification N8N...');
        const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
            emailOrLdapLoginId: keyInfo.owner_email,
            password: keyInfo.owner_password
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true
        });

        if (loginResponse.status !== 200 || !loginResponse.headers['set-cookie']) {
            throw new Error('Échec de l\'authentification N8N');
        }

        const cookies = loginResponse.headers['set-cookie'].join('; ');
        console.log('✅ Authentifié');

        // Execute workflow
        console.log('⚡ Exécution du workflow...');
        const executionResponse = await axios.post(
            `${n8nUrl}/rest/workflows/${workflowId}/run`,
            req.body, // Forward request body as workflow input
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookies
                },
                timeout: 30000,
                validateStatus: (status) => status < 500
            }
        );

        const responseTime = Date.now() - startTime;

        if (executionResponse.status === 200 || executionResponse.status === 201) {
            console.log('✅ Workflow exécuté avec succès');
            console.log(`⏱️ Temps de réponse: ${responseTime}ms`);

            // Log successful request
            await apiKeyService.logApiRequest(
                keyInfo.key_id,
                keyInfo.instance_id,
                workflowId,
                req.originalUrl,
                req.method,
                200,
                responseTime
            );

            res.status(200).json({
                success: true,
                data: executionResponse.data,
                execution_time_ms: responseTime
            });
        } else {
            throw new Error(`N8N returned status ${executionResponse.status}`);
        }

    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error.response?.data?.message || error.message;

        console.error('❌ Erreur exécution workflow:', errorMessage);

        // Log failed request
        await apiKeyService.logApiRequest(
            keyInfo.key_id,
            keyInfo.instance_id,
            workflowId,
            req.originalUrl,
            req.method,
            error.response?.status || 500,
            responseTime,
            errorMessage
        );

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Workflow Execution Failed',
            message: errorMessage,
            workflow_id: workflowId
        });
    }
});

/**
 * Get workflow details
 * GET /api/v1/workflows/:workflowId
 */
router.get('/workflows/:workflowId', authenticateApiKey, async (req, res) => {
    const startTime = Date.now();
    const { workflowId } = req.params;
    const keyInfo = req.apiKeyInfo;

    try {
        const n8nUrl = `http://localhost:${keyInfo.docker_port}`;
        
        // Authenticate with N8N
        const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
            emailOrLdapLoginId: keyInfo.owner_email,
            password: keyInfo.owner_password
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true
        });

        if (loginResponse.status !== 200 || !loginResponse.headers['set-cookie']) {
            throw new Error('Échec de l\'authentification N8N');
        }

        const cookies = loginResponse.headers['set-cookie'].join('; ');

        // Get workflow
        const workflowResponse = await axios.get(
            `${n8nUrl}/rest/workflows/${workflowId}`,
            {
                headers: { 'Cookie': cookies },
                timeout: 10000
            }
        );

        const responseTime = Date.now() - startTime;

        // Log request
        await apiKeyService.logApiRequest(
            keyInfo.key_id,
            keyInfo.instance_id,
            workflowId,
            req.originalUrl,
            req.method,
            200,
            responseTime
        );

        res.status(200).json({
            success: true,
            data: workflowResponse.data
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error.response?.data?.message || error.message;

        await apiKeyService.logApiRequest(
            keyInfo.key_id,
            keyInfo.instance_id,
            workflowId,
            req.originalUrl,
            req.method,
            error.response?.status || 500,
            responseTime,
            errorMessage
        );

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Workflow Fetch Failed',
            message: errorMessage,
            workflow_id: workflowId
        });
    }
});

/**
 * List all workflows
 * GET /api/v1/workflows
 */
router.get('/workflows', authenticateApiKey, async (req, res) => {
    const startTime = Date.now();
    const keyInfo = req.apiKeyInfo;

    try {
        const n8nUrl = `http://localhost:${keyInfo.docker_port}`;
        
        // Authenticate with N8N
        const loginResponse = await axios.post(`${n8nUrl}/rest/login`, {
            emailOrLdapLoginId: keyInfo.owner_email,
            password: keyInfo.owner_password
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true
        });

        if (loginResponse.status !== 200 || !loginResponse.headers['set-cookie']) {
            throw new Error('Échec de l\'authentification N8N');
        }

        const cookies = loginResponse.headers['set-cookie'].join('; ');

        // Get workflows
        const workflowsResponse = await axios.get(
            `${n8nUrl}/rest/workflows`,
            {
                headers: { 'Cookie': cookies },
                timeout: 10000
            }
        );

        const responseTime = Date.now() - startTime;

        // Log request
        await apiKeyService.logApiRequest(
            keyInfo.key_id,
            keyInfo.instance_id,
            'list',
            req.originalUrl,
            req.method,
            200,
            responseTime
        );

        const workflows = workflowsResponse.data?.data || workflowsResponse.data || [];

        res.status(200).json({
            success: true,
            count: workflows.length,
            data: workflows
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error.response?.data?.message || error.message;

        await apiKeyService.logApiRequest(
            keyInfo.key_id,
            keyInfo.instance_id,
            'list',
            req.originalUrl,
            req.method,
            error.response?.status || 500,
            responseTime,
            errorMessage
        );

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Workflows List Failed',
            message: errorMessage
        });
    }
});

module.exports = router;
