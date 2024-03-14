
import { AudioMetaStream } from "./AudioMetaStream";
import * as z from "zod";
import { WebSocket } from "../WebSocket";
import { PassThrough, Readable } from "stream";



const WS_RECV_HEARTBEAT_INIT = z.object({
    op: z.literal(0),
    d: z.object({
        message: z.string(),
        heartbeat: z.number()
    })
});

const WS_RECV_HEARTBEAT = z.object({
    op: z.literal(10)
});

const PLAYBACK_SONG = z.object({
    id: z.number().int(),
    title: z.string(),
    sources: z.array(z.object({
        id: z.number().int(),
        name: z.string().nullable(),
        nameRomaji: z.string().nullable(),
        image: z.string().nullable()
    })),
    artists: z.array(z.object({
        id: z.number().int(),
        name: z.string().nullable(),
        nameRomaji: z.string().nullable(),
        image: z.string().nullable()
    })),
    albums: z.array(z.object({
        id: z.number().int(),
        name: z.string().nullable(),
        nameRomaji: z.string().nullable(),
        image: z.string().nullable()
    })),
    characters: z.array(z.object({
        id: z.number().int(),
        name: z.string().nullable(),
        nameRomaji: z.string().nullable(),
        image: z.string().nullable()
    })),
    duration: z.number(),
    favorite: z.boolean().optional()
});

const WS_RECV_PLAYBACK_INFO = z.object({
    op: z.literal(1),
    t: z.enum([ "TRACK_UPDATE", "TRACK_UPDATE_REQUEST", "QUEUE_UPDATE", "NOTIFICATION" ]),
    d: z.object({
        listeners: z.number().int(),
        // TODO: What is this?
        requester: z.any(),
        // TODO: What is this?
        event: z.any(),
        startTime: z.coerce.date(),
        song: PLAYBACK_SONG,
        lastPlayed: z.array(PLAYBACK_SONG),
    })
});

type PlaybackInfo = z.TypeOf<typeof WS_RECV_PLAYBACK_INFO>;

const WS_RECV = z.union([ WS_RECV_HEARTBEAT_INIT, WS_RECV_HEARTBEAT, WS_RECV_PLAYBACK_INFO ]);

type Ws_Recv = z.TypeOf<typeof WS_RECV>;



const WS_SEND_HEARTBEAT = z.object({
    op: z.literal(9)
});

const WS_SEND = WS_SEND_HEARTBEAT;

type Ws_Send = z.TypeOf<typeof WS_SEND>;





export class ListenMoeStream extends AudioMetaStream<PlaybackInfo> {

    private _playing: boolean = false;
    public get playing(): boolean { return this._playing; }

    private _meta?: PlaybackInfo;
    private set meta(meta: PlaybackInfo | undefined) {
        this._meta = meta;
        if(this._meta) {
            this.dispatchEvent('meta', this._meta);
        }
    }
    public get meta(): PlaybackInfo | undefined { return this._meta; }

    private static readonly streamUrl: string = 'https://listen.moe/stream';
    private static readonly websocketUrl: string = 'wss://listen.moe/gateway_v2';

    private websocket?: WebSocket;

    private heartbeat?: NodeJS.Timeout;
    private stopHeartbeat(): void {
        if(this.heartbeat === undefined) return;
        clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }
    private startHeartbeat(delay: number): void {
        this.stopHeartbeat();

        const sendHeartbeat = () => {
            if(!this.websocket) {
                this.stopHeartbeat();
                return;
            }
            const send: Ws_Send = { op: 9 };
            this.websocket?.send(JSON.stringify(send));
        }

        sendHeartbeat();
        this.heartbeat = setInterval(() => sendHeartbeat(), delay);
    }

    private async startStream(): Promise<void> {
        if(this.dispatcherDestroyed) return;

        // FIXME: The stream still closes abnormally in VERY rare cases (currently unknown).
        
        console.debug('ListenMoeStream: Stream started.');
        const response = await fetch(ListenMoeStream.streamUrl);
        // @ts-ignore - TODO: Why does this @ts-ignore here?
        const audioStream = Readable.fromWeb(response.body!);
        // Add a large buffer to stop audio stream from reaching end.
        const passThrough = new PassThrough({
            highWaterMark: 1024 * 1024
        });
        audioStream.pipe(passThrough);

        passThrough.addListener('close', () => {
            // Passthrough may be destroyed at any time (eg: calling this.startStream())
            // So we need to destroy audioStream as well.
            if(passThrough.destroyed) {
                audioStream.destroy();
            }
        });

        this.readable = passThrough;
    }

    public async start(): Promise<void> {
        if(this.playing) return;
        this._playing = true;

        if(!this.websocket) {
            this.websocket = new WebSocket(ListenMoeStream.websocketUrl);
            await this.websocket.awaitConnected();

            this.websocket.addEventListener('message', async ({ data }) => {
                if(typeof data != 'string') {
                    data = new TextDecoder().decode(data);
                }
                const json = JSON.parse(data);
                const parsed = WS_RECV.parse(json);
                
                if(parsed.op == 0) {
                    // Request start heartbeat.
                    this.startHeartbeat(parsed.d.heartbeat);
                } else if(parsed.op == 1) {
                    // Song start.
                    this.meta = parsed;
                    await this.startStream();
                } else if(parsed.op == 10) {
                    // Heartbeat received.
                }
            });
        }

    }

    public async pause(): Promise<void> {
        if(!this.playing) return;
        this._playing = false;
        
        await this.websocket?.dispose();
        this.stopHeartbeat();
        this.websocket = undefined;
        this.meta = undefined;
        this.readable = undefined;
    }

    public async destroy(): Promise<void> {
        await this.pause();
        this.destroyDispatcher();
    }

}


