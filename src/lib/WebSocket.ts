
import { w3cwebsocket } from "websocket";
import { EventDispatcher } from "./EventDispatcher";



export enum WebSocketStatus {
    Closed = 'closed',
    Open = 'open',
    Opening = 'opening'
}



export class WebSocket extends EventDispatcher<{
    'open': void;
    'close': { code: number, reason: string, wasClean: boolean };
    'error': Error;
    'message': string | ArrayBuffer;
}> {

    public readonly url: string;
    public readonly ws: w3cwebsocket;

    private _status: WebSocketStatus = WebSocketStatus.Closed;
    public get status(): WebSocketStatus {
        return this._status;
    }

    constructor(url: string) {
        super();
        
        this.url = url;
        this.ws = new w3cwebsocket(this.url);

        this._status = WebSocketStatus.Opening;

        this.ws.onopen = () => {
            this._status = WebSocketStatus.Open;
            this.dispatchEvent('open', void 0);
        }
        this.ws.onclose = event => {
            this._status = WebSocketStatus.Closed;
            this.dispatchEvent('close', event);
        }
        this.ws.onerror = error => {
            this.dispatchEvent('error', error);
        }
        this.ws.onmessage = message => {
            this.dispatchEvent('message', message.data);
        }
    }

    public send(data: ArrayBuffer | string): void {
        if(this._status != WebSocketStatus.Open) {
            throw new Error('Tried to send websocket data while connection is not open.');
        }
        this.ws.send(data);
    }

    public awaitConnected(): Promise<void> {
        return new Promise((resolve, reject) => {

            if(this.status == WebSocketStatus.Open) {
                return resolve();
            }

            // TODO: Better errors here.

            const openListener = this.addEventListener('open', () => {
                if(this._status != WebSocketStatus.Open) return;
                this.removeEventListener(openListener);
                resolve();
            }, true);

        });
    }

    public dispose(): Promise<void> {
        return new Promise((resolve, reject) => {

            // TODO: Better errors here.

            const closeListener = this.addEventListener('close', () => {
                if(this._status != WebSocketStatus.Closed) return;
                this.removeEventListener(closeListener);
                this.destroyDispatcher();
                resolve();
            });

            this.ws.close();

        });
    }

}


