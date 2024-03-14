
import { Awaitable, BaseInteraction, Client, CommandInteraction, EmbedBuilder, Message, MessageEditOptions, MessagePayload, RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder, VoiceBasedChannel, VoiceState } from "discord.js";
import { Command } from "../lib/Command";
import { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioResource, AudioPlayer, VoiceConnection, AudioPlayerStatus, getVoiceConnection } from "@discordjs/voice";
import { AudioMetaStream } from "../lib/audioStream/AudioMetaStream";
import { EventDispatcher } from "../lib/EventDispatcher";
import { ListenMoeStream } from "../lib/audioStream/ListenMoeStream";
import { waitUntil } from "../lib/Util";



async function findVoiceChannel(interaction: BaseInteraction): Promise<VoiceBasedChannel | null> {
    const guild = interaction.guild;
    if(!guild) return null;
    const member = await guild.members.fetch(interaction.user.id);
    return member.voice.channel;
}





interface SongInfo {
    id: string;
    title: string;
    artists: string[];
    sources: string[];
    cover: string | null;
    lengthSeconds: number | null;
    url?: string;
}

class Radio<Meta> extends EventDispatcher<{
    songChange: SongInfo | null;
}> {
    private _songInfo: SongInfo | null = null;
    public set songInfo(songInfo: SongInfo | null) {
        if(songInfo == this._songInfo) return;
        this._songInfo = songInfo;
        this.dispatchEvent('songChange', this._songInfo);
    }
    public get songInfo(): SongInfo | null { return this._songInfo; }

    public readonly stream: AudioMetaStream<Meta>;
    private resource: AudioResource | null = null;
    private readonly player: AudioPlayer;
    public readonly connections: VoiceConnection[] = [];

    public readonly url: string;
    public readonly name: string;
    public readonly color: number;
    public readonly icon: string;

    constructor(stream: AudioMetaStream<Meta>, onMeta: (meta: Meta, radio: Radio<Meta>) => Awaitable<void>, display: {
        url: string;
        name: string;
        color: number;
        icon: string;
    }) {
        super();

        this.stream = stream;

        this.url = display.url;
        this.name = display.name;
        this.color = display.color;
        this.icon = display.icon;

        this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

        this.stream.addEventListener('readableChange', ({ data: readable }) => {
            if(readable) {
                this.player.stop();
                this.resource = createAudioResource(readable, { inlineVolume: true });
                this.player.play(this.resource);
            } else {
                this.player.stop();
                this.resource = null;
            }
        });

        this.stream.addEventListener('meta', async ({ data: meta }) => {
            await onMeta(meta, this);
        });

    }

    public async addConnection(connection: VoiceConnection): Promise<void> {
        if(this.connections.includes(connection)) {
            return;
        }
        this.connections.push(connection);
        connection.subscribe(this.player);
        if(!this.stream.playing) {
            await this.stream.start();
        }
    }

    public async removeConnection(connection: VoiceConnection): Promise<void> {
        const index = this.connections.indexOf(connection);
        if(index >= 0) {
            this.connections.splice(index, 1);
            // ??? No unsubscribe for connection?
            // connection.unsubscribe();
            if(this.connections.length == 0 && this.stream.playing) {
                await this.stream.pause();
            }
        }
    }

    public async destroy(): Promise<void> {
        this.connections.splice(0, Infinity);
        await this.stream.destroy();
        this.player.state = { status: AudioPlayerStatus.Idle };
        this.destroyDispatcher();
    }

}





const RADIO_NAME_LISTEN_MOE = 'LISTEN.moe';

async function getRadios(): Promise<{[key: string]: Radio<any>}> {
    return {
        [RADIO_NAME_LISTEN_MOE]: new Radio(new ListenMoeStream(), async (meta, radio) => {
            const songInfo = radio.songInfo;
            if(songInfo) {
                if(songInfo.id == meta.d.song.id.toString()) {
                    return;
                }
            }

            await waitUntil(meta.d.startTime);

            radio.songInfo = {
                id: meta.d.song.id.toString(),
                title: meta.d.song.title,
                artists: meta.d.song.artists
                    .map(artist => artist.nameRomaji ?? artist.name)
                    .filter(artist => artist != null) as string[],
                sources: meta.d.song.sources
                    .map(source => source.nameRomaji ?? source.name)
                    .filter(source => source != null) as string[],
                cover: (meta.d.song.albums.length > 0 ? (
                    meta.d.song.albums[0].image ?
                    `https://cdn.listen.moe/covers/${meta.d.song.albums[0].image}` :
                    'https://listen.moe/_nuxt/img/blank-dark.cd1c044.png'
                ) : 'https://listen.moe/_nuxt/img/blank-dark.cd1c044.png'),
                lengthSeconds: meta.d.song.duration,
                // FIXME: This sometimes generates links that do not have any highlight.
                // e.g.: https://listen.moe/artists/702#:~:text=Uploader-,5337
                url: (meta.d.song.artists.length > 0 ? `https://listen.moe/artists/${meta.d.song.artists[0].id}#:~:text=Uploader-,${meta.d.song.id}` : undefined)
            };
        }, {
            name: RADIO_NAME_LISTEN_MOE,
            url: 'https://listen.moe',
            color: 0xFF015B,
            icon: 'https://listen.moe/_nuxt/img/logo-square-64.248c1f3.png'
        })
    };
}





class Player {
    public radio: Radio<any>;
    public readonly connection: VoiceConnection;
    public channel: VoiceBasedChannel;
    // We use a message here instead of interaction reply.
    // interaction reply has a maximum of 15 minutes lifetime (able to still be changed.)
    public readonly message: Message;

    constructor(radio: Radio<any>, connection: VoiceConnection, channel: VoiceBasedChannel, message: Message) {
        this.radio = radio;
        this.connection = connection;
        this.channel = channel;
        this.message = message;
    }

    public async changeRadio(radio: Radio<any>) {
        if(this.radio.name == radio.name) return;
        await this.radio.removeConnection(this.connection);
        this.radio = radio;
        await this.radio.addConnection(this.connection);
    }

    public async move(channel: VoiceBasedChannel): Promise<void> {
        if(this.channel.equals(channel)) return;
        this.connection.rejoin({
            channelId: channel.id,
            selfDeaf: true,
            selfMute: false
        });
        this.channel = channel;
        await this.updateMessage();
    }

    public async destroy(): Promise<void> {
        this.connection.destroy();
        await this.message.delete();
    }

    private getMessage(): MessagePayload | MessageEditOptions {
        const songInfo = this.radio.songInfo;

        if(!songInfo) {
            return {
                content: '',
                embeds: [{
                    color: this.radio.color,
                    title: this.radio.name,
                    url: this.radio.url,
                    description: `Playing in [\`#${this.channel.name}\`](${this.channel.url})`,
                    thumbnail: {
                        url: this.radio.icon
                    }
                }]
            };
        }

        const embed = new EmbedBuilder();
        embed.setColor(this.radio.color);
        if(songInfo.url) {
            embed.setURL(songInfo.url!);
        }
        embed.setTitle(songInfo.artists.join(', '));
        embed.setDescription(`### ${songInfo.title} ${songInfo.sources.map(source => `[${source}]`).join(' ')}`);
        embed.setThumbnail(songInfo.cover);
        embed.addFields({
            inline: false,
            name: (songInfo.lengthSeconds ?
                `Duration: \`${Math.floor(songInfo.lengthSeconds / 60)}:${String(songInfo.lengthSeconds % 60).padStart(2, '0')}\`` :
                ' '
            ),
            value: `Playing in [\`#${this.channel.name}\`](${this.channel.url})`
        }, {
            inline: false,
            name: ' ',
            value: `**[${this.radio.name}](${this.radio.url})**`
        });

        return { content: '', embeds: [ embed ] };
    }

    public async updateMessage(): Promise<void> {
        await this.message.edit(this.getMessage());
    }
}



// TODO: Leave voice channel once empty.
export default class Command_Radio extends Command {

    public readonly hotReloadPaths: string[] = [ __filename, 'lib/audioStream/ListenMoeStream.ts' ];

    public readonly id: string = 'vulae-command-radio';
    public readonly name: string = 'radio';

    public builder(): Awaitable<RESTPostAPIChatInputApplicationCommandsJSONBody> {
        return new SlashCommandBuilder()
            .setName('radio')
            .setDescription('Join your voice channel with music.')
            .addStringOption(option => option
                .setName('station')
                .setDescription('What radio station to stream from.')
                .setRequired(false)
                .addChoices(
                    { name: RADIO_NAME_LISTEN_MOE, value: RADIO_NAME_LISTEN_MOE }
                )
            )
            .toJSON();
    }

    private radios?: {[key: string]: Radio<any>};
    private readonly players: Player[] = [];

    private voiceStateUpdateFunc?: (oldState: VoiceState, newState: VoiceState) => Awaitable<void>;

    public async init(client: Client): Promise<void> {
        super.init(client);

        this.radios = await getRadios();

        this.voiceStateUpdateFunc = async (oldState, newState) => {
            const channel = oldState.channel;
            if(!channel) return;

            const listeners = channel.members.filter(listener => listener.id != client.user?.id);
            if(Array.from(listeners.entries()).length > 0) return;

            const players = this.players.filter(player => player.channel.equals(channel));
            for(const player of players) {
                const index = this.players.indexOf(player);
                if(index == -1) continue;
                this.players.splice(index, 1);
                await player.destroy();
            }
        }

        client.on('voiceStateUpdate', this.voiceStateUpdateFunc);
    }

    public async destroy(client: Client): Promise<void> {
        super.destroy(client);

        if(this.voiceStateUpdateFunc) {
            client.off('voiceStateUpdate', this.voiceStateUpdateFunc);
            this.voiceStateUpdateFunc = undefined;
        }

        let player: Player | undefined;
        while(player = this.players.pop()) {
            await player.destroy();
        }
        if(this.radios) {
            for(const key in this.radios) {
                const radio = this.radios[key]!;
                await radio.destroy();
                delete this.radios[key];
            }
        }
    }

    public async commandInteraction(interaction: CommandInteraction): Promise<any> {
        if(this.destroyed) return;
        if(!interaction.isChatInputCommand()) return;
        if(!interaction.inGuild()) return;

        const channel = await findVoiceChannel(interaction);
        if(!channel) {
            await interaction.reply({ content: 'Invalid channel.', ephemeral: true });
            return;
        }

        const radioName = interaction.options.getString('station', false) ?? RADIO_NAME_LISTEN_MOE;
        const radio = this.radios?.[radioName];
        if(!radio) {
            await interaction.reply({ content: `Invalid radio \`${radioName}\`.`, ephemeral: true });
            return;
        }

        // FIXME: This is stupid, is there any way to just not reply?
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();

        // TODO: Do a different way of doing this, this will not change player radio.
        const existingConnection = getVoiceConnection(interaction.guildId);
        if(existingConnection) {
            const existingPlayer = this.players.find(player => player.connection == existingConnection);
            if(!existingPlayer) return;
            await existingPlayer.move(channel);
            await existingPlayer.changeRadio(radio);
            return;
        }

        const message = await interaction.channel?.send({ content: 'Starting radio. . .' });
        if(!message) return;

        const player = new Player(
            radio,
            joinVoiceChannel({
                guildId: channel.guildId,
                channelId: channel.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            }),
            channel,
            message
        );

        this.players.push(player);
        await radio.addConnection(player.connection);

        radio.addEventListener('songChange', async () => {
            await player.updateMessage();
        });

        await player.updateMessage();

    }

}


