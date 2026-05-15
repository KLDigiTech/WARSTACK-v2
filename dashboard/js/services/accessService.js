import { fetchSupabase } from '../api.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export async function getDashboardRoles() {
  return await fetchSupabase('dashboard_roles?select=*&order=created_at.asc');
}

export async function getRolePermissions(roleId) {
  return await fetchSupabase(`dashboard_role_permissions?role_id=eq.${roleId}`);
}

export async function getDashboardUsers() {
  return await fetchSupabase('dashboard_user_roles?select=*');
}

export async function saveRolePermissions(roleId, permissions) {
  await fetch(`${SUPABASE_URL}/rest/v1/dashboard_role_permissions?role_id=eq.${roleId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  for (const permission of permissions) {
    await fetch(`${SUPABASE_URL}/rest/v1/dashboard_role_permissions`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId, module_key: permission })
    });
  }
}

export async function createDashboardRole(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_roles`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ guild_id: '1501685144501620798', name: name, color: '#00ff66' })
  });
  return await res.json();
}

export async function deleteDashboardRole(roleId) {
  for (const endpoint of [
    `dashboard_role_permissions?role_id=eq.${roleId}`,
    `dashboard_user_roles?role_id=eq.${roleId}`,
    `dashboard_roles?id=eq.${roleId}`
  ]) {
    await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
}

export async function updateDashboardRole(roleId, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_roles?id=eq.${roleId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return await res.json();
}