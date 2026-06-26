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
      .setFooter({ text: 'WARSTACK • Étape 1 — Règlement' });

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

async function postStepPseudo(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🪪  PSEUDO EN JEU')
    .setDescription('Indique ton pseudo Battlefield 6 (celui affiché en jeu / sur tracker.gg).\n\n> Sert à te reconnaître sur les leaderboards et les tournois.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 2 — Pseudo' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ob_pseudo_open')
      .setLabel('✏️  Renseigner mon pseudo')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function postStep2(channel, teams) {
  if (!teams?.length) { await postStep3(channel); return; }

  const embed = new EmbedBuilder()
    .setTitle('⚔️  CHOIX DE L\'ÉQUIPE')
    .setDescription('Choisis ton équipe / clan.')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 3 — Équipe' });

  const buttons = teams.slice(0, 5).map(t =>
    new ButtonBuilder()
      .setCustomId(`ob_team_${safeId(t.label)}`)
      .setLabel(`${t.emoji} ${t.label}`)
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] });
}

async function postStep3(channel, pc = true, psn = true, xbox = true) {
  const embed = new EmbedBuilder()
    .setTitle('🎮  PLATEFORME')
    .setDescription('Sur quelle plateforme joues-tu ?')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 4 — Plateforme' });

  const buttons = [];
  if (pc)   buttons.push(new ButtonBuilder().setCustomId('ob_plat_pc').setLabel('💻  PC').setStyle(ButtonStyle.Secondary));
  if (psn)  buttons.push(new ButtonBuilder().setCustomId('ob_plat_psn').setLabel('🎮  PlayStation').setStyle(ButtonStyle.Secondary));
  if (xbox) buttons.push(new ButtonBuilder().setCustomId('ob_plat_xbox').setLabel('🟢  Xbox').setStyle(ButtonStyle.Secondary));

  if (!buttons.length) { await postStep4(channel); return; }
  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] });
}

async function postStep4(channel, games) {
  if (!games?.length) { await postStep5(channel); return; }

  const embed = new EmbedBuilder()
    .setTitle('🎯  JEUX')
    .setDescription('À quels jeux joues-tu ? (Multi-sélection possible)')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 5 — Jeux' });

  const options = games.slice(0, 25).map(g => ({
    label : `${g.emoji} ${g.label}`,
    value : safeId(g.label),
    emoji : g.emoji,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('ob_games_select')
    .setPlaceholder('Choisis tes jeux...')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 10))
    .addOptions(options);

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

async function postStepAge(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🎂  ÂGE')
    .setDescription('Quel est ton âge ?')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape Âge' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ob_age_open').setLabel('✏️  Indiquer mon âge').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ob_age_skip').setLabel('Ignorer →').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function postStepCustom(channel, questions, qIndex) {
  const q = questions[qIndex];
  if (!q) return null;

  const embed = new EmbedBuilder()
    .setTitle(`❓  ${q.label}`)
    .setDescription(q.description || 'Réponds à cette question pour continuer.')
    .setColor(0xFF6B35)
    .setFooter({ text: `WARSTACK • Question personnalisée ${qIndex + 1}/${questions.length}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ob_custom_${qIndex}`)
      .setLabel('✏️  Répondre')
      .setStyle(ButtonStyle.Primary),
    ...(q.required ? [] : [
      new ButtonBuilder()
        .setCustomId(`ob_custom_skip_${qIndex}`)
        .setLabel('Ignorer →')
        .setStyle(ButtonStyle.Secondary)
    ])
  );

  await channel.send({ embeds: [embed], components: [row] });
  return true;
}

async function postStep5(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🔗  TRACKER.GG')
    .setDescription('Lie ton profil tracker.gg pour apparaître dans les classements.\n\n**Comment trouver ton URL ?**\n1. Va sur [tracker.gg/bf6](https://tracker.gg/bf6)\n2. Recherche ton pseudo\n3. Copie l\'URL de ta page profil\n\n> Exemple : `tracker.gg/bf6/profile/1023163556057/overview`')
    .setColor(0xFF6B35)
    .setFooter({ text: 'WARSTACK • Étape 6 — Tracker (optionnel)' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ob_tracker_link').setLabel('🔗  Lier mon tracker').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ob_tracker_skip').setLabel('Ignorer →').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function handleOnboardingInteraction(interaction) {
  const { guild, member, customId } = interaction;

  if (customId === 'ob_accept_rules') {
    await interaction.deferReply({ ephemeral: true });
    await upsertSession(guild.id, member.user.id, { step: 'rules_done' });
    await interaction.editReply({ content: '✅ Règlement accepté ! Passe à l\'étape suivante.' });
    await postStepPseudo(interaction.channel);
    return true;
  }

  if (customId === 'ob_pseudo_open') {
    const modal = new ModalBuilder()
      .setCustomId('ob_pseudo_modal')
      .setTitle('🪪 Ton pseudo en jeu');
    const input = new TextInputBuilder()
      .setCustomId('pseudo_input')
      .setLabel('Pseudo Battlefield 6')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: HolyPriest34')
      .setRequired(true)
      .setMaxLength(32);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'ob_pseudo_modal') {
    await interaction.deferReply({ ephemeral: true });
    const pseudo = interaction.fields.getTextInputValue('pseudo_input').trim();
    await upsertSession(guild.id, member.user.id, { pseudo, step: 'pseudo_done' });

    await supabase.from('players')
      .upsert({ discord_id: member.user.id, pseudo, username: member.user.username }, { onConflict: 'discord_id' })
      .catch(() => {});

    await interaction.editReply({ content: `✅ Pseudo : **${pseudo}** enregistré !` });

    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));
    await postStep2(interaction.channel, teams);
    return true;
  }

  if (customId.startsWith('ob_team_')) {
    await interaction.deferReply({ ephemeral: true });
    const configs = await loadGuildConfig(guild.id);
    const teams   = parseSafe(getConf(configs, 'ob_teams'));
    const teamKey = customId.replace('ob_team_', '');
    const team    = teams.find(t => safeId(t.label) === teamKey);

    if (team?.role_id) {
      const role = guild.roles.cache.get(team.role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { team: team?.label || teamKey, step: 'team_done' });
    await interaction.editReply({ content: `✅ Équipe : **${team?.label || teamKey}** !` });

    const pcEnabled   = getConf(configs, 'ob_pc_enabled')   !== 'false';
    const psnEnabled  = getConf(configs, 'ob_psn_enabled')  !== 'false';
    const xboxEnabled = getConf(configs, 'ob_xbox_enabled') !== 'false';
    await postStep3(interaction.channel, pcEnabled, psnEnabled, xboxEnabled);
    return true;
  }

  if (['ob_plat_pc', 'ob_plat_psn', 'ob_plat_xbox'].includes(customId)) {
    await interaction.deferReply({ ephemeral: true });
    const configs   = await loadGuildConfig(guild.id);
    const platMap   = { ob_plat_pc: { label: 'PC', key: 'ob_pc_role' }, ob_plat_psn: { label: 'PlayStation', key: 'ob_psn_role' }, ob_plat_xbox: { label: 'Xbox', key: 'ob_xbox_role' } };
    const plat      = platMap[customId];
    const roleId    = getConf(configs, plat.key);

    if (roleId) {
      const role = guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role).catch(() => {});
    }

    await upsertSession(guild.id, member.user.id, { platform: plat.label, step: 'platform_done' });
    await interaction.editReply({ content: `✅ Plateforme : **${plat.label}** !` });

    const games = parseSafe(getConf(configs, 'ob_games'));
    await postStep4(interaction.channel, games);
    return true;
  }

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

    const ageEnabled = getConf(configs, 'ob_age_enabled') === 'true';
    if (ageEnabled) {
      await postStepAge(interaction.channel);
    } else {
      await postCustomOrTracker(interaction.channel, configs, guild.id, member.user.id);
    }
    return true;
  }

  if (customId === 'ob_age_open') {
    const modal = new ModalBuilder()
      .setCustomId('ob_age_modal')
      .setTitle('🎂 Ton âge');
    const input = new TextInputBuilder()
      .setCustomId('age_input')
      .setLabel('Ton âge')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 24')
      .setRequired(true)
      .setMaxLength(3);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'ob_age_skip') {
    await interaction.deferReply({ ephemeral: true });
    await upsertSession(guild.id, member.user.id, { step: 'age_skipped' });
    await interaction.editReply({ content: '⏭ Étape âge ignorée.' });
    const configs = await loadGuildConfig(guild.id);
    await postCustomOrTracker(interaction.channel, configs, guild.id, member.user.id);
    return true;
  }

  if (customId === 'ob_age_modal') {
    await interaction.deferReply({ ephemeral: true });
    const age = interaction.fields.getTextInputValue('age_input').trim();
    await upsertSession(guild.id, member.user.id, { age, step: 'age_done' });
    await interaction.editReply({ content: `✅ Âge : **${age} ans** enregistré !` });
    const configs = await loadGuildConfig(guild.id);
    await postCustomOrTracker(interaction.channel, configs, guild.id, member.user.id);
    return true;
  }

  if (customId.startsWith('ob_custom_') && !customId.startsWith('ob_custom_skip_')) {
    const qIndex = parseInt(customId.replace('ob_custom_', ''));
    const configs = await loadGuildConfig(guild.id);
    const questions = parseSafe(getConf(configs, 'ob_custom_questions'));
    const q = questions[qIndex];
    if (!q) return false;

    const modal = new ModalBuilder()
      .setCustomId(`ob_custom_modal_${qIndex}`)
      .setTitle(q.label.slice(0, 45));
    const input = new TextInputBuilder()
      .setCustomId('custom_answer')
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.multiline ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setPlaceholder(q.placeholder || 'Ta réponse...')
      .setRequired(q.required !== false)
      .setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (customId.startsWith('ob_custom_modal_')) {
    await interaction.deferReply({ ephemeral: true });
    const qIndex  = parseInt(customId.replace('ob_custom_modal_', ''));
    const answer  = interaction.fields.getTextInputValue('custom_answer').trim();
    const configs = await loadGuildConfig(guild.id);
    const questions = parseSafe(getConf(configs, 'ob_custom_questions'));

    const { data: sess } = await supabase
      .from('onboarding_sessions').select('custom_answers')
      .eq('guild_id', guild.id).eq('discord_id', member.user.id)
      .single().catch(() => ({ data: null }));

    const prevAnswers = parseSafe(sess?.custom_answers, {});
    prevAnswers[questions[qIndex]?.label || `q${qIndex}`] = answer;

    await upsertSession(guild.id, member.user.id, { custom_answers: JSON.stringify(prevAnswers) });
    await interaction.editReply({ content: `✅ Réponse enregistrée !` });

    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) {
      await postStepCustom(interaction.channel, questions, nextIndex);
    } else {
      await postStep5(interaction.channel);
    }
    return true;
  }

  if (customId.startsWith('ob_custom_skip_')) {
    await interaction.deferReply({ ephemeral: true });
    const qIndex  = parseInt(customId.replace('ob_custom_skip_', ''));
    const configs = await loadGuildConfig(guild.id);
    const questions = parseSafe(getConf(configs, 'ob_custom_questions'));
    await interaction.editReply({ content: '⏭ Question ignorée.' });
    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) {
      await postStepCustom(interaction.channel, questions, nextIndex);
    } else {
      await postStep5(interaction.channel);
    }
    return true;
  }

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

    const { data: existing } = await supabase.from('players').select('*').eq('discord_id', discordId).single().catch(() => ({ data: null }));
    if (existing) {
      await supabase.from('players').update({ tracker_id: trackerId, tracker_url: url, username, avatar_url: avatarUrl }).eq('discord_id', discordId);
    } else {
      await supabase.from('players').insert({ discord_id: discordId, username, tracker_id: trackerId, tracker_url: url, avatar_url: avatarUrl }).catch(() => {});
    }

    await upsertSession(guild.id, discordId, { tracker_id: trackerId, step: 'tracker_done' });
    await interaction.editReply({ content: '⏳ Profil lié ! Récupération de tes stats en cours...' });

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

  if (customId === 'ob_tracker_skip') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({ content: '⏭ Étape tracker ignorée.' });
    const configs = await loadGuildConfig(guild.id);
    await finalizeOnboarding(interaction, configs);
    return true;
  }

  if (customId === 'ob_staff_approve') {
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.message?.embeds?.[0]?.footer?.text?.match(/discord_id:(\d+)/)?.[1];
    if (!discordId) { await interaction.editReply({ content: '❌ Impossible de trouver le membre.' }); return true; }

    const targetMember = await guild.members.fetch(discordId).catch(() => null);
    if (!targetMember) { await interaction.editReply({ content: '❌ Membre introuvable.' }); return true; }

    const configs = await loadGuildConfig(guild.id);
    await applyMemberRoles(guild, targetMember, configs);

    await supabase.from('onboarding_sessions')
      .update({ manual_status: 'approved', reviewed_by: member.user.username })
      .eq('guild_id', guild.id).eq('discord_id', discordId).catch(() => {});

    await interaction.message.edit({ components: [] }).catch(() => {});
    await interaction.editReply({ content: `✅ Inscription de <@${discordId}> approuvée.` });

    const obChanId = getConf(configs, 'ob_channel');
    if (obChanId) {
      const obChan = guild.channels.cache.get(obChanId);
      const confirmMsg = (getConf(configs, 'ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️')
        .replace(/{mention}/g, `<@${discordId}>`)
        .replace(/{user}/g,    targetMember.user.username)
        .replace(/{server}/g,  guild.name);
      if (obChan) await obChan.send(confirmMsg).catch(() => {});
    }

    await logOnboarding(guild, targetMember, configs, 'approved');
    return true;
  }

  if (customId === 'ob_staff_reject') {
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.message?.embeds?.[0]?.footer?.text?.match(/discord_id:(\d+)/)?.[1];
    if (!discordId) { await interaction.editReply({ content: '❌ Impossible de trouver le membre.' }); return true; }

    await supabase.from('onboarding_sessions')
      .update({ manual_status: 'rejected', reviewed_by: member.user.username })
      .eq('guild_id', guild.id).eq('discord_id', discordId).catch(() => {});

    await interaction.message.edit({ components: [] }).catch(() => {});
    await interaction.editReply({ content: `❌ Inscription de <@${discordId}> refusée.` });
    return true;
  }

  return false;
}

async function postCustomOrTracker(channel, configs, guildId, discordId) {
  const questions = parseSafe(getConf(configs, 'ob_custom_questions'));
  if (questions.length > 0) {
    await postStepCustom(channel, questions, 0);
  } else {
    await postStep5(channel);
  }
}

async function finalizeOnboarding(interaction, configs) {
  const { guild, member } = interaction;
  const discordId = member.user.id;

  const manualEnabled = getConf(configs, 'ob_manual_validation') === 'true';

  if (manualEnabled) {
    const staffChannelId = getConf(configs, 'ob_staff_channel');
    const staffChannel   = staffChannelId ? guild.channels.cache.get(staffChannelId) : null;

    if (staffChannel) {
      const { data: session } = await supabase
        .from('onboarding_sessions').select('*')
        .eq('guild_id', guild.id).eq('discord_id', discordId)
        .single().catch(() => ({ data: null }));

      const embed = new EmbedBuilder()
        .setTitle('📋 Nouvelle inscription à valider')
        .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 128 }))
        .addFields(
          { name: '👤 Membre', value: `<@${discordId}> (${member.user.username})`, inline: true },
          { name: '🪪 Pseudo', value: session?.pseudo || '—', inline: true },
          { name: '⚔️ Équipe', value: session?.team || '—', inline: true },
          { name: '🎮 Plateforme', value: session?.platform || '—', inline: true },
          { name: '🎯 Jeux', value: session?.games || '—', inline: true },
          { name: '🎂 Âge', value: session?.age || '—', inline: true },
        )
        .setColor(0xFF6B35)
        .setFooter({ text: `WARSTACK • discord_id:${discordId}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ob_staff_approve').setLabel('✅ Approuver').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ob_staff_reject').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger)
      );

      await staffChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }

    await interaction.editReply({ content: '⏳ Ton inscription est en cours de validation par le staff. Tu recevras un message dès qu\'elle sera approuvée.' });
    await upsertSession(guild.id, discordId, { step: 'pending_review', manual_status: 'pending' });
    return;
  }

  await applyMemberRoles(guild, member, configs);
  await logOnboarding(guild, member, configs, 'auto');

  const staffChannelId = getConf(configs, 'ob_staff_channel');
  if (staffChannelId) {
    const staffChannel = guild.channels.cache.get(staffChannelId);
    if (staffChannel) {
      const { data: session } = await supabase
        .from('onboarding_sessions').select('*')
        .eq('guild_id', guild.id).eq('discord_id', discordId)
        .single().catch(() => ({ data: null }));

      await staffChannel.send({
        content: `✅ **Nouveau membre inscrit** : <@${discordId}> (${member.user.username})\n🪪 ${session?.pseudo || '—'} | ⚔️ ${session?.team || '—'} | 🎮 ${session?.platform || '—'}`,
      }).catch(() => {});
    }
  }

  const confirmMsg = (getConf(configs, 'ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️')
    .replace(/{mention}/g, member.toString())
    .replace(/{user}/g,    member.user.username)
    .replace(/{server}/g,  guild.name);
  await interaction.channel.send(confirmMsg).catch(() => {});

  const dmEnabled = getConf(configs, 'ob_dm_enabled') === 'true';
  const dmMsg     = getConf(configs, 'ob_dm_msg') || '';
  if (dmEnabled && dmMsg) {
    const { data: session } = await supabase
      .from('onboarding_sessions').select('*')
      .eq('guild_id', guild.id).eq('discord_id', discordId)
      .single().catch(() => ({ data: null }));
    const filled = dmMsg
      .replace(/{user}/g,     member.user.username)
      .replace(/{server}/g,   guild.name)
      .replace(/{pseudo}/g,   session?.pseudo   || member.user.username)
      .replace(/{team}/g,     session?.team     || '—')
      .replace(/{platform}/g, session?.platform || '—')
      .replace(/{games}/g,    session?.games    || '—');
    await member.send(filled).catch(() => {});
  }

  await supabase.from('onboarding_sessions')
    .delete().eq('guild_id', guild.id).eq('discord_id', discordId).catch(() => {});
}

async function applyMemberRoles(guild, member, configs) {
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
}

async function logOnboarding(guild, member, configs, mode) {
  const { data: session } = await supabase
    .from('onboarding_sessions').select('*')
    .eq('guild_id', guild.id).eq('discord_id', member.user.id)
    .single().catch(() => ({ data: null }));

  await supabase.from('onboarding_logs').insert({
    guild_id  : guild.id,
    discord_id: member.user.id,
    username  : member.user.username,
    avatar_url: member.user.displayAvatarURL({ size: 64 }),
    pseudo    : session?.pseudo   || null,
    team      : session?.team     || null,
    platform  : session?.platform || null,
    games     : session?.games    || null,
    age       : session?.age      || null,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  await supabase.from('audit_logs').insert({
    guild_id   : guild.id, type: 'member', action: 'onboarding_complete',
    author_id  : member.user.id, author_name: member.user.username,
    extra      : { team: session?.team, platform: session?.platform, mode },
  }).catch(() => {});
}

function safeId(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
}

function parseSafe(val, fallback = []) {
  try { return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}')); } catch { return fallback; }
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