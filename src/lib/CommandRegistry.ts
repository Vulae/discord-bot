
import { Client, CommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { Command } from "./Command";
import path from "path";



// TODO: Clean up the try catch block hell.



export class CommandRegistry {

    private commands: Command[] = [];

    public async register(client: Client): Promise<RESTPostAPIChatInputApplicationCommandsJSONBody[]> {
        let json = await Promise.all(this.commands.map(async command => await command.builder()));
        await client.rest.put(Routes.applicationCommands(client.application!.id), { body: json });
        return json;
    }



    private async getCommandConstructors(): Promise<(new () => Command)[]> {
        return await (await import('../commands')).loadCommands();
    }



    private addDefaultCacheKeys(cachedKeys: string[]): string[] {
        cachedKeys.push('commands.ts');
        return cachedKeys;
    }

    private deleteCache(cachedKeys: string[]): void {
        for(const cachedKey of cachedKeys) {
            const cachePath = path.resolve(__dirname, '../', cachedKey);
            delete require.cache[cachePath];
        }
    }





    public async load(client: Client): Promise<void> {
        const commandConstructors = await this.getCommandConstructors();

        for(const CommandClass of commandConstructors) {
            const command = new CommandClass();
            try {
                await command.init(client);
            } catch(err) {
                try {
                    await command.handleError(err, 'init', client);
                } catch(err) {
                    await command.handleError(err, 'handleError', undefined);
                }
            }
            this.commands.push(command);
        }
    }

    public async unload(client: Client): Promise<void> {
        let cachedKeys: string[] = [];

        let command: Command | undefined = undefined;
        while(command = this.commands.pop()) {
            try {
                await command.destroy(client);
            } catch(err) {
                try {
                    await command.handleError(err, 'destroy', client);
                } catch(err) {
                    await command.handleError(err, 'handleError', undefined);
                }
            }
            cachedKeys.push(...command.hotReloadPaths);
        }

        this.addDefaultCacheKeys(cachedKeys);
        this.deleteCache(cachedKeys);
    }

    public async reload(client: Client): Promise<void> {
        await this.unload(client);
        await this.load(client);
    }

    // TODO: Probably want to have a static property on command to identify.
    private async unloadCommand(client: Client, constructorName: string, destroy: boolean = true): Promise<void> {
        const index = this.commands.findIndex(cmd => cmd.constructor.name == constructorName);
        if(index == -1) {
            throw new Error('Could not unload command.');
        }

        const command = this.commands.splice(index, 1).pop()!;

        if(destroy && !command.destroyed) {
            try {
                await command.destroy(client);
            } catch(err) {
                try {
                    await command.handleError(err, 'destroy', client);
                } catch(err) {
                    await command.handleError(err, 'handleError', undefined);
                }
            }
        }

        this.deleteCache(command.hotReloadPaths);
    }

    private async loadCommand(client: Client, constructorName: string): Promise<void> {
        this.deleteCache(this.addDefaultCacheKeys([]));

        const commandConstructors = await this.getCommandConstructors();
        const CommandClass = commandConstructors.find(cls => cls.name == constructorName);
        if(!CommandClass) {
            throw new Error('Could not reload command.');
        }

        const command = new CommandClass();
        try {
            await command.init(client);
        } catch(err) {
            try {
                await command.handleError(err, 'init', client);
            } catch(err) {
                await command.handleError(err, 'handleError', undefined);
            }
        }
        this.commands.push(command);
    }

    public async reloadCommand(client: Client, command: Command, destroy: boolean = true): Promise<void> {
        const constructorName = command.name;
        await this.unloadCommand(client, constructorName, destroy);
        await this.loadCommand(client, constructorName);
    }



    public async execute(interaction: CommandInteraction): Promise<void> {
        for(const command of this.commands) {
            if(command.name == interaction.commandName) {
                try {
                    await command.commandInteraction(interaction);
                } catch(err) {
                    try {
                        await command.handleError(err, 'commandInteraction', interaction);
                    } catch(err) {
                        await command.handleError(err, 'handleError', undefined);
                    }
                }
            }
        }
    }

}


