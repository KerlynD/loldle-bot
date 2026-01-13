import axios from "axios";

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Validate API key on module load
if (!RIOT_API_KEY) {
  console.error("RIOT_API_KEY is not set in environment variables!");
} else {
  console.log("RIOT_API_KEY loaded (length:", RIOT_API_KEY.length, ")");
}

// Platform to regional routing mapping
const PLATFORM_TO_REGIONAL = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",

  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",

  kr: "asia",
  jp1: "asia",
  sg2: "asia",
  tw2: "asia",
  vn2: "asia",
  th2: "asia",
  ph2: "asia"
};

// Role detection based on position
const ROLE_MAP = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support"
};

/**
 * Normalize platform name
 */
function normalizePlatform(platform) {
  const p = platform?.toLowerCase();
  if (!PLATFORM_TO_REGIONAL[p]) {
    throw new Error(`Unsupported platform region: ${platform}`);
  }
  return p;
}

/**
 * Get regional routing from platform
 */
function regionalFromPlatform(platform) {
  return PLATFORM_TO_REGIONAL[normalizePlatform(platform)];
}

/**
 * Format axios error for better debugging
 */
function formatAxiosError(error) {
  if (!error.response) return error.message;
  const { status, data } = error.response;
  return `HTTP ${status}: ${typeof data === "string" ? data : JSON.stringify(data)}`;
}

/**
 * Get account info by Riot ID (gameName#tagLine)
 */
export async function getAccountByRiotId(riotId, platform = "na1") {
  try {
    const [gameNameRaw, tagLineRaw] = riotId.split("#");
    const gameName = gameNameRaw?.trim();
    const tagLine = tagLineRaw?.trim();
    
    if (!gameName || !tagLine) {
      throw new Error("Invalid Riot ID format. Use: GameName#TAG");
    }

    const regional = regionalFromPlatform(platform);
    const url = `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    console.log("Account URL:", url);
    console.log("Platform:", platform, "→ Regional:", regional);
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY }
    });

    return response.data;
  } catch (error) {
    console.error("getAccountByRiotId error:", formatAxiosError(error));
    if (error.response?.status === 404) {
      throw new Error("Summoner not found. Check the Riot ID format (GameName#TAG)");
    }
    throw new Error(formatAxiosError(error));
  }
}

/**
 * Get summoner info by PUUID
 */
export async function getSummonerByPuuid(puuid, platform) {
  try {
    const p = normalizePlatform(platform);
    const url = `https://${p}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    console.log("Summoner URL:", url);
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY }
    });
    console.log("Summoner response:", JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error("getSummonerByPuuid error:", formatAxiosError(error));
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    throw new Error(formatAxiosError(error));
  }
}

/**
 * Get ranked stats
 */
export async function getRankedStats(summonerId, platform) {
  try {
    const p = normalizePlatform(platform);
    const url = `https://${p}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY }
    });
    return response.data;
  } catch (error) {
    console.error("getRankedStats error:", formatAxiosError(error));
    throw new Error(formatAxiosError(error));
  }
}

/**
 * Get match history (last N matches)
 */
export async function getMatchHistory(puuid, platform, count = 5) {
  try {
    const regional = regionalFromPlatform(platform);
    const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY }
    });
    return response.data;
  } catch (error) {
    console.error("getMatchHistory error:", formatAxiosError(error));
    throw new Error(formatAxiosError(error));
  }
}

/**
 * Get match details
 */
export async function getMatchDetails(matchId, platform) {
  try {
    const regional = regionalFromPlatform(platform);
    const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY }
    });
    return response.data;
  } catch (error) {
    console.error("getMatchDetails error:", formatAxiosError(error));
    throw new Error(formatAxiosError(error));
  }
}

/**
 * Get player's stats from a match
 */
function getPlayerStatsFromMatch(match, puuid) {
  const participant = match.info.participants.find(p => p.puuid === puuid);
  if (!participant) return null;

  const gameDurationMinutes = match.info.gameDuration / 60;
  
  return {
    championName: participant.championName,
    role: ROLE_MAP[participant.teamPosition] || "Unknown",
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
    csPerMin: ((participant.totalMinionsKilled + participant.neutralMinionsKilled) / gameDurationMinutes).toFixed(1),
    visionScore: participant.visionScore,
    visionPerMin: (participant.visionScore / gameDurationMinutes).toFixed(1),
    goldEarned: participant.goldEarned,
    damageDealt: participant.totalDamageDealtToChampions,
    win: participant.win,
    kda: participant.deaths === 0 ? "Perfect" : ((participant.kills + participant.assists) / participant.deaths).toFixed(2),
    killParticipation: calculateKillParticipation(match, participant),
    gameDuration: Math.floor(gameDurationMinutes)
  };
}

/**
 * Calculate kill participation percentage
 */
function calculateKillParticipation(match, participant) {
  const team = match.info.participants.filter(p => p.teamId === participant.teamId);
  const teamKills = team.reduce((sum, p) => sum + p.kills, 0);
  
  if (teamKills === 0) return 0;
  
  const playerContribution = participant.kills + participant.assists;
  return ((playerContribution / teamKills) * 100).toFixed(1);
}

/**
 * Calculate Gamer Performance Index (GPI)
 */
export function calculateGPI(recentMatches, rankedStats) {
  if (recentMatches.length === 0) {
    return {
      overall: 0,
      metrics: {
        aggression: 0,
        farming: 0,
        vision: 0,
        consistency: 0,
        teamfighting: 0,
        survivability: 0
      }
    };
  }

  // Calculate individual metrics (0-100 scale)
  
  // 1. Aggression (based on KDA and kill participation)
  const avgKDA = recentMatches.reduce((sum, m) => {
    const kda = m.deaths === 0 ? 5 : (m.kills + m.assists) / m.deaths;
    return sum + kda;
  }, 0) / recentMatches.length;
  const aggression = Math.min(100, (avgKDA / 5) * 100);

  // 2. Farming (CS per minute)
  const avgCSPerMin = recentMatches.reduce((sum, m) => sum + parseFloat(m.csPerMin), 0) / recentMatches.length;
  const farming = Math.min(100, (avgCSPerMin / 8) * 100); // 8 CS/min = 100

  // 3. Vision (Vision score per minute)
  const avgVisionPerMin = recentMatches.reduce((sum, m) => sum + parseFloat(m.visionPerMin), 0) / recentMatches.length;
  const vision = Math.min(100, (avgVisionPerMin / 2) * 100); // 2 vision/min = 100

  // 4. Consistency (based on win rate and recent form)
  const wins = recentMatches.filter(m => m.win).length;
  const winRate = (wins / recentMatches.length) * 100;
  const consistency = winRate;

  // 5. Teamfighting (Kill participation)
  const avgKP = recentMatches.reduce((sum, m) => sum + parseFloat(m.killParticipation), 0) / recentMatches.length;
  const teamfighting = avgKP;

  // 6. Survivability (inverse of deaths, normalized)
  const avgDeaths = recentMatches.reduce((sum, m) => sum + m.deaths, 0) / recentMatches.length;
  const survivability = Math.max(0, 100 - (avgDeaths * 10)); // 10+ deaths = 0

  const metrics = {
    aggression: Math.round(aggression),
    farming: Math.round(farming),
    vision: Math.round(vision),
    consistency: Math.round(consistency),
    teamfighting: Math.round(teamfighting),
    survivability: Math.round(survivability)
  };

  // Overall GPI (weighted average)
  const overall = Math.round(
    (metrics.aggression * 0.2) +
    (metrics.farming * 0.15) +
    (metrics.vision * 0.15) +
    (metrics.consistency * 0.2) +
    (metrics.teamfighting * 0.15) +
    (metrics.survivability * 0.15)
  );

  return { overall, metrics };
}

/**
 * Main function to get all player stats
 */
export async function getPlayerStats(riotId, platform = "na1") {
  try {
    console.log("=== getPlayerStats called ===");
    console.log("Riot ID:", riotId);
    console.log("Platform:", platform);
    console.log("Regional routing:", regionalFromPlatform(platform));
    
    // 1. Get account info
    const account = await getAccountByRiotId(riotId, platform);
    const puuid = account.puuid;
    console.log("Account fetched:", account);

    // 2. Get summoner info
    const summoner = await getSummonerByPuuid(puuid, platform);
    console.log("Summoner fetched:", summoner);

    // 3. Get ranked stats (optional - skip if summoner.id is missing)
    let soloQueue = null;
    
    if (summoner?.id) {
      try {
        const rankedData = await getRankedStats(summoner.id, platform);
        soloQueue = rankedData.find(q => q.queueType === "RANKED_SOLO_5x5") || null;
      } catch (error) {
        console.warn("Failed to fetch ranked stats:", formatAxiosError(error));
        // Continue without ranked data
      }
    } else {
      console.warn(
        `Summoner missing 'id' field (probably wrong platform).\n` +
        `Platform used: ${platform}\n` +
        `Response: ${JSON.stringify(summoner)}\n` +
        `Skipping ranked stats, continuing with match history.\n` +
        `User should try different region: EUW, EUNE, KR, BR, LAN, LAS, OCE, etc.`
      );
    }

    // 4. Get match history
    const matchIds = await getMatchHistory(puuid, platform, 5);

    // 5. Get details for each match (sequentially to avoid rate limits)
    const matchDetails = [];
    for (const id of matchIds) {
      const match = await getMatchDetails(id, platform);
      matchDetails.push(match);
    }

    // 6. Extract player stats from each match
    const recentMatches = matchDetails
      .map(match => getPlayerStatsFromMatch(match, puuid))
      .filter(stats => stats !== null);

    // 7. Calculate primary role
    const roleCounts = {};
    recentMatches.forEach(match => {
      roleCounts[match.role] = (roleCounts[match.role] || 0) + 1;
    });
    
    const roles = Object.entries(roleCounts);
    const primaryRole = roles.length === 0 
      ? "Unknown" 
      : roles.sort((a, b) => b[1] - a[1])[0][0];

    // 8. Calculate GPI
    const gpi = calculateGPI(recentMatches, soloQueue);

    return {
      account: {
        gameName: account.gameName,
        tagLine: account.tagLine
      },
      summoner: {
        id: summoner.id || null,
        name: account.gameName,
        level: summoner.summonerLevel,
        profileIconId: summoner.profileIconId
      },
      ranked: soloQueue ? {
        tier: soloQueue.tier,
        rank: soloQueue.rank,
        lp: soloQueue.leaguePoints,
        wins: soloQueue.wins,
        losses: soloQueue.losses,
        winRate: ((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100).toFixed(1)
      } : null,
      recentMatches,
      primaryRole,
      gpi
    };
  } catch (error) {
    console.error("Error fetching player stats:", error);
    throw error;
  }
}

/**
 * Generate radar chart URL for GPI visualization
 */
export function generateGPIChartUrl(gpiMetrics) {
  const { aggression, farming, vision, consistency, teamfighting, survivability } = gpiMetrics;
  
  const chartConfig = {
    type: 'radar',
    data: {
      labels: ['Aggression', 'Farming', 'Vision', 'Consistency', 'Teamfighting', 'Survivability'],
      datasets: [{
        label: 'GPI',
        data: [aggression, farming, vision, consistency, teamfighting, survivability],
        backgroundColor: 'rgba(205, 92, 147, 0.25)',
        borderColor: 'rgba(205, 92, 147, 0.9)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(205, 92, 147)',
        pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        pointBorderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(255, 255, 255)',
        pointHoverBorderColor: 'rgb(205, 92, 147)',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: {
            display: false,
            stepSize: 20
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.06)',
            lineWidth: 1
          },
          angleLines: {
            color: 'rgba(255, 255, 255, 0.06)',
            lineWidth: 1
          },
          pointLabels: {
            color: 'rgba(255, 255, 255, 0.85)',
            font: {
              size: 13,
              weight: '500',
              family: "'Segoe UI', 'Helvetica', 'Arial', sans-serif"
            },
            padding: 8
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false
        }
      },
      elements: {
        line: {
          tension: 0.15
        }
      }
    }
  };

  const encodedChart = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encodedChart}&backgroundColor=rgb(26,28,34)&width=700&height=450&devicePixelRatio=2`;
}
