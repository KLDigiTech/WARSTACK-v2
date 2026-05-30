const { SlashCommandBuilder } = require('discord.js');
const supabase                = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('🎯 Gestion des événements')
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('S\'inscrire à un événement')
        .addStringOption(o =>
          o.setName('statut')
            .setDescription('Ton statut')
            .setRequired(true)
            .addChoices(
              { name: '✅ Présent',    value: 'present' },
              { name: '❔ Peut-être',  value: 'maybe'   },
              { name: '❌ Absent',     value: 'absent'  },
              { name: '🎮 Remplaçant', value: 'reserve' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Se désinscrire de l\'événement en cours')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Voir les événements ouverts')
    )
    .addSubcommand(sub =>
      sub.setName('participants')
        .setDescription('Voir les participants d\'un événement')
    ),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ── LIST ──────────────────────────────────────────────
    if (sub === 'list') {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('date', { ascending: true });

      if (!events?.length) {
        return interaction.reply({ content: '❌ Aucun événement ouvert.', ephemeral: true });
      }

      const lines = events.map(e => {
        const d = new Date(e.date).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long'
        });
        return `🎯 **${e.title}** — ${d} à ${e.time}${e.max_players ? ` (${e.max_players} places)` : ''}`;
      }).join('\n');

      return interaction.reply({ content: lines, ephemeral: true });
    }

    // ── JOIN ──────────────────────────────────────────────
    if (sub === 'join') {
      const status = interaction.options.getString('statut');

      // Récupérer l'événement ouvert le plus proche
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('date', { ascending: true })
        .limit(1);

      const event = events?.[0];
      if (!event) {
        return interaction.reply({ content: '❌ Aucun événement ouvert.', ephemeral: true });
      }

      // Vérifier places disponibles
      if (event.max_players && status === 'present') {
        const { count } = await supabase
          .from('event_participants')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'present');

        if (count >= event.max_players) {
          // Mettre en liste d'attente
          await supabase
            .from('event_participants')
            .upsert({
              event_id  : event.id,
              discord_id: interaction.user.id,
              username  : interaction.user.username,
              status    : 'reserve',
            }, { onConflict: 'event_id,discord_id' });

          return interaction.reply({
            content : `⚠️ L'événement **${event.title}** est complet. Tu as été ajouté en liste d'attente 🎮`,
            ephemeral: true
          });
        }
      }

      const { error } = await supabase
        .from('event_participants')
        .upsert({
          event_id  : event.id,
          discord_id: interaction.user.id,
          username  : interaction.user.username,
          status,
        }, { onConflict: 'event_id,discord_id' });

      if (error) {
        return interaction.reply({ content: '❌ Erreur lors de l\'inscription.', ephemeral: true });
      }

      const statusLabels = {
        present: '✅ Présent',
        maybe  : '❔ Peut-être',
        absent : '❌ Absent',
        reserve: '🎮 Remplaçant',
      };

      return interaction.reply({
        content : `${statusLabels[status]} — Tu es inscrit à **${event.title}** !`,
        ephemeral: true
      });
    }

    // ── LEAVE ─────────────────────────────────────────────
    if (sub === 'leave') {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('date', { ascending: true })
        .limit(1);

      const event = events?.[0];
      if (!event) {
        return interaction.reply({ content: '❌ Aucun événement ouvert.', ephemeral: true });
      }

      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', event.id)
        .eq('discord_id', interaction.user.id);

      if (error) {
        return interaction.reply({ content: '❌ Erreur.', ephemeral: true });
      }

      // Promouvoir le premier remplaçant si place libérée
      if (event.max_players) {
        const { data: reserve } = await supabase
          .from('event_participants')
          .select('*')
          .eq('event_id', event.id)
          .eq('status', 'reserve')
          .order('created_at', { ascending: true })
          .limit(1);

        if (reserve?.[0]) {
          await supabase
            .from('event_participants')
            .update({ status: 'present' })
            .eq('id', reserve[0].id);

          const member = await guild.members.fetch(reserve[0].discord_id).catch(() => null);
          if (member) {
            await member.send(
              `🎉 Une place s'est libérée ! Tu es maintenant **présent** à l'événement **${event.title}** !`
            ).catch(() => {});
          }
        }
      }

      return interaction.reply({
        content : `✅ Tu t'es désinscrit de **${event.title}**.`,
        ephemeral: true
      });
    }

    // ── PARTICIPANTS ──────────────────────────────────────
    if (sub === 'participants') {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('date', { ascending: true })
        .limit(1);

      const event = events?.[0];
      if (!event) {
        return interaction.reply({ content: '❌ Aucun événement ouvert.', ephemeral: true });
      }

      const { data: parts } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true });

      if (!parts?.length) {
        return interaction.reply({
          content : `**${event.title}** — Aucun participant pour l'instant.`,
          ephemeral: true
        });
      }

      const present = parts.filter(p => p.status === 'present').map(p => p.username).join(', ') || 'Aucun';
      const maybe   = parts.filter(p => p.status === 'maybe').map(p => p.username).join(', ')   || 'Aucun';
      const reserve = parts.filter(p => p.status === 'reserve').map(p => p.username).join(', ') || 'Aucun';

      return interaction.reply({
        content: `**${event.title}**\n\n✅ Présents : ${present}\n❔ Peut-être : ${maybe}\n🎮 Réserve : ${reserve}`,
        ephemeral: true
      });
    }
  }
};