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
    .toJSON(),
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a League of Legends player's stats and performance")
    .addStringOption(option =>
      option
        .setName("riotid")
        .setDescription("Riot ID (e.g., PlayerName#NA1)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("region")
        .setDescription("Server region (default: NA)")
        .setRequired(false)
        .addChoices(
          { name: "NA", value: "na1" },
          { name: "EUW", value: "euw1" },
          { name: "EUNE", value: "eun1" },
          { name: "KR", value: "kr" },
          { name: "BR", value: "br1" },
          { name: "LAN", value: "la1" },
          { name: "LAS", value: "la2" },
          { name: "OCE", value: "oc1" },
          { name: "TR", value: "tr1" },
          { name: "RU", value: "ru" },
          { name: "JP", value: "jp1" }
        )
    )
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
