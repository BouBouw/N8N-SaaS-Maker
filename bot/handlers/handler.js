import { readdirSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from '../src/server/app.js';

class Handler {
    allowedExts = ['js']
    commands = []

    client
    connection

    constructor(client, connection) {
        this.client = client
        this.connection = connection
    }

    async connectDatabase(connection) {
        try {
            await connection.connect()
            console.log(`[SQL]`.bold.white + ` Databases has been connected!`.bold.green);

            this.connection = connection
        } catch (error) {
            throw new Error(error)
        }
    }

    async loadCommands(directory = 'src/commands') {
        const commandsArray = [];
        const load = async (dir) => {
            const files = readdirSync(dir);

            for (const file of files) {
                const fullPath = join(dir, file);
                const stat = await lstat(fullPath);

                if (stat.isDirectory()) {
                    await load(fullPath);
                    continue;
                }

                if (stat.isFile() && this.fileHasValidExtension(fullPath)) {
                    const command = await import(pathToFileURL(join(process.cwd(), fullPath)));
                    const cmd = command.default || command;
                    if (cmd && (cmd.data || cmd.name)) {
                        const commandName = cmd.data?.name || cmd.name;
                        this.client.commands.set(commandName, cmd);

                        // Pour les commandes avec SlashCommandBuilder
                        if (cmd.data) {
                            commandsArray.push(cmd.data.toJSON());
                        } else {
                            commandsArray.push(cmd);
                        }
                        console.log('[CMDS] Loading command: ' + `${commandName}`);
                    }
                }
            }
        }

        await load(directory);

        if (this.client.application?.commands) {
            // Récupère les commandes existantes pour garder l'Entry Point command
            const existingCommands = await this.client.application.commands.fetch();
            const entryPointCommand = existingCommands.find(cmd => cmd.integrationTypes?.includes(1)); // 1 = GUILD_INSTALL

            // Si un Entry Point existe, on le garde dans la liste
            if (entryPointCommand && !commandsArray.find(cmd => cmd.name === entryPointCommand.name)) {
                console.log('[API]'.bold.yellow + ' Keeping Entry Point command: '.white + `${entryPointCommand.name}`.cyan);
                commandsArray.push({
                    name: entryPointCommand.name,
                    description: entryPointCommand.description,
                    type: entryPointCommand.type,
                    integration_types: entryPointCommand.integrationTypes,
                    contexts: entryPointCommand.contexts
                });
            }

            await this.client.application.commands.set(commandsArray);
            console.log('[API]'.bold.green + ' Slash commands synchronized with Discord.'.white);
        }
    }

    async loadEvents(directory = 'src/events') {
        return Promise.all(
            readdirSync(directory).map(async (path) => {
                const location = join(directory, path)
                const stat = await lstat(location)

                if (stat.isDirectory()) {
                    await this.loadEvents(location)
                }

                if (stat.isFile() && this.fileHasValidExtension(location)) {
                    const eventModule = await import(pathToFileURL(join(process.cwd(), location)));
                    const { name, execute } = eventModule.default || eventModule;
                    this.client.on(name, (...args) => execute(...args, this.client, this.connection));
                    console.log('[EVENTS]'.bold.yellow + ' Loading event :'.bold.white + ` ${name}`.bold.yellow);
                }
            })
        )
    }

    async loadServer(directory = 'src/server') {
        startServer(this.client, this.connection);
    }

    fileHasValidExtension(path) {
        const uri = path.split('.')
        return this.allowedExts.some((element) => element == uri[uri.length - 1])
    }

}

export { Handler };