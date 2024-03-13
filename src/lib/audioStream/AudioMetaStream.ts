
import { Readable } from "stream";
import { EventDispatcher } from "../EventDispatcher";



export abstract class AudioMetaStream<Meta> extends EventDispatcher<{
    meta: Meta;
    readableChange: Readable | undefined;
}> {

    public abstract get playing(): boolean;

    public abstract start(): Promise<void>;
    public abstract pause(): Promise<void>;

    private _readable?: Readable;
    protected set readable(readable: Readable | undefined) {
        if(this._readable) {
            this._readable.destroy();
        }
        this._readable = readable;
        // BUG: Why need to check for is destroyed if in this.destroy() we call this.destroyDispatcher() last?
        if(!this.dispatcherDestroyed) {
            this.dispatchEvent('readableChange', this._readable);
        }
    }
    public get readable(): Readable | undefined { return this._readable; };

    public abstract destroy(): Promise<void>;

}


