const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const passport = require('./config/passport');
const nodemailer = require('nodemailer');
const initializeDatabase = require('./config/initDatabase');
const autoSyncService = require('./services/autoSyncService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
    }
});

// Test Email Connection
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    transporter.verify((error, success) => {
        if (error) {
            console.log('❌ Échec de connexion au serveur mail:');
            console.log(`   Host: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
            console.log(`   User: ${process.env.EMAIL_USER}`);
            console.log(`   Error: ${error.message}`);
        } else {
            console.log('✅ Connexion au serveur mail réussie');
            console.log(`   Host: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
            console.log(`   User: ${process.env.EMAIL_USER}`);
        }
    });
} else {
    console.log('⚠️  Configuration email manquante - Les emails ne seront pas envoyés');
}

// Middleware
app.use(cors({
    origin: ['http://localhost:5002', 'http://localhost:5001', 'http://localhost:5173'],
    credentials: true
}));

// Stripe webhook needs raw body, so add this BEFORE express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const sessionMiddleware = session({
    key: 'logicai_session',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Share session with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/instances', require('./routes/instances'));
app.use('/activities', require('./routes/activities'));
app.use('/ai', require('./routes/ai'));
app.use('/members', require('./routes/members'));
app.use('/resources', require('./routes/resources'));
app.use('/workflows', require('./routes/workflows'));
app.use('/api-keys', require('./routes/apiKeys'));
app.use('/discord', require('./routes/discord'));
app.use('/stripe', require('./routes/stripe'));
app.use('/webhooks', require('./routes/webhooks'));

// Public API routes (with API key authentication)
app.use('/api/v1', require('./routes/api'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
});

// WebSocket connection
io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = session?.userId;

    console.log(`🔌 Client connected: ${socket.id}${userId ? ` (User: ${userId})` : ' (Guest)'}`);

    // Join user-specific room
    if (userId) {
        socket.join(`user:${userId}`);
    }

    // Example: Send instance updates
    socket.on('subscribe:instances', (data) => {
        if (userId) {
            console.log(`User ${userId} subscribed to instance updates`);
            // Join instances room
            socket.join(`instances:${userId}`);
        }
    });

    // Example: Handle real-time events
    socket.on('instance:action', async (data) => {
        if (!userId) {
            return socket.emit('error', { message: 'Non authentifié' });
        }

        console.log(`Instance action from user ${userId}:`, data);
        
        // Emit back to user
        io.to(`user:${userId}`).emit('instance:update', {
            instanceId: data.instanceId,
            status: 'processing',
            timestamp: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Start server
const PORT = process.env.PORT || 5000;

// Initialize database before starting server
initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
            console.log(`💾 Database: ${process.env.DB_NAME}`);
            console.log(`\n✨ LogicAI API ready!\n`);
            
            // Start auto-sync service after server is ready
            setTimeout(() => {
                autoSyncService.startAutoSync();
            }, 3000);
        });
    })
    .catch((error) => {
        console.error('❌ Failed to initialize database. Server not started.');
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    autoSyncService.stopAutoSync();
    server.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = { app, io };
