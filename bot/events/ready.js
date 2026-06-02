const cron = require('node-cron');
const { updateLeaderboard }        = require('../jobs/leaderboard');
const { postMVP }                  = require('../jobs/mvp');
const { autoCloseInactiveTickets } = require('../jobs/ticket-autoclose');

module.exports = {
  name: 'clientReady',
  once: true,

  execute(client) {
    console.log(`✅ WARSTACK connecté en tant que ${client.user.tag}`);

    global.botClient = client;

    client.user.setActivity('⚔️ Battlefield 6 | /help', { type: 'WATCHING' });

    // Leaderboard — toutes les heures
    cron.schedule('0 * * * *', () => {
      console.log('⏰ Update leaderboard...');
      updateLeaderboard(client);
    });

    // MVP hebdomadaire — lundi 10h
    cron.schedule('0 10 * * 1', () => {
      console.log('⏰ Post MVP hebdomadaire...');
      postMVP(client);
    });

    // Auto-close tickets inactifs — tous les jours à 3h du matin
    cron.schedule('0 3 * * *', () => {
      console.log('⏰ Vérification tickets inactifs...');
      autoCloseInactiveTickets(client);
    });

    console.log('✅ Cron jobs démarrés');
  }
};