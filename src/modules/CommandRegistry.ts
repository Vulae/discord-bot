
import { Client, CommandInteraction, Routes } from "discord.js";
import { Command } from "./Command";
import path from "path";



export class CommandRegistry {

    // TODO: Make commands list file not hard coded.

    private commands: Command[] = [];

    public async register(client: Client) {
        let json = await Promise.all(this.commands.map(async command => (await command.builder()).toJSON()));
        await client.rest.put(Routes.applicationCommands(client.application!.id), { body: json });
    }



    public async load(client: Client): Promise<void> {
        let commandsList = (await import('../commands')).default;

        for(const CommandClass of commandsList) {
            const command = new CommandClass();
            await command.init(client);
            this.commands.push(command);
        }
    }

    public async unload(client: Client): Promise<void> {
        let cachedKeys: string[] = [];

        for(const command of this.commands) {
            this.commands.splice(this.commands.indexOf(command), 1);
            await command.destroy(client);
            cachedKeys.push(...command.hotReloadPaths);
        }

        cachedKeys.push('commands.ts');

        for(const cachedKey of cachedKeys) {
            const cachePath = path.resolve(__dirname, '../', cachedKey);
            delete require.cache[cachePath];
        }
    }

    public async reload(client: Client): Promise<void> {
        await this.unload(client);
        await this.load(client);
    }



    public async execute(interaction: CommandInteraction): Promise<void> {
        for(const command of this.commands) {
            if(command.name == interaction.commandName) {
                await command.commandInteraction(interaction);
            }
        }
    }

}


