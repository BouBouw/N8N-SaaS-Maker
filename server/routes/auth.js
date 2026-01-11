const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const multer = require('multer');
const pool = require('../config/database');
const passport = require('../config/passport');
const { isAuthenticated } = require('../middleware/auth');
const { sendPasswordCreationEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

// Configure multer for avatar upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'));
        }
    }
});

const BOT_URL = process.env.BOT_URL || 'http://localhost:3002';

// Register with email/password
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
        }

        // Check if user exists
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Set session
        req.session.userId = result.insertId;
        req.session.save();

        console.log(`✅ Inscription réussie - Email: ${email}`);

        // Get the created user with role
        const [newUser] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [result.insertId]);

        res.json({
            success: true,
            user: newUser[0]
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// Login with email/password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Find user
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.log(`❌ Échec de connexion - Email introuvable: ${email}`);
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = users[0];

        // Check password
        if (!user.password) {
            console.log(`⚠️ Tentative de connexion - Compte Discord: ${email}`);
            return res.status(401).json({ error: 'Utilisez Discord pour vous connecter' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            console.log(`❌ Échec de connexion - Mot de passe incorrect pour: ${email}`);
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Set session
        req.session.userId = user.id;
        req.session.save();

        console.log(`✅ Connexion réussie - Email: ${email}`);

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    const userId = req.session.userId;
    
    if (userId) {
        try {
            const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
            if (users.length > 0) {
                console.log(`👋 Déconnexion - Email: ${users[0].email}`);
            }
        } catch (error) {
            console.error('Error fetching user email for logout log:', error);
        }
    }
    
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
        }
        res.json({ success: true });
    });
});

// Get current user
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.avatar, 
                u.discord_id,
                u.role,
                u.preferences,
                u.has_completed_onboarding,
                u.email_verified, 
                u.created_at,
                COALESCE(us.plan, 'free') as subscription_plan
            FROM users u
            LEFT JOIN user_subscriptions us ON u.id = us.user_id
            WHERE u.id = ?
        `, [req.session.userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const user = users[0];
        
        // Parse preferences if they exist
        if (user.preferences) {
            try {
                user.preferences = JSON.parse(user.preferences);
            } catch (e) {
                user.preferences = null;
            }
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
    }
});

// Request password reset
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }

        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        
        // Always return success for security (don't reveal if email exists)
        if (users.length === 0) {
            return res.json({ success: true });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
            [resetToken, resetTokenExpires, email]
        );

        // TODO: Send email with reset link
        // For now, just log the token (in production, send email)
        console.log(`Reset token for ${email}: ${resetToken}`);
        console.log(`Reset link: ${process.env.FRONTEND_URL}/reset-password/${resetToken}`);

        res.json({ success: true });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

// Verify reset token and set new password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
        }

        const [users] = await pool.query(
            'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Token invalide ou expiré' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, users[0].id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Reset password verify error:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

// Discord OAuth routes
router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        req.session.userId = req.user.id;
        req.session.save();
        res.redirect(process.env.FRONTEND_URL);
    }
);

// Discord link route (for linking Discord to existing account)
router.get('/discord/link', isAuthenticated, (req, res) => {
    const { discord_id } = req.query;
    
    if (!discord_id) {
        return res.redirect(process.env.FRONTEND_URL + '/dashboard?error=missing_discord_id');
    }
    
    // Store discord_id in session for callback
    req.session.pending_discord_id = discord_id;
    req.session.save();
    
    // Redirect to Discord OAuth
    res.redirect('/auth/discord/link-callback-start');
});

router.get('/discord/link-callback-start', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const discordId = req.session.pending_discord_id;
        
        if (!discordId) {
            return res.redirect(process.env.FRONTEND_URL + '/dashboard?error=session_expired');
        }
        
        // Récupérer les informations Discord de l'utilisateur
        let discordAvatar = null;
        let discordUsername = null;
        try {
            const discordInfoResponse = await axios.get(`${BOT_URL}/discord-user/${discordId}`, {
                timeout: 5000
            });
            if (discordInfoResponse.data.user) {
                discordAvatar = discordInfoResponse.data.user.avatar;
                discordUsername = discordInfoResponse.data.user.username;
            }
        } catch (discordError) {
            console.error('⚠️ Failed to fetch Discord user info:', discordError.message);
        }
        
        // Link Discord ID to user account avec avatar et username
        if (discordAvatar || discordUsername) {
            await pool.query(
                'UPDATE users SET discord_id = ?, avatar = ?, discord_username = ? WHERE id = ?',
                [discordId, discordAvatar, discordUsername, userId]
            );
        } else {
            await pool.query(
                'UPDATE users SET discord_id = ? WHERE id = ?',
                [discordId, userId]
            );
        }
        
        // Récupérer le plan de l'utilisateur pour attribuer le rôle Discord
        const [users] = await pool.query(`
            SELECT u.*, s.plan 
            FROM users u
            LEFT JOIN user_subscriptions s ON u.id = s.user_id
            WHERE u.id = ?
        `, [userId]);
        
        const user = users[0];
        
        // Attribuer le rôle Discord basé sur le plan
        if (user && user.plan) {
            try {
                await axios.post(`${BOT_URL}/discord-role`, {
                    discordId: discordId,
                    plan: user.plan
                }, {
                    timeout: 5000
                });
                console.log('✅ Discord role assigned:', user.plan);
            } catch (roleError) {
                console.error('⚠️ Failed to assign Discord role:', roleError.message);
                // Ne pas bloquer la liaison si l'attribution du rôle échoue
            }
        }
        
        // Clean up session
        delete req.session.pending_discord_id;
        req.session.save();
        
        // Redirect to dashboard with success message
        res.redirect(process.env.FRONTEND_URL + '/dashboard?discord_linked=success');
    } catch (error) {
        console.error('Erreur liaison Discord:', error);
        res.redirect(process.env.FRONTEND_URL + '/dashboard?error=link_failed');
    }
});

// Complete onboarding
router.post('/complete-onboarding', isAuthenticated, async (req, res) => {
    try {
        await pool.query(
            'UPDATE users SET has_completed_onboarding = TRUE WHERE id = ?',
            [req.session.userId]
        );

        res.json({ success: true, message: 'Onboarding complété' });
    } catch (error) {
        console.error('Erreur lors de la complétion de l\'onboarding:', error);
        res.status(500).json({ error: 'Erreur lors de la complétion de l\'onboarding' });
    }
});

// Update user profile
router.patch('/profile', isAuthenticated, upload.single('avatar'), async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.session.userId;

        console.log('🔧 Profile update - userId:', userId);
        console.log('🔧 Profile update - name:', name);
        console.log('🔧 Profile update - email:', email);
        console.log('🔧 Profile update - file received:', !!req.file);

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name);
        }

        if (email) {
            // Check if email is already used by another user
            const [existingUsers] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );
            if (existingUsers.length > 0) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            updates.push('email = ?');
            values.push(email);
        }

        // Handle avatar upload
        if (req.file) {
            const base64Avatar = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            console.log('🖼️ Avatar base64 length:', base64Avatar.length);
            console.log('🖼️ Avatar base64 start:', base64Avatar.substring(0, 50));
            updates.push('avatar = ?');
            values.push(base64Avatar);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucune modification à effectuer' });
        }

        values.push(userId);
        
        console.log('📝 SQL Query:', `UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
        console.log('📝 SQL Values count:', values.length);
        
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Get updated user data
        const [updatedUser] = await pool.query(
            'SELECT id, name, email, avatar, discord_id, role FROM users WHERE id = ?',
            [userId]
        );

        console.log('✅ User updated - avatar length in DB:', updatedUser[0].avatar?.length || 0);
        console.log('✅ User updated - avatar start:', updatedUser[0].avatar?.substring(0, 50) || 'none');

        res.json({ success: true, user: updatedUser[0] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

// Sync Discord avatar
router.post('/sync-discord-avatar', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get user's discord_id
        const [users] = await pool.query(
            'SELECT discord_id FROM users WHERE id = ?',
            [userId]
        );

        if (!users[0] || !users[0].discord_id) {
            return res.status(400).json({ error: 'Aucun compte Discord lié à ce compte' });
        }

        const discordId = users[0].discord_id;

        // Fetch latest Discord user data
        try {
            const response = await axios.get(`https://discord.com/api/users/${discordId}`, {
                headers: {
                    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
                }
            });

            const discordUser = response.data;
            let avatarUrl = null;

            if (discordUser.avatar) {
                // Construct Discord CDN URL for avatar
                const extension = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.${extension}?size=256`;
            }

            // Update user's avatar
            await pool.query(
                'UPDATE users SET avatar = ? WHERE id = ?',
                [avatarUrl, userId]
            );

            // Get updated user data
            const [updatedUser] = await pool.query(
                'SELECT id, name, email, avatar, discord_id, role FROM users WHERE id = ?',
                [userId]
            );

            res.json({ success: true, user: updatedUser[0] });
        } catch (discordError) {
            console.error('Erreur lors de la récupération des données Discord:', discordError);
            return res.status(500).json({ error: 'Impossible de récupérer les données Discord' });
        }
    } catch (error) {
        console.error('Erreur lors de la synchronisation de l\'avatar Discord:', error);
        res.status(500).json({ error: 'Erreur lors de la synchronisation de l\'avatar' });
    }
});

// Update password
router.patch('/password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.userId;

        if (!newPassword) {
            return res.status(400).json({ error: 'Le nouveau mot de passe est requis' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
        }

        // Get current user
        const [users] = await pool.query(
            'SELECT email, password, discord_id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const user = users[0];

        // Check if user has no password (Discord account)
        if (!user.password || user.password === '') {
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = new Date(Date.now() + 3600000); // 1 hour

            await pool.query(
                'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
                [resetToken, resetExpires, userId]
            );

            // Send email with reset link
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
            
            try {
                // Get user name for email
                const [userDetails] = await pool.query(
                    'SELECT name FROM users WHERE id = ?',
                    [userId]
                );
                
                await sendPasswordCreationEmail(user.email, userDetails[0]?.name, resetUrl);
                console.log('✅ Password creation email sent to:', user.email);
            } catch (emailError) {
                console.error('❌ Error sending email:', emailError);
                // Continue anyway, log the URL for manual use
                console.log('🔐 Password creation link (email failed):', resetUrl);
            }

            return res.json({ 
                success: true, 
                requiresEmailVerification: true,
                message: 'Un email a été envoyé à votre adresse pour créer votre mot de passe'
            });
        }

        // Normal password change flow
        if (!currentPassword) {
            return res.status(400).json({ error: 'Le mot de passe actuel est requis' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
});

// Update preferences
router.patch('/preferences', isAuthenticated, async (req, res) => {
    try {
        const { emailNotifications, workflowNotifications, securityAlerts, darkMode, language } = req.body;
        const userId = req.session.userId;

        // Store preferences as JSON
        const preferences = {
            emailNotifications: emailNotifications ?? true,
            workflowNotifications: workflowNotifications ?? true,
            securityAlerts: securityAlerts ?? true,
            darkMode: darkMode ?? true,
            language: language || 'fr'
        };

        await pool.query(
            'UPDATE users SET preferences = ? WHERE id = ?',
            [JSON.stringify(preferences), userId]
        );

        res.json({ success: true, message: 'Préférences sauvegardées' });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des préférences:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde des préférences' });
    }
});

// Delete account and all associated data
router.delete('/delete-account', isAuthenticated, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const userId = req.session.userId;

        console.log(`🗑️ Starting account deletion for user ID: ${userId}`);

        await connection.beginTransaction();

        // 1. Get all user's N8N instances
        const [instances] = await connection.query(
            'SELECT id, container_id, status FROM n8n_instances WHERE user_id = ?',
            [userId]
        );

        console.log(`📦 Found ${instances.length} instances to delete`);

        // 2. Stop and remove Docker containers for each instance
        const Docker = require('dockerode');
        const docker = new Docker();

        for (const instance of instances) {
            if (instance.container_id && instance.status === 'running') {
                try {
                    console.log(`🛑 Stopping container: ${instance.container_id}`);
                    const container = docker.getContainer(instance.container_id);
                    await container.stop();
                    await container.remove();
                    console.log(`✅ Container ${instance.container_id} stopped and removed`);
                } catch (dockerError) {
                    console.error(`⚠️ Error stopping container ${instance.container_id}:`, dockerError.message);
                    // Continue even if container doesn't exist
                }
            }
        }

        // 3. Delete all instance-related data
        await connection.query('DELETE FROM api_keys WHERE instance_id IN (SELECT id FROM n8n_instances WHERE user_id = ?)', [userId]);
        console.log('✅ API keys deleted');

        await connection.query('DELETE FROM instance_members WHERE instance_id IN (SELECT id FROM n8n_instances WHERE user_id = ?)', [userId]);
        console.log('✅ Instance members deleted');

        await connection.query('DELETE FROM n8n_instances WHERE user_id = ?', [userId]);
        console.log('✅ N8N instances deleted');

        // 4. Delete subscription-related data
        await connection.query('DELETE FROM payments WHERE user_id = ?', [userId]);
        console.log('✅ Payments deleted');

        await connection.query('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
        console.log('✅ Subscriptions deleted');

        await connection.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]);
        console.log('✅ User subscriptions deleted');

        // 5. Delete user sessions
        await connection.query('DELETE FROM sessions WHERE session_id LIKE ?', [`%"userId":${userId}%`]);
        console.log('✅ Sessions deleted');

        // 6. Finally, delete the user account
        await connection.query('DELETE FROM users WHERE id = ?', [userId]);
        console.log('✅ User account deleted');

        await connection.commit();

        // Destroy the session
        req.session.destroy();

        console.log(`✅ Account deletion completed for user ID: ${userId}`);

        res.json({ 
            success: true, 
            message: 'Votre compte et toutes vos données ont été supprimés avec succès' 
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting account:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la suppression du compte',
            details: error.message 
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
