import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";
import { getPlayerStats, generateGPIChartUrl } from "./riot-api.js";

// Helper: Format recent matches as aligned table
function formatRecentMatchesTable(matches) {
  if (matches.length === 0) return "```No recent games found```";
  
  const lines = matches.slice(0, 5).map(match => {
    const result = match.win ? "W" : "L";
    const champion = match.championName.substring(0, 10).padEnd(10);
    const role = match.role.substring(0, 3).padEnd(3);
    const kda = `${match.kills}/${match.deaths}/${match.assists}`.padEnd(9);
    const kdaRatio = match.kda === "Perfect" ? "Perfect" : match.kda.padStart(4);
    const cs = match.csPerMin.padStart(3);
    const vision = match.visionPerMin.padStart(3);
    const kp = `${match.killParticipation}%`.padStart(5);
    
    return `${result} ${champion} ${role} ${kda} ${kdaRatio} ${cs}cs ${vision}v ${kp}`;
  });
  
  return "```" + lines.join("\n") + "```";
}

// Helper: Generate GPI summary (top 2 strengths, top weakness)
function gpiSummary(metrics) {
  const entries = Object.entries(metrics).sort((a, b) => b[1] - a[1]);
  const strengths = entries.slice(0, 2).filter(([, v]) => v >= 60);
  const weaknesses = entries.slice(-1).filter(([, v]) => v < 50);
  
  const parts = [];
  if (strengths.length > 0) {
    parts.push(`Strong ${strengths.map(([k]) => k).join(", ")}`);
  }
  if (weaknesses.length > 0) {
    parts.push(`weak ${weaknesses[0][0]}`);
  }
  
  return parts.length > 0 ? parts.join(" • ") : "Balanced performance";
}

// Helper: Create 10-block progress bar
function bar10(value) {
  const filled = Math.round((value / 100) * 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

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

    // Handle /loldle command
    if (interaction.commandName === "loldle") {
      const guild = interaction.guild;
      const emote = getRandomEmote(guild);
      const message = getRandomItem(cuteMessages);
      const row = createLoldleButton();

      await interaction.reply({
        content: `${interaction.user} used \`/loldle\`, ${message} ${emote}`,
        components: [row],
        allowedMentions: { users: [] }
      });
      return;
    }

    // Handle /lookup command
    if (interaction.commandName === "lookup") {
      await interaction.deferReply(); // This can take a while

      const riotId = interaction.options.getString("riotid");
      const region = interaction.options.getString("region") || "na1";
      
      try {
        const stats = await getPlayerStats(riotId, region);
        
        const profileIconUrl = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${stats.summoner.profileIconId}.png`;
        
        // Create the embed with clean hierarchy
        const embed = new EmbedBuilder()
          .setColor(0xCD5C93)
          .setAuthor({ 
            name: `${stats.account.gameName}#${stats.account.tagLine}`, 
            iconURL: profileIconUrl 
          })
          .setDescription(`Level ${stats.summoner.level} • Role: **${stats.primaryRole}** • Region: **${region.toUpperCase()}**`)
          .setTimestamp();

        // Row 1: Ranked + GPI
        const rankedValue = stats.ranked 
          ? `**${stats.ranked.tier} ${stats.ranked.rank}** • ${stats.ranked.lp} LP\n${stats.ranked.wins}W–${stats.ranked.losses}L (${stats.ranked.winRate}%)`
          : (stats.summoner.id ? "Unranked" : "Rank unavailable");

        const gpiValue = `**${stats.gpi.overall}/100**\n${gpiSummary(stats.gpi.metrics)}`;

        embed.addFields(
          { name: "🏆 Ranked", value: rankedValue, inline: true },
          { name: "⚡ GPI", value: gpiValue, inline: true }
        );

        // Row 2: Averages (if we have match data)
        if (stats.recentMatches.length > 0) {
          const avgKDA = stats.recentMatches.reduce((sum, m) => {
            const kda = m.deaths === 0 ? 5 : (m.kills + m.assists) / m.deaths;
            return sum + kda;
          }, 0) / stats.recentMatches.length;

          const avgCS = stats.recentMatches.reduce((sum, m) => sum + parseFloat(m.csPerMin), 0) / stats.recentMatches.length;
          const avgVision = stats.recentMatches.reduce((sum, m) => sum + parseFloat(m.visionPerMin), 0) / stats.recentMatches.length;
          const avgKP = stats.recentMatches.reduce((sum, m) => sum + parseFloat(m.killParticipation), 0) / stats.recentMatches.length;

          embed.addFields(
            { name: "💀 KDA", value: avgKDA.toFixed(2), inline: true },
            { name: "🌾 CS/min", value: avgCS.toFixed(1), inline: true },
            { name: "👁️ Vision", value: avgVision.toFixed(1), inline: true }
          );

          embed.addFields({
            name: "🤝 KP",
            value: `${avgKP.toFixed(1)}%`,
            inline: true
          });

          // Recent matches table
          embed.addFields({
            name: "📊 Last 5 Games",
            value: formatRecentMatchesTable(stats.recentMatches),
            inline: false
          });

          // GPI breakdown with bars
          const gpiBreakdown = 
            `Aggression    ${bar10(stats.gpi.metrics.aggression)} ${stats.gpi.metrics.aggression}\n` +
            `Farming       ${bar10(stats.gpi.metrics.farming)} ${stats.gpi.metrics.farming}\n` +
            `Vision        ${bar10(stats.gpi.metrics.vision)} ${stats.gpi.metrics.vision}\n` +
            `Consistency   ${bar10(stats.gpi.metrics.consistency)} ${stats.gpi.metrics.consistency}\n` +
            `Teamfighting  ${bar10(stats.gpi.metrics.teamfighting)} ${stats.gpi.metrics.teamfighting}\n` +
            `Survivability ${bar10(stats.gpi.metrics.survivability)} ${stats.gpi.metrics.survivability}`;
          
          embed.addFields({
            name: "📈 GPI Breakdown",
            value: "```" + gpiBreakdown + "```",
            inline: false
          });
        } else {
          embed.addFields({
            name: "📊 Recent Games",
            value: "No recent games found",
            inline: false
          });
        }

        embed.setFooter({ text: "Riot Games API • Last 5 games" });

        await interaction.editReply({ embeds: [embed] });
        
      } catch (error) {
        console.error("Error in /lookup command:", error);
        
        let errorMsg = "Failed to fetch player stats. Please try again.";
        if (error.message.includes("not found")) {
          errorMsg = "❌ Summoner not found. Make sure you're using the correct format: `GameName#TAG`\nExample: `Faker#KR1`";
        } else if (error.response?.status === 403) {
          errorMsg = "❌ Invalid Riot API key. Please check your configuration.";
        } else if (error.response?.status === 429) {
          errorMsg = "❌ Rate limit exceeded. Please try again in a moment.";
        }

        await interaction.editReply({ content: errorMsg });
      }
      return;
    }

  } catch (err) {
    console.error("interactionCreate error:", err);

    // best-effort user feedback
    if (interaction?.isRepliable()) {
      const msg = "Something went wrong processing your command.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(token);
