import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID; // optional for faster dev

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("loldle")
    .setDescription("Open today's LoLdle")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(token);

try {
  if (guildId) {
    console.log("Registering guild command...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    console.log("Done. (Guild commands update fast)");
  } else {
    console.log("Registering global command...");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Done. (Global commands can take a while to appear)");
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
