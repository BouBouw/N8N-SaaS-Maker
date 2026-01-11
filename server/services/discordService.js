const axios = require('axios');
const db = require('../config/database');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/dashboard/settings?discord=callback';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

/**
 * Generate Discord OAuth2 authorization URL
 */
function getAuthorizationUrl(userId) {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email',
        state: userId.toString() // Pass user ID to verify in callback
    });

    return `${DISCORD_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCode(code) {
    try {
        const response = await axios.post(
            DISCORD_TOKEN_URL,
            new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: DISCORD_REDIRECT_URI
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Discord token exchange error:', error.response?.data || error.message);
        throw new Error('Failed to exchange Discord authorization code');
    }
}

/**
 * Get Discord user information
 */
async function getDiscordUser(accessToken) {
    try {
        const response = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('Discord user fetch error:', error.response?.data || error.message);
        throw new Error('Failed to fetch Discord user information');
    }
}



/**
 * Link Discord account to user
 */
async function linkDiscordAccount(userId, code) {
    try {
        // Exchange code for tokens
        const tokenData = await exchangeCode(code);
        const { access_token } = tokenData;

        // Get Discord user info
        const discordUser = await getDiscordUser(access_token);

        // Update user in database (only discord_id and avatar)
        const [result] = await db.execute(
            `UPDATE users 
             SET discord_id = ?, 
                 avatar = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [
                discordUser.id,
                discordUser.avatar,
                userId
            ]
        );

        if (result.affectedRows === 0) {
            throw new Error('User not found');
        }

        return {
            id: discordUser.id,
            avatar: discordUser.avatar,
            avatarUrl: discordUser.avatar 
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null
        };
    } catch (error) {
        console.error('Discord account linking error:', error);
        throw error;
    }
}

/**
 * Get user's Discord connection info
 */
async function getDiscordConnection(userId) {
    try {
        const [rows] = await db.execute(
            `SELECT discord_id, avatar
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            throw new Error('User not found');
        }

        const user = rows[0];

        if (!user.discord_id) {
            return null; // No Discord connection
        }

        // Check if avatar is already a full URL or just a hash
        let avatarUrl = null;
        if (user.avatar) {
            if (user.avatar.startsWith('http')) {
                // Already a full URL
                avatarUrl = user.avatar;
            } else {
                // It's a hash, construct the URL
                avatarUrl = `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`;
            }
        }

        return {
            id: user.discord_id,
            avatar: user.avatar,
            avatarUrl: avatarUrl
        };
    } catch (error) {
        console.error('Discord connection fetch error:', error);
        throw error;
    }
}

/**
 * Unlink Discord account from user
 */
async function unlinkDiscordAccount(userId) {
    try {
        const [result] = await db.execute(
            `UPDATE users 
             SET discord_id = NULL,
                 avatar = NULL,
                 updated_at = NOW()
             WHERE id = ?`,
            [userId]
        );

        if (result.affectedRows === 0) {
            throw new Error('User not found');
        }

        return true;
    } catch (error) {
        console.error('Discord account unlinking error:', error);
        throw error;
    }
}



module.exports = {
    getAuthorizationUrl,
    linkDiscordAccount,
    getDiscordConnection,
    unlinkDiscordAccount
};
