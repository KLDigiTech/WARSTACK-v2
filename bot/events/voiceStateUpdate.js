const { award } = require('../services/points');

// Tracker les sessions vocales en mémoire
// key: discord_id — value: { guildId, joinedAt }
const voiceSessions = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  once: false,

  async execute(oldState, newState) {
    const userId  = newState.member?.id || oldState.member?.id;
    const guildId = newState.guild?.id  || oldState.guild?.id;

    if (!userId || !guildId) return;
    if (newState.member?.user?.bot) return;

    const joinedChannel = !oldState.channelId && newState.channelId;
    const leftChannel   = oldState.channelId  && !newState.channelId;
    const switched      = oldState.channelId  && newState.channelId && oldState.channelId !== newState.channelId;

    // ── Rejoint un vocal ──────────────────────────────
    if (joinedChannel || switched) {
      voiceSessions.set(userId, {
        guildId,
        joinedAt: Date.now(),
      });
      console.log(`🎤 ${newState.member.user.username} rejoint le vocal`);
    }

    // ── Quitte un vocal ───────────────────────────────
    if (leftChannel || switched) {
      const session = voiceSessions.get(userId);
      if (!session) return;

      const minutes = Math.floor((Date.now() - session.joinedAt) / 60000);
      voiceSessions.delete(userId);

      if (minutes < 1) return; // moins d'1 minute = pas de gains

      // +10 XP / +5 coins par heure complète
      const hours = Math.floor(minutes / 60);
      if (hours >= 1) {
        for (let i = 0; i < hours; i++) {
          await award(userId, session.guildId, 'vocal_hour');
        }
        console.log(`🎤 ${newState.member?.user?.username || userId} — ${hours}h vocal → XP + Coins attribués`);
      }

      // Aussi récompenser les fractions d'heure (30min+)
      const remainingMinutes = minutes % 60;
      if (remainingMinutes >= 30) {
        await award(userId, session.guildId, 'vocal_hour', { reason: 'vocal_half_hour' });
        console.log(`🎤 ${userId} — 30min vocal → XP + Coins attribués`);
      }
    }
  }
};