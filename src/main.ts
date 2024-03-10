
import { Client } from "discord.js";
import env from "./env";
import { CommandRegistry } from "./modules/CommandRegistry";
import { ConsoleKeyListener } from "./modules/ConsoleKeyListener";





(async function() {

    const client = new Client({ intents: [ ] });

    const commandRegistry = new CommandRegistry();



    const consoleKeyListener = new ConsoleKeyListener(process.stdin);
    consoleKeyListener.addEventListener('press', async ({ data: key }) => {
        if(key.name == 'c' && key.ctrl) {
            console.log('Exiting');
            consoleKeyListener.destroy();
            await commandRegistry.unload(client);
            await client.destroy();
        } else if(key.name == 'r') {
            console.log('Reloading commands');
            await commandRegistry.reload(client);
            if(key.ctrl) {
                console.log('Registering commands');
                await commandRegistry.register(client);
            }
        }
    });

    console.log("EXIT              | CTRL + C");
    console.log("RELOAD COMMANDS   | R");
    console.log("REGISTER COMMANDS | CTRL + R");



    await commandRegistry.load(client);



    client.on('ready', () => {
        console.log("Bot started");
    });

    client.on('interactionCreate', async interaction => {
        if(interaction.isCommand()) {
            await commandRegistry.execute(interaction);
        }
    });

    client.login(env.DISCORD_BOT_TOKEN);

})();


