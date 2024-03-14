
import { Awaitable, Client, CommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js"



export interface ErrorHandleType {
    'other': any;
    // TODO: Implement this error.
    'builder': undefined;
    'init': Client;
    'destroy': Client;
    'commandInteraction': CommandInteraction;
    'handleError': undefined;
}



export abstract class Command {

    private _destroyed: boolean = false;
    public get destroyed(): boolean { return this._destroyed; }

    public abstract readonly hotReloadPaths: string[];
    
    public abstract readonly id: string;
    public abstract readonly name: string;

    public abstract builder(): Awaitable<RESTPostAPIChatInputApplicationCommandsJSONBody>;

    public init(client: Client): Awaitable<void> { }
    public destroy(client: Client): Awaitable<void> {
        this._destroyed = true;
    }

    public abstract commandInteraction(interaction: CommandInteraction): Promise<any>;

    public handleError<ErrType extends keyof ErrorHandleType>(err: any, type: ErrType, data: ErrorHandleType[ErrType]): Awaitable<any> {
        console.error('Command.handleError: ', err, type, data);
        throw new Error(`Command.handleError: Could not handle error "${this.name} ${type} error".`);
    }

}


