
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join } from 'path';
import { pathToFileURL } from 'url';
import colors from 'colors';

dotenv.config();


const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a]
    }),
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Reaction,
        Partials.GuildScheduledEvent,
        Partials.User,
        Partials.ThreadMember,
    ]
});

client.commands = new Collection();

// Connexion à la base de données LogicAI
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "logicai_db",
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tester la connexion
pool.getConnection()
    .then(conn => {
        console.log('✅ Connected to database'.green);
        conn.release();
    })
    .catch(err => {
        console.error('❌ Database connection error:'.red, err);
    });

client.db = pool;



client.on('clientReady', async () => {
    const { Handler } = await import('./handlers/handler.js');
    const eventModule = await import(pathToFileURL(join(process.cwd(), 'src', 'events', 'client', 'clientReady.js')));
    const { execute } = eventModule.default;

    const handler = new Handler(client, pool);

    await handler.loadCommands();
    await handler.loadEvents();
    await handler.loadServer();

    await execute(client, pool);
});

await client.login(process.env.TOKEN);

export default { client, pool };