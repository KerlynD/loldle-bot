import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID; // Channel for daily announcements

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

// Array of cute messages
const cuteMessages = [
  "may your ranked games go well today",
  "good luck on the rift today",
  "time to test your League knowledge",
  "may the odds be ever in your favor",
  "let's see if you can guess today's champion",
  "hope you get a pentakill today",
  "time to prove you're a true League veteran",
  "may your queues be short and your LP high",
  "ready to flex that League knowledge",
  "let's get this bread... I mean RP",
  "time to show off those big brain plays",
  "may RNG bless you today",
  "Jason is fat",
  "cooka"
];

// Get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Get random server emote
function getRandomEmote(guild) {
  const emojis = guild.emojis.cache;
  if (emojis.size === 0) return "🎮"; // Fallback emoji if no server emotes
  
  const emojiArray = Array.from(emojis.values());
  const randomEmoji = getRandomItem(emojiArray);
  return randomEmoji.toString();
}

// Create the button component
function createLoldleButton() {
  const url = "https://loldle.net";
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Open today's LoLdle")
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

// Schedule daily announcement at 2am EST
function scheduleDailyAnnouncement() {
  // Check every minute if it's time to post
  setInterval(() => {
    const now = new Date();
    
    // Convert to EST (UTC-5)
    const estOffset = -5 * 60; // EST offset in minutes
    const estTime = new Date(now.getTime() + (estOffset + now.getTimezoneOffset()) * 60000);
    
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    
    // Check if it's 2:00 AM EST
    if (hour === 2 && minute === 0) {
      postDailyAnnouncement();
    }
  }, 60000); // Check every minute
}

async function postDailyAnnouncement() {
  if (!announcementChannelId) {
    console.log("No ANNOUNCEMENT_CHANNEL_ID set, skipping daily announcement");
    return;
  }

  try {
    const channel = await client.channels.fetch(announcementChannelId);
    if (!channel || !channel.isTextBased()) {
      console.error("Invalid announcement channel");
      return;
    }

    const guild = channel.guild;
    const emote = getRandomEmote(guild);
    const row = createLoldleButton();

    await channel.send({
      content: `🌅 **A new LoLdle has arrived!** Time to guess today's champions ${emote}`,
      components: [row]
    });
    
    console.log(`Posted daily LoLdle announcement at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("Error posting daily announcement:", err);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduleDailyAnnouncement();
  console.log("Daily announcement scheduler started (2am EST)");
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "loldle") return;

    const guild = interaction.guild;
    const emote = getRandomEmote(guild);
    const message = getRandomItem(cuteMessages);
    const row = createLoldleButton();

    // This posts in the channel and attributes the user.
    await interaction.reply({
      content: `${interaction.user} used \`/loldle\`, ${message} ${emote}`,
      components: [row],
      allowedMentions: { users: [] } // avoids pinging
    });
  } catch (err) {
    console.error("interactionCreate error:", err);

    // best-effort user feedback
    if (interaction?.isRepliable()) {
      const msg = "Something broke handling `/loldle`.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(token);
