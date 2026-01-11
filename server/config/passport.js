const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const pool = require('./database');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, rows[0]);
    } catch (error) {
        done(error, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists by discord_id
        const [existingByDiscord] = await pool.query(
            'SELECT * FROM users WHERE discord_id = ?',
            [profile.id]
        );

        if (existingByDiscord.length > 0) {
            return done(null, existingByDiscord[0]);
        }

        // Check if user exists by email
        const [existingByEmail] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [profile.email]
        );

        if (existingByEmail.length > 0) {
            // User exists with this email but no discord_id - link Discord account
            await pool.query(
                'UPDATE users SET discord_id = ?, avatar = ?, email_verified = ? WHERE id = ?',
                [profile.id, profile.avatar, profile.verified, existingByEmail[0].id]
            );

            const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ?', [existingByEmail[0].id]);
            return done(null, updatedUser[0]);
        }

        // Create new user
        const [result] = await pool.query(
            'INSERT INTO users (email, name, discord_id, avatar, email_verified) VALUES (?, ?, ?, ?, ?)',
            [
                profile.email,
                profile.username,
                profile.id,
                profile.avatar, // Store only the hash, not the full URL
                profile.verified
            ]
        );

        const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        done(null, newUser[0]);
    } catch (error) {
        done(error, null);
    }
}));

module.exports = passport;
