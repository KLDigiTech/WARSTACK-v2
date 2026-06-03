// bot/commands/onboarding.js
const { SlashCommandBuilder } = require('discord.js');
const supabase = require('../services/supabase');
const { postOnboardingPanel } = require('../services/onboarding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('🚪 Poster le panel de vérification dans le salon configuré'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    // Charger config depuis Supabase
    const { data: configs } = await supabase
      .from('config')
      .select('*')
      .eq('guild_id', guild.id);

    const getConf = (key) => configs?.find(c => c.key === key)?.value;

    const channelId = getConf('ob_channel');
    if (!channelId) {
      return interaction.editReply({ content: '❌ Aucun salon de vérification configuré dans le dashboard.' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.editReply({ content: '❌ Salon introuvable. Vérifie la config dashboard.' });
    }

    try {
      const payload = buildPayloadFromConfig(configs);
      await postOnboardingPanel(channel, payload);
      await interaction.editReply({ content: `✅ Panel d'onboarding posté dans ${channel} !` });
    } catch (err) {
      console.error('❌ Erreur /onboarding:', err.message);
      await interaction.editReply({ content: '❌ Erreur lors de l\'envoi du panel.' });
    }
  }
};

function buildPayloadFromConfig(configs) {
  const getConf = (key) => configs?.find(c => c.key === key)?.value;
  const parseSafe = (val, fallback = []) => { try { return JSON.parse(val || '[]'); } catch { return fallback; } };

  return {
    rules_enabled  : getConf('ob_rules_enabled') !== 'false',
    rules_text     : getConf('ob_rules_text') || '',
    teams          : parseSafe(getConf('ob_teams')),
    games          : parseSafe(getConf('ob_games')),
    pc_enabled     : getConf('ob_pc_enabled')   !== 'false',
    psn_enabled    : getConf('ob_psn_enabled')  !== 'false',
    xbox_enabled   : getConf('ob_xbox_enabled') !== 'false',
    role_member    : getConf('ob_role_member')    || '',
    role_unverified: getConf('ob_role_unverified') || '',
    confirm_msg    : getConf('ob_confirm_msg') || 'Bienvenue {mention} ! Tu fais maintenant partie de {server}. ⚔️',
    dm_enabled     : getConf('ob_dm_enabled') === 'true',
    dm_msg         : getConf('ob_dm_msg') || '',
  };
}