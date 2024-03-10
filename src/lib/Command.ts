
import { Awaitable, Client, CommandInteraction, SlashCommandBuilder } from "discord.js"



export abstract class Command {

    public abstract readonly hotReloadPaths: string[];
    
    public abstract readonly id: string;
    public abstract readonly name: string;

    public abstract builder(): Awaitable<SlashCommandBuilder>;

    public init(client: Client): Awaitable<void> { }
    public destroy(client: Client): Awaitable<void> { }

    public abstract commandInteraction(interaction: CommandInteraction): Promise<any>;

}


