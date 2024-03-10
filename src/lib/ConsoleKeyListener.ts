
import { EventDispatcher } from "./EventDispatcher";
import * as readline from "readline";



export class ConsoleKeyListener extends EventDispatcher<{
    'press': { sequence: string, name: string, ctrl: boolean, meta: boolean, shift: boolean };
}> {
    public readonly stdin: NodeJS.ReadStream;
    private readonly interface: readline.Interface;
    private onKeyPress?: (_: any, key: any) => void;

    constructor(stdin: NodeJS.ReadStream) {
        super();

        this.stdin = stdin;

        this.interface = readline.createInterface({
            input: this.stdin
        });
        readline.emitKeypressEvents(this.stdin, this.interface);

        if(this.stdin.isTTY) {
            this.stdin.setRawMode(true);
        }

        this.onKeyPress = (_: any, key: any) => this.dispatchEvent('press', key);
        this.stdin.addListener('keypress', this.onKeyPress);
    }

    public destroy() {
        if(this.onKeyPress) {
            this.stdin.removeListener('keypress', this.onKeyPress);
            delete this.onKeyPress;
        }
        this.interface.close();
        this.destroyDispatcher();
    }
}


