const supabase          = require('../services/supabase');
const { fireRules }     = require('../jobs/rule-engine');

function getConfig(configs, key) {
  return configs?.find(c => c.key === key)?.value || null;
}

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member) {
    try {
      const guild = member.guild;

      const { data: configs } = await supabase
        .from('config')
        .select('*')
        .eq('guild_id', guild.id);

      // ── Audit log ──────────────────────────────────────
      await supabase.from('audit_logs').insert({
        guild_id    : guild.id,
        type        : 'member',
        action      : 'member_join',
        author_id   : member.user.id,
        author_name : member.user.username,
        extra       : { account_created: member.user.createdAt },
      }).catch(() => {});

      // ── Rule Engine ────────────────────────────────────
      await fireRules(guild.id, 'member_join', { member, guild });

      // ── Anti Raid ──────────────────────────────────────
      const raidEnabled = getConfig(configs, 'automod_raid_enabled') === 'true';
      if (raidEnabled) {
        const raidAge      = parseInt(getConfig(configs, 'automod_raid_age')      || '7');
        const raidNoAvatar = getConfig(configs, 'automod_raid_no_avatar')         === 'true';
        const raidAction   = getConfig(configs, 'automod_raid_action')            || 'kick';
        const logChannelId = getConfig(configs, 'automod_logs_channel');

        const accountAge  = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        const hasNoAvatar = !member.user.avatar;
        const isRaider    = accountAge < raidAge || (raidNoAvatar && hasNoAvatar);

        if (isRaider) {
          const reason = accountAge < raidAge
            ? `Anti-Raid : compte trop récent (${Math.floor(accountAge)}j)`
            : 'Anti-Raid : compte sans avatar';

          switch (raidAction) {
            case 'kick'   : await member.kick(reason).catch(() => {}); break;
            case 'ban'    : await guild.members.ban(member.id, { reason }).catch(() => {}); break;
            case 'timeout': await member.timeout(24 * 60 * 60 * 1000, reason).catch(() => {}); break;
          }

          await supabase.from('sanctions').insert({
            guild_id      : guild.id,
            discord_id    : member.user.id,
            username      : member.user.username,
            type          : raidAction,
            reason,
            moderator_id  : 'automod',
            moderator_name: 'AutoMod Anti-Raid',
            active        : true,
          });

          await supabase.from('audit_logs').insert({
            guild_id    : guild.id,
            type        : 'moderation',
            action      : `automod_${raidAction}`,
            author_id   : member.user.id,
            author_name : member.user.username,
            content     : reason,
          }).catch(() => {});

          if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
              await logChannel.send(
                `🚨 **Anti-Raid** — ${raidAction.toUpperCase()}\n👤 ${member.user.username}\n📋 ${reason}`
              );
            }
          }

          return;
        }
      }

      // ── Message bienvenue ──────────────────────────────
      const welcomeChannelId = getConfig(configs, 'welcome_channel');
      const welcomeMessage   = getConfig(configs, 'welcome_message');

      if (welcomeChannelId && welcomeMessage) {
        const channel = guild.channels.cache.get(welcomeChannelId);
        if (channel) {
          const filled = welcomeMessage
            .replace(/{mention}/g,     member.toString())
            .replace(/{user}/g,        member.user.username)
            .replace(/{server}/g,      guild.name)
            .replace(/{membercount}/g, guild.memberCount);
          await channel.send(filled);
        }
      }

      // ── DM bienvenue ───────────────────────────────────
      const dmEnabled = getConfig(configs, 'enable_dm') === 'true';
      const dmMessage = getConfig(configs, 'dm_message');

      if (dmEnabled && dmMessage) {
        const filled = dmMessage
          .replace(/{mention}/g,     member.toString())
          .replace(/{user}/g,        member.user.username)
          .replace(/{server}/g,      guild.name)
          .replace(/{membercount}/g, guild.memberCount);
        await member.send(filled).catch(() => {});
      }

      // ── Délai autorole ─────────────────────────────────
      const delayMin = parseInt(getConfig(configs, 'autorole_delay') || '0');
      const applyRoles = async () => {
        const savedRoles = getConfig(configs, 'autoroles');
        const roles      = savedRoles ? JSON.parse(savedRoles) : [];
        for (const r of roles) {
          const role = guild.roles.cache.get(r.id);
          if (role) await member.roles.add(role).catch(() => {});
        }

        const autorole_dm    = getConfig(configs, 'autorole_dm') === 'true';
        const autorole_dmMsg = getConfig(configs, 'autorole_dm_message');
        if (autorole_dm && autorole_dmMsg) {
          const roleNames = roles.map(r => r.name).join(', ');
          const filled    = autorole_dmMsg
            .replace(/{server}/g, guild.name)
            .replace(/{role}/g,   roleNames)
            .replace(/{user}/g,   member.user.username);
          await member.send(filled).catch(() => {});
        }
      };

      if (delayMin > 0) {
        setTimeout(applyRoles, delayMin * 60 * 1000);
      } else {
        await applyRoles();
      }

      // ── Compteur membres ───────────────────────────────
      const counterOn  = getConfig(configs, 'counter_enabled') === 'true';
      const counterFmt = getConfig(configs, 'counter_format') || '👥 Membres : {count}';
      const counterCh  = getConfig(configs, 'counter_channel');

      if (counterOn && counterCh) {
        const channel = guild.channels.cache.get(counterCh);
        if (channel) {
          const name = counterFmt.replace(/{count}/g, guild.memberCount);
          await channel.setName(name).catch(() => {});
        }
      }

    } catch (err) {
      console.error('❌ guildMemberAdd error:', err.message);
    }
  }
};