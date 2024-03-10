
import { Awaitable, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../lib/Command";



export default class Command_Ping extends Command {

    public readonly hotReloadPaths: string[] = [ __filename ];

    public readonly id: string = 'vulae-command-ping';
    public readonly name: string = 'ping';

    public builder(): Awaitable<SlashCommandBuilder> {
        return new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with pong!');
    }

    public async commandInteraction(interaction: CommandInteraction): Promise<void> {
        await interaction.reply('Pinging. . .');
        const reply = await interaction.fetchReply();
        const ping = (reply.createdTimestamp - interaction.createdTimestamp);

        const pingColors = [{
            ping: 0,
            hex: 0x00FF21
        }, {
            ping: 250,
            hex: 0xF3FF00
        }, {
            ping: 500,
            hex: 0xFF4300
        }, {
            ping: Infinity,
            hex: 0x910003
        }];

        const color = pingColors.reverse().find(color => {
            return color.ping <= ping;
        }) ?? {
            ping: NaN,
            hex: 0x9C27B0
        };

        await interaction.editReply({
            content: '',
            embeds: [{
                title: '🏓 Pong!',
                color: color.hex,
                footer: {
                    text: `${ping}ms`
                }
            }]
        });
    }

}


