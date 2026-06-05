// bot/commands/onboarding.js
const { SlashCommandBuilder } = require('discord.js');
const supabase = require('../services/supabase');
const { postOnboardingPanel } = require('../services/onboarding');

// ── Anti-spam : garde en mémoire les guilds en cours de post ─────────────────
const _posting = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('🚪 Poster le panel de vérification dans le salon configuré'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    // ── Guard anti double-post ────────────────────────────────────────────────
    if (_posting.has(guild.id)) {
      return interaction.editReply({ content: '⏳ Panel en cours d\'envoi, patiente une seconde...' });
    }
    _posting.add(guild.id);

    try {
      const { data: configs } = await supabase
        .from('config')
        .select('*')
        .eq('guild_id', guild.id);

      const getConf = (key) => {
        const val = configs?.find(c => c.key === key)?.value;
        if (typeof val === 'string' && val.startsWith('"')) {
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      };

      const channelId = getConf('ob_channel');

      if (!channelId) {
        return interaction.editReply({ content: '❌ Aucun salon de vérification configuré dans le dashboard.' });
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.editReply({ content: `❌ Salon introuvable (ID: ${channelId}). Vérifie la config dashboard.` });
      }

      const payload = buildPayloadFromConfig(configs);
      await postOnboardingPanel(channel, payload);
      await interaction.editReply({ content: `✅ Panel d'onboarding posté dans ${channel} !` });

    } catch (err) {
      console.error('❌ Erreur /onboarding:', err.message);
      await interaction.editReply({ content: '❌ Erreur lors de l\'envoi du panel.' });
    } finally {
      // Libère le verrou après 5 secondes (le temps que Discord traite)
      setTimeout(() => _posting.delete(guild.id), 5000);
    }
  }
};

function buildPayloadFromConfig(configs) {
  const getConf = (key) => {
    const val = configs?.find(c => c.key === key)?.value;
    if (typeof val === 'string' && val.startsWith('"')) {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  };

  const parseSafe = (val, fallback = []) => {
    try { return JSON.parse(val || '[]'); } catch { return fallback; }
  };

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
    confirm_msg    : getConf('ob_confirm_msg') || 'Bienvenue {mention} ! ⚔️',
    dm_enabled     : getConf('ob_dm_enabled') === 'true',
    dm_msg         : getConf('ob_dm_msg') || '',
  };
}