
import { Awaitable, Client, CommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js"



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

}


