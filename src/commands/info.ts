
import { Awaitable, CommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder } from "discord.js";
import { Command } from "../lib/Command";
import { execute } from "../lib/Util";



export default class Command_Info extends Command {

    public readonly hotReloadPaths: string[] = [ __filename ];

    public readonly id: string = 'vulae-command-info';
    public readonly name: string = 'info';

    public builder(): Awaitable<RESTPostAPIChatInputApplicationCommandsJSONBody> {
        return new SlashCommandBuilder()
            .setName('info')
            .setDescription('Information about the bot.')
            .toJSON();
    }

    public async commandInteraction(interaction: CommandInteraction): Promise<any> {
        const commit = (await execute('git rev-parse --short HEAD')).trim();
        const isRunningOnCommit = (await execute('git status --porcelain')).trim().length == 0;

        await interaction.reply({
            embeds: [{
                author: {
                    name: interaction.client.user.displayName,
                    icon_url: interaction.client.user.avatarURL() ?? interaction.client.user.defaultAvatarURL,
                    url: 'https://github.com/Vulae/discord-bot'
                },
                color: 0xE91E63,
                fields: [{
                    name: 'Commit',
                    value: `\`${commit}${!isRunningOnCommit ? '-DEV' : ''}\``
                }]
            }]
        });
    }

}


