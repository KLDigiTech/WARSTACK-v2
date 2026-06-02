const supabase = require('../services/supabase');

/**
 * Ferme automatiquement les tickets inactifs depuis plus d'1 semaine.
 * Appelé par le cron dans ready.js.
 */
async function autoCloseInactiveTickets(client) {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Tickets ouverts ou en cours sans activité depuis 7 jours
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .lt('last_activity_at', oneWeekAgo);

    if (!tickets?.length) return;

    console.log(`⏰ Auto-close : ${tickets.length} ticket(s) inactif(s) depuis 7 jours`);

    for (const ticket of tickets) {
      try {
        // Update BDD
        await supabase
          .from('tickets')
          .update({
            status   : 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', ticket.id);

        // Trouver le salon Discord
        const guild = client.guilds.cache.get(ticket.guild_id)
          || client.guilds.cache.first();

        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.channel_id);

        // Charger config (catégorie clôturé + logs)
        const { data: configs } = await supabase
          .from('config')
          .select('*')
          .eq('guild_id', guild.id);

        const getConfig = (key) => configs?.find(c => c.key === key)?.value;
        const categoryClosedId = getConfig('ticket_category_closed');
        const logChId          = getConfig('ticket_logs_channel');

        if (channel) {
          await channel.send(
            '⏰ **Ticket fermé automatiquement** après 7 jours d\'inactivité.'
          );

          // Déplacer vers catégorie clôturé si configurée
          if (categoryClosedId) {
            await channel.setParent(categoryClosedId, { lockPermissions: false }).catch(() => {});
            // Retirer écriture au membre
            await channel.permissionOverwrites.edit(ticket.discord_id, {
              SendMessages: false,
            }).catch(() => {});
          } else {
            // Sinon supprimer après 5s
            setTimeout(() => channel.delete().catch(() => {}), 5000);
          }
        }

        // Log
        if (logChId) {
          const logCh = guild.channels.cache.get(logChId);
          if (logCh) {
            await logCh.send(
              `⏰ Ticket **#${ticket.id}** de **${ticket.username}** fermé automatiquement (inactivité 7 jours).`
            );
          }
        }

      } catch (err) {
        console.error(`❌ Auto-close ticket ${ticket.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ autoCloseInactiveTickets:', err.message);
  }
}

module.exports = { autoCloseInactiveTickets };