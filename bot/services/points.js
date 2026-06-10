const supabase = require('./supabase');

// ═══════════════════════════════════════
//  GRADES MILITAIRES
// ═══════════════════════════════════════

const GRADES = [
  { level: 1,  xp: 0,     name: 'Recrue',          emoji: '🪖' },
  { level: 2,  xp: 100,   name: 'Soldat',           emoji: '🎖️' },
  { level: 3,  xp: 250,   name: 'Caporal',          emoji: '🎖️' },
  { level: 4,  xp: 500,   name: 'Sergent',          emoji: '🎖️' },
  { level: 5,  xp: 900,   name: 'Sergent-Chef',     emoji: '🎖️' },
  { level: 6,  xp: 1400,  name: 'Adjudant',         emoji: '⭐' },
  { level: 7,  xp: 2000,  name: 'Adjudant-Chef',    emoji: '⭐' },
  { level: 8,  xp: 2800,  name: 'Lieutenant',       emoji: '⭐⭐' },
  { level: 9,  xp: 3800,  name: 'Capitaine',        emoji: '⭐⭐' },
  { level: 10, xp: 5000,  name: 'Commandant',       emoji: '⭐⭐⭐' },
  { level: 11, xp: 7000,  name: 'Colonel',          emoji: '⭐⭐⭐' },
  { level: 12, xp: 10000, name: 'Général',          emoji: '🏅' },
  { level: 13, xp: 15000, name: 'Maréchal WARSTACK', emoji: '🏆' },
];

// ═══════════════════════════════════════
//  GAINS XP + COINS PAR ACTION
// ═══════════════════════════════════════

const GAINS = {
  message:              { xp: 5,   coins: 2  },
  vocal_hour:           { xp: 10,  coins: 5  },
  event_joined:         { xp: 25,  coins: 10 },
  event_checkin:        { xp: 10,  coins: 5  },
  suggestion_accepted:  { xp: 50,  coins: 20 },
  ticket_handled:       { xp: 15,  coins: 8  },
  tournament_played:    { xp: 30,  coins: 25 },
  tournament_top8:      { xp: 50,  coins: 50 },
  tournament_top4:      { xp: 75,  coins: 75 },
  tournament_top3:      { xp: 100, coins: 100 },
  tournament_finalist:  { xp: 125, coins: 150 },
  tournament_win:       { xp: 200, coins: 250 },
  tournament_mvp:       { xp: 75,  coins: 75  },
};

// ═══════════════════════════════════════
//  COOLDOWNS EN MÉMOIRE (anti-spam)
// ═══════════════════════════════════════

const cooldowns = new Map(); // key: `${discord_id}:${guild_id}:${action}`

function isOnCooldown(discordId, guildId, action, ms) {
  const key  = `${discordId}:${guildId}:${action}`;
  const last = cooldowns.get(key);
  if (last && Date.now() - last < ms) return true;
  cooldowns.set(key, Date.now());
  return false;
}

// ═══════════════════════════════════════
//  GRADE DEPUIS XP
// ═══════════════════════════════════════

function getGrade(xp) {
  let grade = GRADES[0];
  for (const g of GRADES) {
    if (xp >= g.xp) grade = g;
    else break;
  }
  return grade;
}

function getNextGrade(xp) {
  for (const g of GRADES) {
    if (xp < g.xp) return g;
  }
  return null; // déjà au max
}

// ═══════════════════════════════════════
//  UPSERT XP
// ═══════════════════════════════════════

async function addXP(discordId, guildId, action, customXP = null) {
  const gain = customXP !== null ? customXP : (GAINS[action]?.xp ?? 0);
  if (gain === 0) return null;

  // Récupère ou crée le profil XP
  let { data: profile } = await supabase
    .from('warstack_xp')
    .select('*')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId)
    .single();

  const oldXP    = profile?.xp ?? 0;
  const newXP    = oldXP + gain;
  const oldGrade = getGrade(oldXP);
  const newGrade = getGrade(newXP);

  const updates = {
    discord_id: discordId,
    guild_id:   guildId,
    xp:         newXP,
    level:      newGrade.level,
    updated_at: new Date().toISOString(),
  };

  // Compteurs spécifiques
  if (action === 'message')             updates.messages_count      = (profile?.messages_count      ?? 0) + 1;
  if (action === 'suggestion_accepted') updates.suggestions_accepted = (profile?.suggestions_accepted ?? 0) + 1;
  if (action === 'ticket_handled')      updates.tickets_handled      = (profile?.tickets_handled      ?? 0) + 1;
  if (action === 'event_joined')        updates.events_joined        = (profile?.events_joined        ?? 0) + 1;
  if (action === 'tournament_played')   updates.tournaments_played   = (profile?.tournaments_played   ?? 0) + 1;
  if (action === 'tournament_win')      updates.tournaments_won      = (profile?.tournaments_won      ?? 0) + 1;
  if (action === 'tournament_mvp')      updates.mvp_count            = (profile?.mvp_count            ?? 0) + 1;

  await supabase.from('warstack_xp').upsert(updates, { onConflict: 'discord_id,guild_id' });

  // Retourne le grade-up si changement
  const levelUp = newGrade.level > oldGrade.level ? { from: oldGrade, to: newGrade } : null;
  return { xpGained: gain, newXP, grade: newGrade, levelUp };
}

// ═══════════════════════════════════════
//  UPSERT COINS
// ═══════════════════════════════════════

async function addCoins(discordId, guildId, action, reason = null, customCoins = null) {
  const amount = customCoins !== null ? customCoins : (GAINS[action]?.coins ?? 0);
  if (amount === 0) return null;

  let { data: wallet } = await supabase
    .from('warstack_wallets')
    .select('*')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId)
    .single();

  const newCoins       = (wallet?.coins ?? 0) + amount;
  const newTotalEarned = (wallet?.total_earned ?? 0) + amount;

  await supabase.from('warstack_wallets').upsert({
    discord_id:   discordId,
    guild_id:     guildId,
    coins:        newCoins,
    total_earned: newTotalEarned,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'discord_id,guild_id' });

  // Log transaction
  await supabase.from('warstack_transactions').insert({
    discord_id: discordId,
    guild_id:   guildId,
    amount,
    type:       'earn',
    reason:     reason || action,
  });

  return { coinsGained: amount, newCoins, newTotalEarned };
}

async function spendCoins(discordId, guildId, amount, reason) {
  let { data: wallet } = await supabase
    .from('warstack_wallets')
    .select('*')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId)
    .single();

  if (!wallet || wallet.coins < amount) return { success: false, reason: 'insufficient_funds' };

  const newCoins = wallet.coins - amount;

  await supabase.from('warstack_wallets').update({
    coins:      newCoins,
    updated_at: new Date().toISOString(),
  })
  .eq('discord_id', discordId)
  .eq('guild_id', guildId);

  await supabase.from('warstack_transactions').insert({
    discord_id: discordId,
    guild_id:   guildId,
    amount:     -amount,
    type:       'spend',
    reason,
  });

  return { success: true, newCoins };
}

// ═══════════════════════════════════════
//  FONCTION PRINCIPALE — award()
//  Appelle addXP + addCoins en une fois
// ═══════════════════════════════════════

async function award(discordId, guildId, action, { cooldownMs = 0, reason = null } = {}) {
  if (cooldownMs > 0 && isOnCooldown(discordId, guildId, action, cooldownMs)) return null;

  const [xpResult, coinsResult] = await Promise.all([
    addXP(discordId, guildId, action),
    addCoins(discordId, guildId, action, reason),
  ]);

  return { xpResult, coinsResult };
}

// ═══════════════════════════════════════
//  GETTERS
// ═══════════════════════════════════════

async function getProfile(discordId, guildId) {
  const [{ data: xpData }, { data: walletData }] = await Promise.all([
    supabase.from('warstack_xp').select('*').eq('discord_id', discordId).eq('guild_id', guildId).single(),
    supabase.from('warstack_wallets').select('*').eq('discord_id', discordId).eq('guild_id', guildId).single(),
  ]);

  const xp     = xpData?.xp ?? 0;
  const grade  = getGrade(xp);
  const next   = getNextGrade(xp);
  const progress = next ? Math.round(((xp - grade.xp) / (next.xp - grade.xp)) * 100) : 100;

  return {
    xp,
    level:    grade.level,
    grade,
    nextGrade: next,
    progress,
    coins:    walletData?.coins ?? 0,
    totalEarned: walletData?.total_earned ?? 0,
    stats: {
      messages:    xpData?.messages_count       ?? 0,
      voice:       xpData?.voice_minutes         ?? 0,
      events:      xpData?.events_joined         ?? 0,
      suggestions: xpData?.suggestions_accepted  ?? 0,
      tickets:     xpData?.tickets_handled       ?? 0,
      tournaments: xpData?.tournaments_played    ?? 0,
      wins:        xpData?.tournaments_won       ?? 0,
      mvp:         xpData?.mvp_count             ?? 0,
    }
  };
}

async function getLeaderboard(guildId, type = 'xp', limit = 10) {
  if (type === 'xp') {
    const { data } = await supabase
      .from('warstack_xp')
      .select('discord_id, xp, level')
      .eq('guild_id', guildId)
      .order('xp', { ascending: false })
      .limit(limit);
    return data || [];
  }
  if (type === 'coins') {
    const { data } = await supabase
      .from('warstack_wallets')
      .select('discord_id, coins, total_earned')
      .eq('guild_id', guildId)
      .order('total_earned', { ascending: false })
      .limit(limit);
    return data || [];
  }
  return [];
}

module.exports = {
  GRADES,
  GAINS,
  getGrade,
  getNextGrade,
  award,
  addXP,
  addCoins,
  spendCoins,
  getProfile,
  getLeaderboard,
};