
import type { Command } from "./lib/Command";

export const loadCommands = async (): Promise<(new () => Command)[]> => {
    return [
        (await import('./commands/info')).default,
        (await import('./commands/ping')).default,
        (await import('./commands/radio')).default,
    ];
}
