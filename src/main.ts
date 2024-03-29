
import { Client, GatewayIntentBits } from "discord.js";
import env from "./env";
import { CommandRegistry } from "./lib/CommandRegistry";
import { ConsoleKeyListener } from "./lib/ConsoleKeyListener";





(async function() {

    const client = new Client({ intents: [ GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates ] });

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
                const registered = await commandRegistry.register(client);
                console.log(`Registered: ${registered.map(cmd => cmd.name).join(', ')}`);
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


