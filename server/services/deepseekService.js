const axios = require('axios');

class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        
        if (!this.apiKey) {
            console.warn('⚠️ DEEPSEEK_API_KEY not found in environment variables');
        }
    }

    /**
     * Generate N8N workflow using DeepSeek API
     */
    async generateWorkflow(userMessage, conversationHistory = []) {
        try {
            if (!this.apiKey) {
                throw new Error('DeepSeek API key not configured');
            }

            const systemPrompt = `You are an expert N8N workflow automation assistant. Your task is to create valid N8N workflow JSON based on user requests.

CRITICAL - VALID N8N NODE TYPES ONLY:
You MUST ONLY use these official N8N node types (prefix: n8n-nodes-base.):
- webhook (for triggers)
- httpRequest (for HTTP calls, NOT n8nApiRequest)
- code (for JavaScript code)
- set (for data manipulation)
- if (for conditional logic)
- switch (for multiple conditions)
- merge (for combining data)
- spreadsheetFile (for Excel/CSV)
- emailSend (for sending emails)
- emailReadImap (for reading emails)
- slack (for Slack integration)
- discord (for Discord integration)
- telegram (for Telegram)
- twitter (for Twitter/X)
- googleSheets (for Google Sheets)
- mysql (for MySQL database)
- postgres (for PostgreSQL)
- mongodb (for MongoDB)
- redis (for Redis)
- respond (for responding to webhooks)
- filter (for filtering items)
- aggregate (for aggregating data)
- splitInBatches (for processing in batches)
- itemLists (for list operations)
- dateTime (for date operations)
- crypto (for encryption)
- xml (for XML processing)
- html (for HTML extraction)
- json (for JSON operations)

NEVER USE: n8nApiRequest, apiRequest, or any non-existent node types!

IMPORTANT RULES:
1. Always return valid N8N workflow JSON format
2. Include proper node connections with correct syntax
3. ONLY use node types from the list above
4. Add proper coordinates for visual layout (nodes should be spaced 250-300 pixels apart)
5. Include credentials placeholders where needed
6. Use "httpRequest" for any API calls, NOT "n8nApiRequest"
7. Format your response in Markdown with proper code blocks

RESPONSE FORMAT:
Start with a brief description in French, then provide the workflow JSON in a markdown code block.

Example response structure:
## Description
[Brief description in French of what this workflow does]

## Workflow N8N
\`\`\`json
{
  "name": "Workflow name",
  "nodes": [...],
  "connections": {...},
  "settings": {
    "executionOrder": "v1"
  }
}
\`\`\`

## Explication
[Step-by-step explanation of how the workflow works]

Example N8N node structures:

Webhook node:
\`\`\`json
{
  "parameters": {
    "path": "webhook-path",
    "responseMode": "lastNode"
  },
  "name": "Webhook",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 1.1,
  "position": [250, 300],
  "webhookId": "unique-id"
}
\`\`\`

HTTP Request node (for API calls):
\`\`\`json
{
  "parameters": {
    "url": "https://api.example.com/data",
    "method": "POST",
    "authentication": "none",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "key",
          "value": "={{ $json.data }}"
        }
      ]
    }
  },
  "name": "HTTP Request",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [500, 300]
}
\`\`\`

Code node:
\`\`\`json
{
  "parameters": {
    "jsCode": "return items.map(item => ({ json: { ...item.json, processed: true } }));"
  },
  "name": "Code",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [750, 300]
}
\`\`\`

Connection structure:
\`\`\`json
{
  "Webhook": {
    "main": [[{
      "node": "HTTP Request",
      "type": "main",
      "index": 0
    }]]
  },
  "HTTP Request": {
    "main": [[{
      "node": "Code",
      "type": "main",
      "index": 0
    }]]
  }
}
\`\`\`

Always respond in French with detailed explanations and proper markdown formatting.`;

            // Build messages array with conversation history
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                }
            ];

            // Add conversation history (last 10 messages to avoid token limits)
            const recentHistory = conversationHistory.slice(-10);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }

            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });

            console.log('🤖 Calling DeepSeek API for workflow generation...');

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 4000,
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    timeout: 60000 // 60 second timeout
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                console.log('✅ DeepSeek workflow generated successfully');
                return aiResponse;
            } else {
                throw new Error('Invalid response from DeepSeek API');
            }

        } catch (error) {
            console.error('❌ DeepSeek API Error:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                throw new Error('Invalid DeepSeek API key');
            } else if (error.response?.status === 429) {
                throw new Error('DeepSeek API rate limit exceeded');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('DeepSeek API timeout');
            }
            
            throw new Error('Failed to generate workflow with DeepSeek');
        }
    }

    /**
     * Generate prompt using DeepSeek API
     */
    async generatePrompt(userMessage, conversationHistory = []) {
        try {
            if (!this.apiKey) {
                throw new Error('DeepSeek API key not configured');
            }

            const systemPrompt = `Tu es un expert en création de prompts pour agents IA.
Tu aides les utilisateurs à créer des prompts efficaces, clairs et performants.
Fournis des exemples de prompts optimisés avec des explications détaillées.

Structure recommandée pour un prompt:
1. **Contexte**: Définir le contexte général
2. **Rôle**: Définir le rôle de l'IA
3. **Tâche**: Décrire clairement la tâche à accomplir
4. **Format**: Spécifier le format de sortie attendu
5. **Contraintes**: Lister les limitations ou règles
6. **Exemples**: Donner des exemples si nécessaire

Réponds toujours en français avec des exemples concrets et détaillés.`;

            // Build messages array
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                }
            ];

            // Add conversation history (last 10 messages)
            const recentHistory = conversationHistory.slice(-10);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }

            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });

            console.log('🤖 Calling DeepSeek API for prompt generation...');

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.8,
                    max_tokens: 3000,
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    timeout: 60000
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                console.log('✅ DeepSeek prompt generated successfully');
                return aiResponse;
            } else {
                throw new Error('Invalid response from DeepSeek API');
            }

        } catch (error) {
            console.error('❌ DeepSeek API Error:', error.response?.data || error.message);
            throw new Error('Failed to generate prompt with DeepSeek');
        }
    }
}

module.exports = new DeepSeekService();
