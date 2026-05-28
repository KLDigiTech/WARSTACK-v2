// bot/commands/origine.js
// /origine — enregistrer son pays, région et ville

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../services/supabase');

// Drapeaux emoji par code ISO
function getFlag(code) {
  if (!code) return '🌍';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

// Top pays avec codes ISO
const PAYS = [
  { name: 'France',          code: 'FR' },
  { name: 'Belgique',        code: 'BE' },
  { name: 'Suisse',          code: 'CH' },
  { name: 'Canada',          code: 'CA' },
  { name: 'Maroc',           code: 'MA' },
  { name: 'Algérie',         code: 'DZ' },
  { name: 'Tunisie',         code: 'TN' },
  { name: 'États-Unis',      code: 'US' },
  { name: 'Royaume-Uni',     code: 'GB' },
  { name: 'Allemagne',       code: 'DE' },
  { name: 'Espagne',         code: 'ES' },
  { name: 'Italie',          code: 'IT' },
  { name: 'Portugal',        code: 'PT' },
  { name: 'Pays-Bas',        code: 'NL' },
  { name: 'Australie',       code: 'AU' },
  { name: 'Brésil',          code: 'BR' },
  { name: 'Mexique',         code: 'MX' },
  { name: 'Japon',           code: 'JP' },
  { name: 'Sénégal',         code: 'SN' },
  { name: 'Côte d\'Ivoire',  code: 'CI' },
  { name: 'Autre',           code: 'XX' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('origine')
    .setDescription('🌍 Enregistre ta localisation sur la carte WARSTACK')
    .addStringOption(o =>
      o.setName('pays')
        .setDescription('Ton pays')
        .setRequired(true)
        .addChoices(...PAYS.map(p => ({ name: `${getFlag(p.code)} ${p.name}`, value: p.code })))
    )
    .addStringOption(o =>
      o.setName('region')
        .setDescription('Ta région (ex: Île-de-France, Occitanie...)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('ville')
        .setDescription('Ta ville (optionnel)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const discordId   = interaction.user.id;
    const countryCode = interaction.options.getString('pays');
    const region      = interaction.options.getString('region') || null;
    const city        = interaction.options.getString('ville')  || null;
    const country     = PAYS.find(p => p.code === countryCode)?.name || countryCode;
    const flag        = getFlag(countryCode);

    // Vérifie que le joueur est inscrit
    const { data: player } = await supabase
      .from('players')
      .select('discord_id, username')
      .eq('discord_id', discordId)
      .single();

    if (!player) {
      return interaction.editReply({
        content: '❌ Tu n\'es pas inscrit sur WARSTACK. Utilise **/register** d\'abord.'
      });
    }

    // Met à jour
    const { error } = await supabase
      .from('players')
      .update({
        country,
        country_code: countryCode,
        region,
        city
      })
      .eq('discord_id', discordId);

    if (error) {
      return interaction.editReply({ content: '❌ Erreur lors de l\'enregistrement.' });
    }

    // Localisation complète
    const location = [city, region, country].filter(Boolean).join(', ');

    const embed = new EmbedBuilder()
      .setTitle(`${flag} Localisation enregistrée !`)
      .setColor(0x00FF66)
      .setDescription(`Tu apparaîtras maintenant sur la carte WARSTACK.`)
      .addFields(
        { name: '🌍 Pays',    value: `${flag} ${country}`,      inline: true  },
        { name: '📍 Région',  value: region  || '—',            inline: true  },
        { name: '🏙️ Ville',   value: city    || '—',            inline: true  },
      )
      .setFooter({ text: 'WARSTACK • Carte des membres' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Annonce dans #général (optionnel)
    const channel = interaction.guild.channels.cache.find(
      c => c.name.includes('général') || c.name.includes('general')
    );
    if (channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${flag} **${player.username || interaction.user.username}** vient de ${location} !`)
            .setColor(0x00FF66)
        ]
      }).catch(() => {});
    }
  }
};