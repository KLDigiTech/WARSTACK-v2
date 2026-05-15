import { fetchSupabase } from '../api.js';
import { GUILD_ID } from '../config.js';

const CURRENT_DISCORD_ID = '1233271006236377180';

export async function getUserPermissions() {
  try {
    const userRoles = await fetchSupabase('dashboard_user_roles?select=*');
    const userRole  = userRoles.find(role =>
      String(role.guild_id)   === String(GUILD_ID) &&
      String(role.discord_id) === String(CURRENT_DISCORD_ID)
    );
    if (!userRole) return [];
    const permissions     = await fetchSupabase('dashboard_role_permissions?select=*');
    const rolePermissions = permissions.filter(p => String(p.role_id) === String(userRole.role_id));
    return rolePermissions.map(p => p.module_key);
  } catch (err) {
    console.error('Permission service error:', err);
    return [];
  }
}