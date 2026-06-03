// bot/services/onboarding.js
// Service complet d'onboarding : post panel + gestion interactions multi-étapes

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const supabase = require('./supabase');

// ════════════════════════════════════════════════════════
// POST PANEL — Envoie le panel d'onboarding dans un salon
// ════════════════════════════════════════════════════════

async function postOnboardingPanel(channel, payload) {
  const {
    rules_enabled,
    rules_text,
    teams,
    games,
    pc_enabled,
    psn_enabled,
    xbox_enabled,
  } = payload;

  // Supprimer les anciens panels du bot
  try {
    const old = await channel.messages.fetch({ limit: 20 });
    const botMsgs = old.filter(m => m.author.bot && m.embeds?.length > 0);
    await Promise.all(botMsgs.map(m => m.delete().catch(() => {})));
  } catch {}

  // ── Étape 1 : Règlement ──────────────────────────────
  if (rules_enabled && rules_text) {
    const embed = new EmbedBuilder()
      .setTitle('📜  RÈGLEMENT')
      .setDescription(
        '```\n' + (rules_text.slice(0, 3800)) + '\n```' +
        '\n\n> Clique sur le bouton ci-dessous pour confirmer que tu as lu et accepté le règlement.'
      )
      .setColor(0x00ff66)
      .setFooter({ text: 'WARSTACK • Étape 1/4 — Règlement' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ob_accept_rules')
        .setLabel('✅  J\'ai lu et j\'accepte le règlement')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });

  } else {
    // Pas de règlement → on poste directement l'étape 2 (équipes)
    await postStep2(channel, teams);
  }
}

// ── Étape 2 : Choix équipe ───────────────────────────────
async function postStep2(channel, teams) {
  if (!teams?.length) {
    await postStep3(channel);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⚔️  CHOIX DE L\'ÉQUIPE')
    .setDescription('Choisis ton équipe / clan.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 2/4 — Équipe' });

  const buttons = teams.slice(0, 5).map(t =>
    new ButtonBuilder()
      .setCustomId(`ob_team_${safeId(t.label)}`)
      .setLabel(`${t.emoji} ${t.label}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const row = new ActionRowBuilder().addComponents(...buttons);
  await channel.send({ embeds: [embed], components: [row] });
}

// ── Étape 3 : Plateforme ─────────────────────────────────
async function postStep3(channel, pc = true, psn = true, xbox = true) {
  const embed = new EmbedBuilder()
    .setTitle('🎮  PLATEFORME')
    .setDescription('Sur quelle plateforme joues-tu ?')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 3/4 — Plateforme' });

  const buttons = [];
  if (pc)   buttons.push(new ButtonBuilder().setCustomId('ob_plat_pc').setLabel('💻  PC').setStyle(ButtonStyle.Secondary));
  if (psn)  buttons.push(new ButtonBuilder().setCustomId('ob_plat_psn').setLabel('🎮  PlayStation').setStyle(ButtonStyle.Secondary));
  if (xbox) buttons.push(new ButtonBuilder().setCustomId('ob_plat_xbox').setLabel('🟢  Xbox').setStyle(ButtonStyle.Secondary));

  if (!buttons.length) { await postStep4(channel); return; }

  const row = new ActionRowBuilder().addComponents(...buttons);
  await channel.send({ embeds: [embed], components: [row] });
}

// ── Étape 4 : Jeux ───────────────────────────────────────
async function postStep4(channel, games = []) {
  if (!games?.length) return; // rien à afficher

  const options = games.slice(0, 25).map(g => ({
    label  : `${g.emoji} ${g.label}`,
    value  : safeId(g.label),
    emoji  : g.emoji || '🎮',
  }));

  const embed = new EmbedBuilder()
    .setTitle('🎯  JEUX')
    .setDescription('Choisis les jeux auxquels tu joues (multi-sélection possible), puis valide.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 4/4 — Jeux' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('ob_games_select')
    .setPlaceholder('Choisis tes jeux...')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 10))
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);
  await channel.send({ embeds: [embed], components: [row] });
}

// ════════════════════════════════════════════════════════
// HANDLER INTERACTIONS — appelé depuis interactionCreate
// ════════════════════════════════════════════════════════

async function handleOnboardingInteraction(interaction) {
  const { customId, guild, member } = interaction;

  // ── ACCEPTER RÈGLEMENT ───────────────────────────────
  if (customId === 'ob_accept_rules') {
    await interaction.deferReply({ ephemeral: true });

    // Récupérer la session d'onboarding (ou en créer une)
    await upsertSession(guild.id, member.user.id, { step: 'rules_done' });

    // Charger config et passer à l'étape 2
    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));

    await interaction.editReply({ content: '✅ Règlement accepté ! Choisis maintenant ton équipe ci-dessous.' });

    if (teams.length) {
      await postStep2(interaction.channel, teams);
    } else {
      const pc   = getConf(configs, 'ob_pc_enabled')   !== 'false';
      const psn  = getConf(configs, 'ob_psn_enabled')  !== 'false';
      const xbox = getConf(configs, 'ob_xbox_enabled') !== 'false';
      await postStep3(interaction.channel, pc, psn, xbox);
    }
    return true;
  }

  // ── CHOIX ÉQUIPE ─────────────────────────────────────
  if (customId.startsWith('ob_team_')) {
    await interaction.deferReply({ ephemeral: true });

    const teamKey = customId.replace('ob_team_', '');
    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));
    const team    = teams.find(t => safeId(t.label) === teamKey);

    if (!team) {
      await interaction.editReply({ content: '❌ Équipe introuvable.' });
      return true;
    }

    // Attribuer le rôle d'équipe si configuré
    if (team.role_id) {
      const role = guild.roles.cache.get(team.role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { team: team.label, step: 'team_done' });
    await interaction.editReply({ content: `✅ Équipe **${team.emoji} ${team.label}** sélectionnée !` });

    // Étape 3 — Plateforme
    const pc   = getConf(configs, 'ob_pc_enabled')   !== 'false';
    const psn  = getConf(configs, 'ob_psn_enabled')  !== 'false';
    const xbox = getConf(configs, 'ob_xbox_enabled') !== 'false';
    await postStep3(interaction.channel, pc, psn, xbox);
    return true;
  }

  // ── CHOIX PLATEFORME ─────────────────────────────────
  if (customId.startsWith('ob_plat_')) {
    await interaction.deferReply({ ephemeral: true });

    const platMap = { ob_plat_pc: 'PC', ob_plat_psn: 'PlayStation', ob_plat_xbox: 'Xbox' };
    const platform = platMap[customId] || 'PC';

    const configs = await loadGuildConfig(guild.id);

    // Attribuer le rôle de plateforme si configuré
    const platRoleKey = { ob_plat_pc: 'ob_pc_role', ob_plat_psn: 'ob_psn_role', ob_plat_xbox: 'ob_xbox_role' }[customId];
    const platRoleId  = getConf(configs, platRoleKey);
    if (platRoleId) {
      const role = guild.roles.cache.get(platRoleId);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { platform, step: 'platform_done' });
    await interaction.editReply({ content: `✅ Plateforme **${platform}** sélectionnée !` });

    // Étape 4 — Jeux
    const games = parseSafe(getConf(configs, 'ob_games'));
    if (games.length) {
      await postStep4(interaction.channel, games);
    } else {
      // Pas de jeux → finaliser directement
      await finalizeOnboarding(interaction, configs);
    }
    return true;
  }

  // ── CHOIX JEUX ───────────────────────────────────────
  if (customId === 'ob_games_select') {
    await interaction.deferReply({ ephemeral: true });

    const selectedValues = interaction.values || [];
    const configs = await loadGuildConfig(guild.id);
    const games   = parseSafe(getConf(configs, 'ob_games'));

    const selectedGames = games.filter(g => selectedValues.includes(safeId(g.label)));

    // Attribuer les rôles jeux
    for (const game of selectedGames) {
      if (game.role_id) {
        const role = guild.roles.cache.get(game.role_id);
        if (role) await member.roles.add(role).catch(() => {});
      }
    }

    const gameNames = selectedGames.map(g => `${g.emoji} ${g.label}`).join(', ');
    await upsertSession(guild.id, member.user.id, { games: gameNames, step: 'games_done' });
    await interaction.editReply({ content: `✅ Jeux sélectionnés : **${gameNames}** !` });

    await finalizeOnboarding(interaction, configs);
    return true;
  }

  return false; // interaction non gérée
}

// ════════════════════════════════════════════════════════
// FINALISATION
// ════════════════════════════════════════════════════════

async function finalizeOnboarding(interaction, configs) {
  const { guild, member } = interaction;

  // Récupérer la session
  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('guild_id', guild.id)
    .eq('discord_id', member.user.id)
    .single()
    .catch(() => ({ data: null }));

  // Retirer le rôle "Non vérifié"
  const unverifiedRoleId = getConf(configs, 'ob_role_unverified');
  if (unverifiedRoleId) {
    const role = guild.roles.cache.get(unverifiedRoleId);
    if (role) await member.roles.remove(role).catch(() => {});
  }

  // Attribuer le rôle "Membre"
  const memberRoleId = getConf(configs, 'ob_role_member');
  if (memberRoleId) {
    const role = guild.roles.cache.get(memberRoleId);
    if (role) await member.roles.add(role).catch(() => {});
  }

  // Message de confirmation dans le salon
  const confirmMsg = (getConf(configs, 'ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️')
    .replace(/{mention}/g, member.toString())
    .replace(/{user}/g,    member.user.username)
    .replace(/{server}/g,  guild.name);

  await interaction.channel.send(confirmMsg).catch(() => {});

  // DM si activé
  const dmEnabled = getConf(configs, 'ob_dm_enabled') === 'true';
  const dmMsg     = getConf(configs, 'ob_dm_msg') || '';
  if (dmEnabled && dmMsg) {
    const filled = dmMsg
      .replace(/{user}/g,     member.user.username)
      .replace(/{server}/g,   guild.name)
      .replace(/{team}/g,     session?.team     || '—')
      .replace(/{platform}/g, session?.platform || '—')
      .replace(/{games}/g,    session?.games    || '—');
    await member.send(filled).catch(() => {});
  }

  // Log dans Supabase
  await supabase.from('onboarding_logs').insert({
    guild_id  : guild.id,
    discord_id: member.user.id,
    username  : member.user.username,
    avatar_url: member.user.displayAvatarURL({ size: 64 }),
    team      : session?.team     || null,
    platform  : session?.platform || null,
    games     : session?.games    || null,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  // Nettoyer la session
  await supabase.from('onboarding_sessions')
    .delete()
    .eq('guild_id', guild.id)
    .eq('discord_id', member.user.id)
    .catch(() => {});

  // Audit log
  await supabase.from('audit_logs').insert({
    guild_id   : guild.id,
    type       : 'member',
    action     : 'onboarding_complete',
    author_id  : member.user.id,
    author_name: member.user.username,
    extra      : { team: session?.team, platform: session?.platform },
  }).catch(() => {});
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function safeId(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
}

function parseSafe(val, fallback = []) {
  try { return JSON.parse(val || '[]'); } catch { return fallback; }
}

function getConf(configs, key) {
  return configs?.find(c => c.key === key)?.value;
}

async function loadGuildConfig(guildId) {
  const { data } = await supabase.from('config').select('*').eq('guild_id', guildId);
  return data || [];
}

async function upsertSession(guildId, discordId, fields) {
  const now = new Date().toISOString();
  await supabase.from('onboarding_sessions').upsert(
    { guild_id: guildId, discord_id: discordId, updated_at: now, ...fields },
    { onConflict: 'guild_id,discord_id' }
  ).catch(() => {});
}

module.exports = { postOnboardingPanel, handleOnboardingInteraction };