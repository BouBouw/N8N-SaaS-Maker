const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../config/database');
const passport = require('../config/passport');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

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

        res.json({ user: users[0] });
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

module.exports = router;
