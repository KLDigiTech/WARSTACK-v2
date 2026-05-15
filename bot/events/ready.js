const cron = require('node-cron');
const { updateLeaderboard } = require('../jobs/leaderboard');
const { postMVP }           = require('../jobs/mvp');

module.exports = {
  name: 'clientReady',
  once: true,

  execute(client) {
    console.log(`✅ WARSTACK connecté en tant que ${client.user.tag}`);

    global.botClient = client;

    client.user.setActivity('⚔️ Battlefield 6 | /help', { type: 'WATCHING' });

    cron.schedule('0 * * * *', () => {
      console.log('⏰ Update leaderboard...');
      updateLeaderboard(client);
    });

    cron.schedule('0 10 * * 1', () => {
      console.log('⏰ Post MVP hebdomadaire...');
      postMVP(client);
    });

    updateLeaderboard(client);

    console.log('✅ Cron jobs démarrés');
  }
};