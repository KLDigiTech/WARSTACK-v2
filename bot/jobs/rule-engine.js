const supabase = require('../services/supabase');

async function getRules(guildId, triggerType) {
  const { data } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('guild_id', guildId)
    .eq('trigger_type', triggerType)
    .eq('enabled', true);
  return data || [];
}

function interpolate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`);
}

async function executeRule(rule, context) {
  const { action_type, action_config } = rule;
  const { member, guild, message }     = context;

  const vars = {
    username : member?.user?.username || member?.username || '',
    server   : guild?.name || '',
  };

  try {
    switch (action_type) {

      case 'send_dm': {
        const text = interpolate(action_config.text || '', vars);
        await member.send(text).catch(() => {});
        break;
      }

      case 'send_message': {
        const ch   = await guild.channels.fetch(action_config.channel_id).catch(() => null);
        const text = interpolate(action_config.text || '', vars);
        if (ch) await ch.send(text).catch(() => {});
        break;
      }

      case 'add_role': {
        const role = await guild.roles.fetch(action_config.role_id).catch(() => null);
        if (role && member.roles) await member.roles.add(role).catch(() => {});
        break;
      }

      case 'remove_role': {
        const role = await guild.roles.fetch(action_config.role_id).catch(() => null);
        if (role && member.roles) await member.roles.remove(role).catch(() => {});
        break;
      }

      case 'kick_member': {
        await member.kick(action_config.reason || 'Rule Engine').catch(() => {});
        break;
      }

      case 'ban_member': {
        await member.ban({ reason: action_config.reason || 'Rule Engine' }).catch(() => {});
        break;
      }

      case 'mute_member': {
        const duration = (action_config.duration || 10) * 60 * 1000;
        await member.timeout(duration, 'Rule Engine').catch(() => {});
        break;
      }

      case 'delete_message': {
        if (message?.deletable) await message.delete().catch(() => {});
        break;
      }

      case 'log_action': {
        const ch = await guild.channels.fetch(action_config.channel_id).catch(() => null);
        if (ch) {
          await ch.send({
            embeds: [{
              color      : 0x00ff88,
              title      : '⚡ Rule Engine',
              description: `Règle **${rule.name}** déclenchée`,
              fields     : [
                { name: 'Déclencheur', value: rule.trigger_type, inline: true },
                { name: 'Action',      value: rule.action_type,  inline: true },
                { name: 'Membre',      value: vars.username || '—', inline: true },
              ],
              timestamp  : new Date().toISOString(),
            }],
          }).catch(() => {});
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[RuleEngine] Erreur règle ${rule.id}:`, err.message);
  }
}

async function fireRules(guildId, triggerType, context) {
  const rules = await getRules(guildId, triggerType);
  for (const rule of rules) {
    // Vérif trigger_config si nécessaire
    if (triggerType === 'member_warns_reach') {
      const needed = rule.trigger_config?.count || 3;
      if (context.warnCount !== needed) continue;
    }
    if (triggerType === 'message_contains') {
      const word = (rule.trigger_config?.word || '').toLowerCase();
      if (!word || !context.content?.toLowerCase().includes(word)) continue;
    }
    await executeRule(rule, context);
  }
}

module.exports = { fireRules };