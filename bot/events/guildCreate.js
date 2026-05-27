const { setupStructure } = require('../services/setupStructure');

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    console.log(`✅ WARSTACK rejoint le serveur : ${guild.name}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    await setupStructure(guild);
  }
};