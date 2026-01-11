import express from 'express';
import axios from 'axios';
import router from './routes/router.js';

const app = express();

// Middleware
app.use(express.json());

// Configuration API backend
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Instance axios pour communiquer avec le backend
const api = axios.create({
    baseURL: BACKEND_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Ajouter un intercepteur pour les erreurs
api.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
    }
);

export function startServer(client, connection) {
    const PORT = process.env.BOT_PORT || 3002;

    // Stocker le client Discord dans app.locals pour accès dans les routes
    app.locals.client = client;
    app.locals.connection = connection;

    // Monter le router
    app.use('/', router);

    app.listen(PORT, () => {
        console.log(`[BOT SERVER]`.bold.green + ` Running on port ${PORT}`.white);
    });

    return app;
}

// Exporter l'instance API pour utilisation dans les commandes
export { api, BACKEND_URL, FRONTEND_URL };
