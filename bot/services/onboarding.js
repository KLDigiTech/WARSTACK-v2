const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');
const supabase = require('./supabase');
const { scrapeTrackerGG } = require('./scraper');

// ════════════════════════════════════════════════════════
// POST PANEL
// ════════════════════════════════════════════════════════

async function postOnboardingPanel(channel, payload) {
  const { rules_enabled, rules_text, teams, games, pc_enabled, psn_enabled, xbox_enabled } = payload;

  try {
    const old = await channel.messages.fetch({ limit: 20 });
    const botMsgs = old.filter(m => m.author.bot && m.embeds?.length > 0);
    await Promise.all(botMsgs.map(m => m.delete().catch(() => {})));
  } catch {}

  if (rules_enabled && rules_text) {
    const embed = new EmbedBuilder()
      .setTitle('📜  RÈGLEMENT')
      .setDescription('```\n' + rules_text.slice(0, 3800) + '\n```\n\n> Clique sur le bouton ci-dessous pour confirmer que tu as lu et accepté le règlement.')
      .setColor(0x00ff66)
      .setFooter({ text: 'WARSTACK • Étape 1/6 — Règlement' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ob_accept_rules')
        .setLabel('✅  J\'ai lu et j\'accepte le règlement')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } else {
    await postStepPseudo(channel);
  }
}

// ── Étape 2 : Pseudo en jeu ───────────────────────────────

async function postStepPseudo(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🪪  PSEUDO EN JEU')
    .setDescription('Indique ton pseudo Battlefield 6 (celui affiché en jeu / sur tracker.gg).\n\n> Sert à te reconnaître sur les leaderboards et les tournois.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 2/6 — Pseudo' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ob_pseudo_open')
      .setLabel('✏️  Renseigner mon pseudo')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ── Étape 3 : Équipe ─────────────────────────────────────

async function postStep2(channel, teams) {
  if (!teams?.length) { await postStep3(channel); return; }

  const embed = new EmbedBuilder()
    .setTitle('⚔️  CHOIX DE L\'ÉQUIPE')
    .setDescription('Choisis ton équipe / clan.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 3/6 — Équipe' });

  const buttons = teams.slice(0, 5).map(t =>
    new ButtonBuilder()
      .setCustomId(`ob_team_${safeId(t.label)}`)
      .setLabel(`${t.emoji} ${t.label}`)
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] });
}

// ── Étape 4 : Plateforme ─────────────────────────────────

async function postStep3(channel, pc = true, psn = true, xbox = true) {
  const embed = new EmbedBuilder()
    .setTitle('🎮  PLATEFORME')
    .setDescription('Sur quelle plateforme joues-tu ?')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 4/6 — Plateforme' });

  const buttons = [];
  if (pc)   buttons.push(new ButtonBuilder().setCustomId('ob_plat_pc').setLabel('💻  PC').setStyle(ButtonStyle.Secondary));
  if (psn)  buttons.push(new ButtonBuilder().setCustomId('ob_plat_psn').setLabel('🎮  PlayStation').setStyle(ButtonStyle.Secondary));
  if (xbox) buttons.push(new ButtonBuilder().setCustomId('ob_plat_xbox').setLabel('🟢  Xbox').setStyle(ButtonStyle.Secondary));

  if (!buttons.length) { await postStep4(channel); return; }

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] });
}

// ── Étape 5 : Jeux ───────────────────────────────────────

async function postStep4(channel, games = []) {
  if (!games?.length) { await postStep5(channel); return; }

  const options = games.slice(0, 25).map(g => ({
    label: `${g.emoji} ${g.label}`,
    value: safeId(g.label),
    emoji: g.emoji || '🎮',
  }));

  const embed = new EmbedBuilder()
    .setTitle('🎯  JEUX')
    .setDescription('Choisis les jeux auxquels tu joues, puis valide.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 5/6 — Jeux' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('ob_games_select')
    .setPlaceholder('Choisis tes jeux...')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 10))
    .addOptions(options);

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

// ── Étape 6 : Tracker.gg ─────────────────────────────────

async function postStep5(channel) {
  const embed = new EmbedBuilder()
    .setTitle('📊  PROFIL TRACKER.GG')
    .setDescription(
      'Lie ton profil **Battlefield 6** sur tracker.gg pour afficher tes stats dans WARSTACK.\n\n' +
      '**Comment trouver ton URL ?**\n' +
      '1. Va sur `https://tracker.gg/bf6`\n' +
      '2. Recherche ton pseudo\n' +
      '3. Copie l\'URL de ta page profil\n\n' +
      '> Exemple : `https://tracker.gg/bf6/profile/1023163556057/overview`\n\n' +
      '*Tu peux ignorer cette étape si tu ne joues pas à BF6.*'
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'WARSTACK • Étape 6/6 — Tracker.gg' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ob_tracker_link')
      .setLabel('🔗  Lier mon profil tracker.gg')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ob_tracker_skip')
      .setLabel('⏭  Ignorer')
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ════════════════════════════════════════════════════════
// HANDLER INTERACTIONS
// ════════════════════════════════════════════════════════

async function handleOnboardingInteraction(interaction) {
  const { customId, guild, member } = interaction;

  // ── RÈGLEMENT ────────────────────────────────────────
  if (customId === 'ob_accept_rules') {
    await interaction.deferReply({ ephemeral: true });
    await upsertSession(guild.id, member.user.id, { step: 'rules_done' });
    await interaction.editReply({ content: '✅ Règlement accepté !' });
    await postStepPseudo(interaction.channel);
    return true;
  }

  // ── PSEUDO — OUVRIR MODAL ─────────────────────────────
  if (customId === 'ob_pseudo_open') {
    const modal = new ModalBuilder()
      .setCustomId('ob_pseudo_modal')
      .setTitle('🪪 Ton pseudo en jeu');

    const input = new TextInputBuilder()
      .setCustomId('pseudo_input')
      .setLabel('Pseudo Battlefield 6')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex : HolyPriest34')
      .setMinLength(2)
      .setMaxLength(32)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  // ── PSEUDO — VALIDER MODAL ────────────────────────────
  if (customId === 'ob_pseudo_modal') {
    await interaction.deferReply({ ephemeral: true });
    const pseudo = interaction.fields.getTextInputValue('pseudo_input').trim();

    await upsertSession(guild.id, member.user.id, { pseudo, step: 'pseudo_done' });

    const { data: existing } = await supabase.from('players').select('*').eq('discord_id', member.user.id).single().catch(() => ({ data: null }));
    if (existing) {
      await supabase.from('players').update({ pseudo, username: member.user.username }).eq('discord_id', member.user.id);
    } else {
      await supabase.from('players').insert({ discord_id: member.user.id, username: member.user.username, pseudo }).catch(() => {});
    }

    await interaction.editReply({ content: `✅ Pseudo **${pseudo}** enregistré !` });

    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));
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

  // ── ÉQUIPE ───────────────────────────────────────────
  if (customId.startsWith('ob_team_')) {
    await interaction.deferReply({ ephemeral: true });
    const teamKey = customId.replace('ob_team_', '');
    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));
    const team    = teams.find(t => safeId(t.label) === teamKey);

    if (!team) { await interaction.editReply({ content: '❌ Équipe introuvable.' }); return true; }
    if (team.role_id) {
      const role = guild.roles.cache.get(team.role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { team: team.label, step: 'team_done' });
    await interaction.editReply({ content: `✅ Équipe **${team.emoji} ${team.label}** sélectionnée !` });

    const pc   = getConf(configs, 'ob_pc_enabled')   !== 'false';
    const psn  = getConf(configs, 'ob_psn_enabled')  !== 'false';
    const xbox = getConf(configs, 'ob_xbox_enabled') !== 'false';
    await postStep3(interaction.channel, pc, psn, xbox);
    return true;
  }

  // ── PLATEFORME ───────────────────────────────────────
  if (customId.startsWith('ob_plat_')) {
    await interaction.deferReply({ ephemeral: true });
    const platMap  = { ob_plat_pc: 'PC', ob_plat_psn: 'PlayStation', ob_plat_xbox: 'Xbox' };
    const platform = platMap[customId] || 'PC';
    const configs  = await loadGuildConfig(guild.id);

    const platRoleKey = { ob_plat_pc: 'ob_pc_role', ob_plat_psn: 'ob_psn_role', ob_plat_xbox: 'ob_xbox_role' }[customId];
    const platRoleId  = getConf(configs, platRoleKey);
    if (platRoleId) {
      const role = guild.roles.cache.get(platRoleId);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { platform, step: 'platform_done' });
    await interaction.editReply({ content: `✅ Plateforme **${platform}** sélectionnée !` });

    const games = parseSafe(getConf(configs, 'ob_games'));
    if (games.length) {
      await postStep4(interaction.channel, games);
    } else {
      await postStep5(interaction.channel);
    }
    return true;
  }

  // ── JEUX ─────────────────────────────────────────────
  if (customId === 'ob_games_select') {
    await interaction.deferReply({ ephemeral: true });
    const selectedValues = interaction.values || [];
    const configs = await loadGuildConfig(guild.id);
    const games   = parseSafe(getConf(configs, 'ob_games'));
    const selectedGames = games.filter(g => selectedValues.includes(safeId(g.label)));

    for (const game of selectedGames) {
      if (game.role_id) {
        const role = guild.roles.cache.get(game.role_id);
        if (role) await member.roles.add(role).catch(() => {});
      }
    }

    const gameNames = selectedGames.map(g => `${g.emoji} ${g.label}`).join(', ');
    await upsertSession(guild.id, member.user.id, { games: gameNames, step: 'games_done' });
    await interaction.editReply({ content: `✅ Jeux : **${gameNames}** !` });

    await postStep5(interaction.channel);
    return true;
  }

  // ── TRACKER — OUVRIR MODAL ───────────────────────────
  if (customId === 'ob_tracker_link') {
    const modal = new ModalBuilder()
      .setCustomId('ob_tracker_modal')
      .setTitle('🔗 Lier ton profil tracker.gg');

    const input = new TextInputBuilder()
      .setCustomId('tracker_url_input')
      .setLabel('URL de ton profil tracker.gg BF6')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://tracker.gg/bf6/profile/1023163556057/overview')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  // ── TRACKER — VALIDER MODAL ──────────────────────────
  if (customId === 'ob_tracker_modal') {
    await interaction.deferReply({ ephemeral: true });

    const url   = interaction.fields.getTextInputValue('tracker_url_input');
    const match = url.match(/tracker\.gg\/bf6\/profile\/(\d+)/);

    if (!match) {
      await interaction.editReply({ content: '❌ URL invalide. Ex: `https://tracker.gg/bf6/profile/1023163556057/overview`' });
      return true;
    }

    const trackerId = match[1];
    const discordId = member.user.id;
    const username  = member.user.username;
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    // Upsert player
    const { data: existing } = await supabase.from('players').select('*').eq('discord_id', discordId).single().catch(() => ({ data: null }));
    if (existing) {
      await supabase.from('players').update({ tracker_id: trackerId, tracker_url: url, username, avatar_url: avatarUrl }).eq('discord_id', discordId);
    } else {
      await supabase.from('players').insert({ discord_id: discordId, username, tracker_id: trackerId, tracker_url: url, avatar_url: avatarUrl }).catch(() => {});
    }

    await upsertSession(guild.id, discordId, { tracker_id: trackerId, step: 'tracker_done' });
    await interaction.editReply({ content: '⏳ Profil lié ! Récupération de tes stats en cours...' });

    // Scrape immédiat en arrière-plan
    scrapeTrackerGG('psn', trackerId).then(async (stats) => {
      if (!stats) return;
      await supabase.from('player_snapshots').insert({
        tracker_id: trackerId, kills: stats.kills || 0, deaths: stats.deaths || 0,
        kd: stats.kd || 0, wins: stats.wins || 0, winrate: stats.winrate || 0,
        games: stats.games || 0, playtime: stats.playtime || '0h',
        br_rank: stats.br_rank || null, br_rank_img: stats.br_rank_img || null,
        mp_kills: stats.mp_kills || 0, mp_deaths: stats.mp_deaths || 0,
        mp_kd: stats.mp_kd || 0, mp_wins: stats.mp_wins || 0,
        mp_losses: stats.mp_losses || 0, mp_winrate: stats.mp_winrate || 0,
        br_kills: stats.br_kills || 0, br_deaths: stats.br_deaths || 0,
        br_kd: stats.br_kd || 0, br_wins: stats.br_wins || 0,
        br_winrate: stats.br_winrate || 0, snapshot_at: new Date().toISOString(),
      }).catch(() => {});
    });

    const configs = await loadGuildConfig(guild.id);
    await finalizeOnboarding(interaction, configs);
    return true;
  }

  // ── TRACKER — IGNORER ────────────────────────────────
  if (customId === 'ob_tracker_skip') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({ content: '⏭ Étape tracker ignorée.' });
    const configs = await loadGuildConfig(guild.id);
    await finalizeOnboarding(interaction, configs);
    return true;
  }

  return false;
}

// ════════════════════════════════════════════════════════
// FINALISATION
// ════════════════════════════════════════════════════════

async function finalizeOnboarding(interaction, configs) {
  const { guild, member } = interaction;

  const { data: session } = await supabase
    .from('onboarding_sessions').select('*')
    .eq('guild_id', guild.id).eq('discord_id', member.user.id)
    .single().catch(() => ({ data: null }));

  const unverifiedRoleId = getConf(configs, 'ob_role_unverified');
  if (unverifiedRoleId) {
    const role = guild.roles.cache.get(unverifiedRoleId);
    if (role) await member.roles.remove(role).catch(() => {});
  }

  const memberRoleId = getConf(configs, 'ob_role_member');
  if (memberRoleId) {
    const role = guild.roles.cache.get(memberRoleId);
    if (role) await member.roles.add(role).catch(() => {});
  }

  const confirmMsg = (getConf(configs, 'ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️')
    .replace(/{mention}/g, member.toString())
    .replace(/{user}/g,    member.user.username)
    .replace(/{server}/g,  guild.name);

  await interaction.channel.send(confirmMsg).catch(() => {});

  const dmEnabled = getConf(configs, 'ob_dm_enabled') === 'true';
  const dmMsg     = getConf(configs, 'ob_dm_msg') || '';
  if (dmEnabled && dmMsg) {
    const filled = dmMsg
      .replace(/{user}/g,     member.user.username)
      .replace(/{server}/g,   guild.name)
      .replace(/{pseudo}/g,   session?.pseudo   || member.user.username)
      .replace(/{team}/g,     session?.team     || '—')
      .replace(/{platform}/g, session?.platform || '—')
      .replace(/{games}/g,    session?.games    || '—');
    await member.send(filled).catch(() => {});
  }

  await supabase.from('onboarding_logs').insert({
    guild_id  : guild.id,
    discord_id: member.user.id,
    username  : member.user.username,
    avatar_url: member.user.displayAvatarURL({ size: 64 }),
    pseudo    : session?.pseudo   || null,
    team      : session?.team     || null,
    platform  : session?.platform || null,
    games     : session?.games    || null,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  await supabase.from('onboarding_sessions')
    .delete().eq('guild_id', guild.id).eq('discord_id', member.user.id)
    .catch(() => {});

  await supabase.from('audit_logs').insert({
    guild_id   : guild.id, type: 'member', action: 'onboarding_complete',
    author_id  : member.user.id, author_name: member.user.username,
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
  await supabase.from('onboarding_sessions').upsert(
    { guild_id: guildId, discord_id: discordId, updated_at: new Date().toISOString(), ...fields },
    { onConflict: 'guild_id,discord_id' }
  ).catch(() => {});
}

module.exports = { postOnboardingPanel, handleOnboardingInteraction };