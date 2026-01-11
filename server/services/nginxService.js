const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class NginxService {
    constructor() {
        this.scriptsPath = path.join(__dirname, '..', 'scripts');
        this.setupScript = path.join(this.scriptsPath, 'setup-nginx-subdomain.sh');
        this.removeScript = path.join(this.scriptsPath, 'remove-nginx-subdomain.sh');
        
        console.log('🔍 NginxService initialized:');
        console.log('   __dirname:', __dirname);
        console.log('   scriptsPath:', this.scriptsPath);
        console.log('   setupScript:', this.setupScript);
        console.log('   removeScript:', this.removeScript);
    }

    /**
     * Vérifier que les scripts existent et sont exécutables
     */
    async checkScripts() {
        try {
            console.log('🔍 Checking if scripts exist and are executable...');
            console.log('   Setup script:', this.setupScript);
            console.log('   Remove script:', this.removeScript);
            
            // Vérifier l'existence des fichiers
            try {
                await fs.access(this.setupScript, fs.constants.F_OK);
                console.log('   ✅ Setup script exists');
            } catch (err) {
                console.error('   ❌ Setup script NOT FOUND:', this.setupScript);
                throw new Error(`Setup script not found: ${this.setupScript}`);
            }
            
            try {
                await fs.access(this.removeScript, fs.constants.F_OK);
                console.log('   ✅ Remove script exists');
            } catch (err) {
                console.error('   ❌ Remove script NOT FOUND:', this.removeScript);
                throw new Error(`Remove script not found: ${this.removeScript}`);
            }
            
            // Vérifier qu'ils sont exécutables
            try {
                await fs.access(this.setupScript, fs.constants.X_OK);
                console.log('   ✅ Setup script is executable');
            } catch (err) {
                console.error('   ❌ Setup script is NOT EXECUTABLE');
                console.error('   Run: chmod +x', this.setupScript);
                throw new Error(`Setup script not executable. Run: chmod +x ${this.setupScript}`);
            }
            
            try {
                await fs.access(this.removeScript, fs.constants.X_OK);
                console.log('   ✅ Remove script is executable');
            } catch (err) {
                console.error('   ❌ Remove script is NOT EXECUTABLE');
                console.error('   Run: chmod +x', this.removeScript);
                throw new Error(`Remove script not executable. Run: chmod +x ${this.removeScript}`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Scripts check failed:');
            console.error('   Error:', error.message);
            console.error('');
            console.error('📝 To fix this issue:');
            console.error('   1. Make sure scripts exist in:', this.scriptsPath);
            console.error('   2. Run: chmod +x ' + this.scriptsPath + '/*.sh');
            console.error('   3. Verify with: ls -la ' + this.scriptsPath);
            console.error('');
            return false;
        }
    }

    /**
     * Créer un sous-domaine Nginx avec SSL pour une instance N8N
     * @param {string} subdomain - Le sous-domaine (ex: "14e1ee4622fe")
     * @param {number} dockerPort - Le port Docker de l'instance N8N
     * @returns {Promise<Object>} Résultat de la configuration
     */
    async setupSubdomain(subdomain, dockerPort) {
        console.log(`🚀 Configuration du sous-domaine Nginx: ${subdomain}.logicai.fr`);
        console.log(`📍 Port Docker: ${dockerPort}`);

        try {
            // Vérifier que les scripts existent
            const scriptsOk = await this.checkScripts();
            if (!scriptsOk) {
                throw new Error('Scripts Nginx non disponibles');
            }

            // Exécuter le script de configuration
            const command = `sudo ${this.setupScript} ${subdomain} ${dockerPort}`;
            console.log(`📝 Exécution: ${command}`);

            const { stdout, stderr } = await execAsync(command, {
                timeout: 120000, // 2 minutes timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            // Logger la sortie
            if (stdout) {
                console.log('📤 Sortie:', stdout);
                
                // Déterminer si SSL a été obtenu
                const sslObtained = stdout.includes('Certificat SSL obtenu avec succès') || 
                                   stdout.includes('https://');
                const url = sslObtained 
                    ? `https://${subdomain}.logicai.fr`
                    : `http://${subdomain}.logicai.fr`;
                
                console.log(`✅ Sous-domaine configuré: ${url}`);
                
                return {
                    success: true,
                    subdomain: `${subdomain}.logicai.fr`,
                    url: url,
                    ssl: sslObtained,
                    message: sslObtained 
                        ? 'Sous-domaine configuré avec succès (HTTPS)'
                        : 'Sous-domaine configuré (HTTP uniquement - SSL non disponible)'
                };
            }
            
            if (stderr) {
                console.error('⚠️  Erreurs/Warnings:', stderr);
            }

            console.log(`✅ Sous-domaine configuré: https://${subdomain}.logicai.fr`);

            return {
                success: true,
                subdomain: `${subdomain}.logicai.fr`,
                url: `https://${subdomain}.logicai.fr`,
                message: 'Sous-domaine configuré avec succès'
            };

        } catch (error) {
            console.error('❌ Erreur lors de la configuration du sous-domaine:', error);
            
            // Déterminer le type d'erreur
            let errorMessage = 'Erreur lors de la configuration du sous-domaine';
            
            if (error.code === 'EACCES') {
                errorMessage = 'Permission refusée. Assurez-vous que le script est exécutable et que sudo fonctionne sans mot de passe.';
            } else if (error.killed) {
                errorMessage = 'Timeout: Le script a pris trop de temps (> 2 minutes). Vérifiez les logs Nginx et DNS.';
            } else if (error.stderr) {
                errorMessage = `Erreur: ${error.stderr}`;
            }

            return {
                success: false,
                error: errorMessage,
                details: error.message
            };
        }
    }

    /**
     * Supprimer un sous-domaine Nginx
     * @param {string} subdomain - Le sous-domaine à supprimer
     * @returns {Promise<Object>} Résultat de la suppression
     */
    async removeSubdomain(subdomain) {
        console.log(`🗑️  Suppression du sous-domaine: ${subdomain}.logicai.fr`);

        try {
            // Vérifier que les scripts existent
            const scriptsOk = await this.checkScripts();
            if (!scriptsOk) {
                throw new Error('Scripts Nginx non disponibles');
            }

            // Exécuter le script de suppression
            const command = `sudo ${this.removeScript} ${subdomain}`;
            console.log(`📝 Exécution: ${command}`);

            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000, // 30 secondes
                maxBuffer: 1024 * 1024
            });

            if (stdout) {
                console.log('📤 Sortie:', stdout);
            }
            if (stderr) {
                console.error('⚠️  Erreurs/Warnings:', stderr);
            }

            console.log(`✅ Sous-domaine supprimé: ${subdomain}.logicai.fr`);

            return {
                success: true,
                message: 'Sous-domaine supprimé avec succès'
            };

        } catch (error) {
            console.error('❌ Erreur lors de la suppression du sous-domaine:', error);
            
            return {
                success: false,
                error: 'Erreur lors de la suppression du sous-domaine',
                details: error.message
            };
        }
    }

    /**
     * Vérifier si un sous-domaine existe déjà
     * @param {string} subdomain - Le sous-domaine à vérifier
     * @returns {Promise<boolean>}
     */
    async subdomainExists(subdomain) {
        const configFile = `/etc/nginx/sites-available/${subdomain}.logicai.fr`;
        try {
            await fs.access(configFile);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Lister tous les sous-domaines N8N configurés
     * @returns {Promise<Array<string>>}
     */
    async listSubdomains() {
        try {
            const { stdout } = await execAsync('ls /etc/nginx/sites-available/ | grep .logicai.fr');
            const files = stdout.trim().split('\n').filter(f => f);
            return files;
        } catch (error) {
            console.error('Erreur lors de la liste des sous-domaines:', error);
            return [];
        }
    }

    /**
     * Tester la configuration Nginx
     * @returns {Promise<boolean>}
     */
    async testNginxConfig() {
        try {
            const { stdout, stderr } = await execAsync('sudo nginx -t');
            console.log('✅ Configuration Nginx valide');
            if (stdout) console.log(stdout);
            if (stderr) console.log(stderr); // nginx -t écrit sur stderr même en succès
            return true;
        } catch (error) {
            console.error('❌ Configuration Nginx invalide:', error.stderr || error.message);
            return false;
        }
    }

    /**
     * Recharger Nginx
     * @returns {Promise<boolean>}
     */
    async reloadNginx() {
        try {
            await execAsync('sudo systemctl reload nginx');
            console.log('✅ Nginx rechargé');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors du rechargement de Nginx:', error);
            return false;
        }
    }
}

module.exports = new NginxService();
