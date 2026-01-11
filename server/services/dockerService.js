const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const docker = new Docker();

class DockerService {
    /**
     * Check if Docker is running
     * @returns {Promise<boolean>}
     */
    async isDockerAvailable() {
        try {
            await docker.ping();
            return true;
        } catch (error) {
            return false;
        }
    }
    /**
     * Create a new N8N instance in Docker
     * @param {Object} config - Instance configuration
     * @param {string} config.instanceName - Name of the instance
     * @param {number} config.userId - User ID
     * @param {string} config.userEmail - User email for N8N account
     * @param {string} config.userName - User name for N8N account
     * @param {number} config.ramLimit - RAM limit in GB
     * @param {number} config.storageLimit - Storage limit in GB
     * @returns {Promise<Object>} Container info
     */
    async createN8NInstance(config) {
        const { instanceName, userId, userEmail, userName, ramLimit, storageLimit } = config;
        
        // Check if Docker is available
        const dockerAvailable = await this.isDockerAvailable();
        if (!dockerAvailable) {
            throw new Error('DOCKER_NOT_RUNNING');
        }
        
        const uuid = uuidv4();
        const containerName = `n8n_${userId}_${uuid.split('-')[0]}`;
        
        // Find available port (starting from 5678)
        const port = await this.findAvailablePort(5678);
        
        // Generate password once to return it
        const password = this.generatePassword();

        console.log(`🐳 Creating N8N container: ${containerName}`);

        try {
            // Pull N8N image if not exists
            await this.pullImageIfNeeded('n8nio/n8n:latest');

            // Create container with resource limits
            const container = await docker.createContainer({
                Image: 'n8nio/n8n:latest',
                name: containerName,
                Hostname: containerName,
                ExposedPorts: {
                    '5678/tcp': {}
                },
                HostConfig: {
                    PortBindings: {
                        '5678/tcp': [{ HostPort: port.toString() }]
                    },
                    Memory: ramLimit * 1024 * 1024 * 1024, // Convert GB to bytes
                    MemorySwap: ramLimit * 1024 * 1024 * 1024, // Prevent swap
                    // Storage limit handled via volume size (production only)
                    RestartPolicy: {
                        Name: 'unless-stopped'
                    },
                    Binds: [
                        `n8n_${uuid}:/home/node/.n8n`
                    ]
                },
                Env: [
                    // Skip personalization questionnaire
                    'N8N_PERSONALIZATION_ENABLED=false',
                    
                    // Disable telemetry and notifications
                    'N8N_DIAGNOSTICS_ENABLED=false',
                    'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
                    
                    // Disable license prompts and renewal
                    'N8N_LICENSE_AUTO_RENEW_ENABLED=false',
                    'N8N_LICENSE_AUTO_RENEW_OFFSET=0',
                    'N8N_HIDE_USAGE_PAGE=true',
                    'N8N_ENTERPRISE_LICENSE_ACTIVATION_PROMPT=false',
                    
                    // Basic config
                    'N8N_HOST=0.0.0.0',
                    'N8N_PORT=5678',
                    'N8N_PROTOCOL=http',
                    'WEBHOOK_URL=http://localhost:' + port,
                    'GENERIC_TIMEZONE=Europe/Paris'
                ],
                Labels: {
                    'logicai.instance': 'true',
                    'logicai.user_id': userId.toString(),
                    'logicai.uuid': uuid,
                    'logicai.instance_name': instanceName
                }
            });

            // Start the container
            await container.start();

            console.log(`✅ N8N container started: ${containerName} on port ${port}`);

            // Setup owner account in background (don't await)
            this.setupN8NOwner(port, userEmail, userName, password).catch(err => {
                console.error('❌ Background setup failed:', err.message);
            });

            return {
                containerId: container.id,
                containerName,
                uuid,
                port,
                url: `http://localhost:${port}`,
                password
            };

        } catch (error) {
            console.error('❌ Error creating N8N container:', error);
            throw new Error(`Failed to create N8N instance: ${error.message}`);
        }
    }

    /**
     * Stop a container
     */
    async stopContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.stop();
            console.log(`🛑 Container stopped: ${containerId}`);
            return true;
        } catch (error) {
            console.error('Error stopping container:', error);
            throw error;
        }
    }

    /**
     * Start a container
     */
    async startContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.start();
            console.log(`▶️  Container started: ${containerId}`);
            return true;
        } catch (error) {
            console.error('Error starting container:', error);
            throw error;
        }
    }

    /**
     * Restart a container
     */
    async restartContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.restart();
            console.log(`🔁 Container restarted: ${containerId}`);
            return true;
        } catch (error) {
            console.error('Error restarting container:', error);
            throw error;
        }
    }

    /**
     * Delete a container
     */
    async deleteContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.stop();
            await container.remove();
            console.log(`🗑️  Container deleted: ${containerId}`);
            return true;
        } catch (error) {
            console.error('Error deleting container:', error);
            throw error;
        }
    }

    /**
     * Get container logs
     */
    async getContainerLogs(containerId, tail = 100) {
        try {
            const container = docker.getContainer(containerId);
            const logs = await container.logs({
                stdout: true,
                stderr: true,
                tail: tail,
                timestamps: true
            });
            return logs.toString('utf8');
        } catch (error) {
            console.error('Error getting container logs:', error);
            throw error;
        }
    }

    /**
     * Get container stats (CPU, Memory, Network)
     */
    async getContainerStats(containerId) {
        try {
            const container = docker.getContainer(containerId);
            const stats = await container.stats({ stream: false });
            
            return {
                memoryUsage: stats.memory_stats.usage,
                memoryLimit: stats.memory_stats.limit,
                cpuUsage: this.calculateCPUPercent(stats),
                networkRx: stats.networks?.eth0?.rx_bytes || 0,
                networkTx: stats.networks?.eth0?.tx_bytes || 0
            };
        } catch (error) {
            console.error('Error getting container stats:', error);
            return null;
        }
    }

    /**
     * Get container status
     */
    async getContainerStatus(containerId) {
        try {
            const container = docker.getContainer(containerId);
            const info = await container.inspect();
            return info.State.Running ? 'running' : 'stopped';
        } catch (error) {
            return 'error';
        }
    }

    /**
     * Pull Docker image if it doesn't exist
     */
    async pullImageIfNeeded(imageName) {
        try {
            await docker.getImage(imageName).inspect();
            console.log(`✅ Image already exists: ${imageName}`);
        } catch (error) {
            console.log(`📥 Pulling image: ${imageName}...`);
            await new Promise((resolve, reject) => {
                docker.pull(imageName, (err, stream) => {
                    if (err) return reject(err);
                    docker.modem.followProgress(stream, (err, output) => {
                        if (err) return reject(err);
                        console.log(`✅ Image pulled: ${imageName}`);
                        resolve(output);
                    });
                });
            });
        }
    }

    /**
     * Find an available port
     */
    async findAvailablePort(startPort) {
        const containers = await docker.listContainers({ all: true });
        const usedPorts = new Set();

        containers.forEach(container => {
            if (container.Ports) {
                container.Ports.forEach(port => {
                    if (port.PublicPort) {
                        usedPorts.add(port.PublicPort);
                    }
                });
            }
        });

        let port = startPort;
        while (usedPorts.has(port)) {
            port++;
        }

        return port;
    }

    /**
     * Generate a random password
     */
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    /**
     * Wait for N8N to be ready and setup owner account
     */
    async setupN8NOwner(port, email, name, password) {
        const maxRetries = 60;
        const retryDelay = 2000;
        const n8nUrl = `http://localhost:${port}`;

        console.log(`⏳ Waiting for N8N to be ready on port ${port}...`);

        // Wait for N8N to be accessible
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await axios.get(`${n8nUrl}`, { 
                    timeout: 3000,
                    maxRedirects: 0,
                    validateStatus: () => true // Accept any status
                });
                console.log(`✅ N8N is responding on port ${port}`);
                break;
            } catch (error) {
                if (i === maxRetries - 1) {
                    console.error('❌ N8N did not become ready in time');
                    throw new Error('N8N did not become ready in time');
                }
                console.log(`⏳ Attempt ${i + 1}/${maxRetries} - waiting for N8N...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // Wait a bit more for N8N to fully initialize
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Setup owner account via API
        try {
            const [firstName, ...lastNameParts] = name.split(' ');
            const lastName = lastNameParts.join(' ') || firstName; // Fallback to firstName if no last name

            console.log(`🔧 Setting up N8N owner account for ${email}...`);
            console.log(`👤 Name: ${firstName} ${lastName}`);

            // Use the correct endpoint for N8N setup
            try {
                console.log(`🔍 Calling /rest/owner/setup...`);
                const response = await axios.post(`${n8nUrl}/rest/owner/setup`, {
                    email,
                    firstName,
                    lastName,
                    password
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000,
                    validateStatus: () => true
                });

                console.log(`📡 Response status: ${response.status}`);
                
                if (response.status === 200 || response.status === 201) {
                    console.log(`✅ N8N owner account created successfully!`);
                    console.log(`📋 Response:`, response.data);
                    return response.data;
                } else {
                    console.log(`⚠️ Setup failed with status ${response.status}:`, response.data);
                }
            } catch (err) {
                console.log(`❌ Setup error:`, err.message);
            }

            console.log('❌ Setup failed. Instance will require manual setup.');

        } catch (error) {
            console.error('❌ Error in setup process:', error.message);
            // Don't throw - instance is still usable, user can setup manually
        }
    }

    /**
     * Calculate CPU percentage from stats
     */
    calculateCPUPercent(stats) {
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
        return cpuPercent.toFixed(2);
    }

    /**
     * List all LogicAI N8N containers
     */
    async listLogicAIContainers(userId = null) {
        try {
            const filters = {
                label: ['logicai.instance=true']
            };
            
            if (userId) {
                filters.label.push(`logicai.user_id=${userId}`);
            }

            const containers = await docker.listContainers({
                all: true,
                filters: JSON.stringify(filters)
            });

            return containers;
        } catch (error) {
            console.error('Error listing containers:', error);
            return [];
        }
    }
}

module.exports = new DockerService();
