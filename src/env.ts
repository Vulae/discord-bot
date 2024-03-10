
import * as z from "zod";
import * as dotenv from "dotenv";



const ENV_SCHEMA = z.object({
    DISCORD_BOT_TOKEN: z.string(),
    DISCORD_BOT_APPLICATION_ID: z.string()
});



const ENV = ENV_SCHEMA.parse(dotenv.config().parsed);

export default ENV;


