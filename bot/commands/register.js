const { SlashCommandBuilder } = require('discord.js');
const supabase                = require('../services/supabase');
const { scrapeTrackerGG }     = require('../services/scraper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('🎮 Lie ton profil tracker.gg à WARSTACK')
    .addStringOption(option =>
      option.setName('url').setDescription('Ton URL tracker.gg ex: https://tracker.gg/bf6/profile/1023163556057/overview').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const url       = interaction.options.getString('url');
    const discordId = interaction.user.id;
    const username  = interaction.user.username;

    const match = url.match(/tracker\.gg\/bf6\/profile\/(\d+)/);
    if (!match) {
      return interaction.editReply({ content: '❌ URL invalide.\nExemple : `https://tracker.gg/bf6/profile/1023163556057/overview`' });
    }

    const trackerId = match[1];

    const { data: existing } = await supabase.from('players').select('*').eq('discord_id', discordId).single();

    if (existing) {
      await supabase.from('players').update({ tracker_id: trackerId, tracker_url: url, username }).eq('discord_id', discordId);
      return interaction.editReply({ content: `✅ Profil mis à jour !\n🔗 Tracker ID : \`${trackerId}\`\n📊 Les stats seront mises à jour prochainement.` });
    }

    const { error } = await supabase.from('players').insert({ discord_id: discordId, username, tracker_id: trackerId, tracker_url: url });

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return interaction.editReply({ content: '❌ Erreur lors de l\'enregistrement. Réessaie plus tard.' });
    }

    await interaction.editReply({ content: `✅ Inscription enregistrée, **${username}** !\n\n🔗 Profil lié :\n${url}\n\n📋 Les stats seront disponibles dans les prochaines heures.` });

    scrapeTrackerGG('psn', trackerId).then(async (stats) => {
      if (!stats) return;
      await supabase.from('player_snapshots').insert({
        tracker_id  : trackerId,
        kills       : parseInt(String(stats.kills).replace(/,/g, ''))    || 0,
        deaths      : parseInt(String(stats.deaths).replace(/,/g, ''))   || 0,
        kd          : parseFloat(stats.kd)                               || 0,
        wins        : parseInt(String(stats.wins).replace(/,/g, ''))     || 0,
        winrate     : parseFloat(String(stats.winrate).replace('%', '')) || 0,
        games       : parseInt(String(stats.games).replace(/,/g, ''))    || 0,
        playtime    : stats.playtime,
        snapshot_at : new Date().toISOString(),
      });
      console.log(`✅ Snapshot initial sauvegardé pour ${trackerId}`);
    });
  }
};