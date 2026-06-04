const supabase      = require('../services/supabase');
const { fireRules } = require('../jobs/rule-engine');

const spamTracker = new Map();

function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value || null;
}

async function applyAction(member, action, reason, guild, logChannelId) {
  try {
    switch (action) {
      case 'warn':
        await member.send(`⚠️ Avertissement sur **${guild.name}** : ${reason}`).catch(() => {});
        break;
      case 'delete': break;
      case 'timeout':
        await member.timeout(10 * 60 * 1000, reason);
        break;
      case 'kick':
        await member.kick(reason);
        break;
      case 'ban':
        await guild.members.ban(member.id, { reason });
        break;
    }

    await supabase.from('sanctions').insert({
      guild_id      : guild.id,
      discord_id    : member.user.id,
      username      : member.user.username,
      type          : action === 'delete' ? 'warn' : action,
      reason,
      moderator_id  : 'automod',
      moderator_name: 'AutoMod',
      active        : true,
    });

    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        await logChannel.send(
          `🤖 **AutoMod** — ${action.toUpperCase()}\n👤 ${member.user.username}\n📋 ${reason}`
        );
      }
    }
  } catch (err) {
    console.error('❌ AutoMod action error:', err.message);
  }
}

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;

    const guild = message.guild;

    const { data: configs } = await supabase
      .from('config')
      .select('*')
      .eq('guild_id', guild.id);

    if (!configs?.length) return;

    const logChannelId   = getConfig(configs, 'automod_logs_channel');
    const exceptChannels = JSON.parse(getConfig(configs, 'automod_except_channels') || '[]');
    const exceptRoles    = JSON.parse(getConfig(configs, 'automod_except_roles')    || '[]');

    if (exceptChannels.includes(message.channelId)) return;

    const member = message.member;
    if (!member) return;
    if (member.roles.cache.some(r => exceptRoles.includes(r.id))) return;
    if (member.permissions.has('ManageMessages')) return;

    const content = message.content;

    // ── ANTI SPAM ──────────────────────────────────────────
    if (getConfig(configs, 'automod_spam_enabled') === 'true') {
      const maxMsg  = parseInt(getConfig(configs, 'automod_spam_max')    || '5');
      const period  = parseInt(getConfig(configs, 'automod_spam_period') || '10') * 1000;
      const action1 = getConfig(configs, 'automod_spam_action1') || 'warn';
      const action2 = getConfig(configs, 'automod_spam_action2') || 'timeout';
      const action3 = getConfig(configs, 'automod_spam_action3') || 'kick';

      const userId = message.author.id;
      if (!spamTracker.has(userId)) {
        spamTracker.set(userId, { count: 0, violations: 0, timer: null });
      }

      const tracker = spamTracker.get(userId);
      tracker.count++;

      if (!tracker.timer) {
        tracker.timer = setTimeout(() => {
          spamTracker.delete(userId);
        }, period);
      }

      if (tracker.count >= maxMsg) {
        await message.delete().catch(() => {});
        tracker.violations++;
        tracker.count = 0;

        const action = tracker.violations === 1 ? action1
                     : tracker.violations === 2 ? action2
                     : action3;

        await applyAction(member, action, `Spam détecté (${tracker.violations} violations)`, guild, logChannelId);
        await fireRules(guild.id, 'message_spam', { member, guild, message, content });
      }
    }

    // ── ANTI LIENS ─────────────────────────────────────────
    if (getConfig(configs, 'automod_links_enabled') === 'true') {
      const urlRegex  = /(https?:\/\/[^\s]+)/gi;
      const whitelist = (getConfig(configs, 'automod_links_whitelist') || '').split('\n').map(d => d.trim().toLowerCase()).filter(Boolean);
      const linksAction = getConfig(configs, 'automod_links_action') || 'delete';

      const urls = content.match(urlRegex);
      if (urls) {
        const hasBlocked = urls.some(url => {
          try {
            const domain = new URL(url).hostname.replace('www.', '');
            return !whitelist.some(w => domain.endsWith(w));
          } catch { return true; }
        });

        if (hasBlocked) {
          await message.delete().catch(() => {});
          if (linksAction !== 'delete') {
            await applyAction(member, linksAction, 'Lien non autorisé', guild, logChannelId);
          } else {
            await supabase.from('sanctions').insert({
              guild_id: guild.id, discord_id: member.user.id,
              username: member.user.username, type: 'warn',
              reason: 'Lien non autorisé (supprimé)',
              moderator_id: 'automod', moderator_name: 'AutoMod', active: true,
            });
          }
        }
      }
    }

    // ── ANTI MENTIONS ──────────────────────────────────────
    if (getConfig(configs, 'automod_mentions_enabled') === 'true') {
      const maxMentions    = parseInt(getConfig(configs, 'automod_mentions_max') || '5');
      const mentionsAction = getConfig(configs, 'automod_mentions_action') || 'delete';
      const mentionCount   = message.mentions.users.size + message.mentions.roles.size;

      if (mentionCount >= maxMentions) {
        await message.delete().catch(() => {});
        await applyAction(member, mentionsAction, `Mass mention (${mentionCount} mentions)`, guild, logChannelId);
      }
    }

    // ── ANTI CAPS ──────────────────────────────────────────
    if (getConfig(configs, 'automod_caps_enabled') === 'true') {
      const maxPercent = parseInt(getConfig(configs, 'automod_caps_percent')    || '70');
      const minLength  = parseInt(getConfig(configs, 'automod_caps_min_length') || '10');
      const capsAction = getConfig(configs, 'automod_caps_action') || 'delete';

      if (content.length >= minLength) {
        const upper = content.replace(/[^a-zA-Z]/g, '');
        if (upper.length > 0) {
          const capsRatio = (content.replace(/[^A-Z]/g, '').length / upper.length) * 100;
          if (capsRatio >= maxPercent) {
            await message.delete().catch(() => {});
            await applyAction(member, capsAction, `Abus de majuscules (${Math.round(capsRatio)}%)`, guild, logChannelId);
          }
        }
      }
    }

    // ── MOTS INTERDITS ─────────────────────────────────────
    if (getConfig(configs, 'automod_words_enabled') === 'true') {
      const wordsList   = (getConfig(configs, 'automod_words_list') || '').split('\n').map(w => w.trim().toLowerCase()).filter(Boolean);
      const wordsAction = getConfig(configs, 'automod_words_action') || 'delete';
      const lower       = content.toLowerCase();

      const found = wordsList.find(w => lower.includes(w));
      if (found) {
        await message.delete().catch(() => {});
        await applyAction(member, wordsAction, `Mot interdit détecté`, guild, logChannelId);
      }
    }

    // ── RULE ENGINE — message_contains ─────────────────────
    await fireRules(guild.id, 'message_contains', {
      member,
      guild,
      message,
      content,
    });
  }
};