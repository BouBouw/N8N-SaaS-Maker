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
        // Check if user exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE discord_id = ?',
            [profile.id]
        );

        if (existingUsers.length > 0) {
            return done(null, existingUsers[0]);
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
