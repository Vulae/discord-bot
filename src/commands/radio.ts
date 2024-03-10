
import { Awaitable, BaseInteraction, Client, CommandInteraction, SlashCommandBuilder, VoiceBasedChannel } from "discord.js";
import { Command } from "../lib/Command";
import { joinVoiceChannel, entersState, VoiceConnectionStatus, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioResource, AudioPlayer, VoiceConnection, AudioPlayerStatus, getVoiceConnection } from "@discordjs/voice";



async function findVoiceChannel(interaction: BaseInteraction): Promise<VoiceBasedChannel | null> {
    const guild = interaction.guild;
    if(!guild) return null;
    const member = await guild.members.fetch(interaction.user.id);
    return member.voice.channel;
}



// TODO: Rewrite this.
// TODO: Allow for different resource types: this.streams: { resource, player, { channel, connection, interaction }[] };
// TODO: Instant leave voice channel once empty.
// TODO: Extract audio resource metadata from stream, to display in embed.
// FIXME: Fix audio cutting out for very little time randomly. Probably to due with the audio input stream.
//        The audio input stream has no buffer, so some packets may come in later than others making it choppy.
export default class Command_Radio extends Command {

    public readonly hotReloadPaths: string[] = [ __filename ];

    public readonly id: string = 'vulae-command-radio';
    public readonly name: string = 'radio';

    public builder(): Awaitable<SlashCommandBuilder> {
        return new SlashCommandBuilder()
            .setName('radio')
            .setDescription('Join your voice channel with music.');
    }

    private resource?: AudioResource;
    private player?: AudioPlayer;
    // TODO: Fix naming, connection.connection is bad and ugly :(
    private connections: { connection: VoiceConnection, channel: VoiceBasedChannel, interval: NodeJS.Timeout }[] = [];

    private async getConnection(channel: VoiceBasedChannel): Promise<VoiceConnection> {
        const existingConnection = getVoiceConnection(channel.guildId, channel.id);
        if(existingConnection) {
            if(this.connections.some(connection => connection.connection == existingConnection && connection.channel.id == channel.id)) {
                return existingConnection;
            }
            throw new Error('Voice connection active that is not for /radio command.');
        }

        const connection = {
            connection: joinVoiceChannel({
                guildId: channel.guildId,
                channelId: channel.id,
                adapterCreator: channel.guild.voiceAdapterCreator
            }),
            channel,
            // There may be another way to detect number of users in channel.
            // Theres client.on('guildChannelChange') or something similar.
            interval: setInterval(async () => {
                // Force to skip cache.
                const channelUpdated = await channel.guild.channels.fetch(channel.id, { force: true });
                // @ts-ignore - members.size exists, it's just being stupid.
                if(!channelUpdated || channelUpdated.members.size <= 1) {
                    this.destroyConnection(connection.connection);
                    return;
                }
            }, 5 * 60 * 1000)
        };
        this.connections.push(connection);

        try {
            await entersState(connection.connection, VoiceConnectionStatus.Ready, 30000);
        } catch(err) {
            this.destroyConnection(connection.connection);
            throw err;
        }

        return connection.connection;
    }

    private destroyConnection(connection: VoiceConnection): void {
        const removeConnection = this.connections.find(c => c.connection = connection);
        if(!removeConnection) return;
        this.connections.splice(this.connections.indexOf(removeConnection), 1);
        clearInterval(removeConnection.interval);
        connection.destroy();
    }

    public async init(client: Client): Promise<void> {
        try {
            this.resource = createAudioResource('https://listen.moe/stream', {
                inlineVolume: true
            });
        } catch(err) {
            console.error(err);
        }
        this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        if(this.resource) {
            this.player.play(this.resource);
        }
    }

    public async destroy(client: Client): Promise<void> {
        while(this.connections.length > 0) {
            this.destroyConnection(this.connections[0].connection);
        }
        this.player?.stop();
        if(this.player) {
            this.player.state = { status: AudioPlayerStatus.Idle };
        }
    }

    public async commandInteraction(interaction: CommandInteraction): Promise<any> {
        const channel = await findVoiceChannel(interaction);
        if(!channel) {
            await interaction.reply("Invalid channel.");
            return;
        }

        await interaction.reply('Joining voice channel. . .');

        let connection: VoiceConnection;
        try {
            connection = await this.getConnection(channel);
        } catch(err) {
            await interaction.editReply('Failed to join your voice channel.');
            throw err;
        }

        connection.subscribe(this.player!);

        await interaction.editReply({
            content: '',
            embeds: [{
                color: 0xFF015B,
                title: 'LISTEN.moe',
                url: 'https://listen.moe',
                description: `Playing audio in [#${channel.name}](${channel.url})`,
                thumbnail: {
                    url: 'https://listen.moe/_nuxt/img/logo-square-64.248c1f3.png'
                }
            }]
        });

    }

}


