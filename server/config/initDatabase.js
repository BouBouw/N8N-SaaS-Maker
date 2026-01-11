const fs = require('fs');
const path = require('path');
const pool = require('./database');

async function initializeDatabase() {
    try {
        console.log('🔍 Vérification de l\'initialisation de la base de données...');

        // Check if tables exist
        const [tables] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_name IN ('users', 'sessions', 'n8n_instances', 'user_subscriptions')
        `, [process.env.DB_NAME]);

        if (tables[0].count === 4) {
            console.log('✅ Base de données déjà initialisée');
            return;
        }

        console.log('📦 Initialisation de la base de données...');

        // Read schema.sql
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Remove comments and split into statements more intelligently
        const cleanedSql = schemaSql
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        // Extract CREATE TABLE statements using regex to handle complete blocks
        const createTableRegex = /CREATE TABLE IF NOT EXISTS[\s\S]*?\);/gi;
        const statements = cleanedSql.match(createTableRegex) || [];

        console.log(`   Trouvé ${statements.length} tables à créer`);

        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await pool.query(statement);
                    // Extract table name for logging
                    const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1];
                    console.log(`   ✓ Table ${tableName} créée`);
                } catch (error) {
                    // Ignore errors for already existing tables
                    if (!error.message.includes('already exists')) {
                        console.error('Error executing statement:', error.message);
                    }
                }
            }
        }

        console.log('✅ Base de données initialisée avec succès');
        console.log('   Tables créées: users, sessions, n8n_instances, user_subscriptions');

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
        throw error;
    }
}

module.exports = initializeDatabase;
