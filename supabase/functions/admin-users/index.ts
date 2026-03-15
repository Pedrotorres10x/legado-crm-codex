import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * admin-users — List, delete, and manage roles for users
 * Requires admin role.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify JWT and admin role
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'No authorization' }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Check admin role
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin only' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'list';

  // ── List users ──
  if (action === 'list') {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
    if (error) return json({ error: error.message }, 500);

    // Get all roles
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const roleMap: Record<string, string[]> = {};
    (roles || []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });

    // Get profiles
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email, phone, avatar_url');
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    const result = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned: u.banned_until ? true : false,
      full_name: profileMap[u.id]?.full_name || u.user_metadata?.full_name || '',
      avatar_url: profileMap[u.id]?.avatar_url || '',
      phone: profileMap[u.id]?.phone || '',
      roles: roleMap[u.id] || [],
    }));

    return json({ users: result });
  }

  // ── Delete user ──
  if (action === 'delete') {
    const targetId = body.user_id;
    if (!targetId) return json({ error: 'user_id required' }, 400);
    if (targetId === user.id) return json({ error: 'Cannot delete yourself' }, 400);

    // Detach business records that still reference auth.users via agent_id
    const detachAgentRefs = [
      supabase.from('captaciones').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('contacts').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('interactions').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('matches').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('offers').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('properties').update({ agent_id: null }).eq('agent_id', targetId),
      supabase.from('visits').update({ agent_id: null }).eq('agent_id', targetId),
    ];

    // Remove direct user-owned rows
    const removeUserRows = [
      supabase.from('user_roles').delete().eq('user_id', targetId),
      supabase.from('chat_messages').delete().eq('user_id', targetId),
      supabase.from('chat_channel_members').delete().eq('user_id', targetId),
      supabase.from('internal_comments').delete().eq('user_id', targetId),
      supabase.from('notifications').delete().eq('agent_id', targetId),
      supabase.from('profiles').delete().eq('user_id', targetId),
    ];

    const results = await Promise.all([...detachAgentRefs, ...removeUserRows]);
    results.forEach((r, i) => {
      if (r.error) console.error(`[admin-users] cleanup step ${i} error:`, r.error.message);
    });

    const { error } = await supabase.auth.admin.deleteUser(targetId);
    if (error) {
      console.error('[admin-users] Delete auth user error:', JSON.stringify(error));
      return json({ error: error.message || 'Error eliminando usuario' }, 500);
    }
    return json({ ok: true });
  }

  // ── Ban/unban user ──
  if (action === 'ban') {
    const targetId = body.user_id;
    if (!targetId) return json({ error: 'user_id required' }, 400);
    if (targetId === user.id) return json({ error: 'Cannot ban yourself' }, 400);

    const banUntil = body.unban ? 'none' : '2099-12-31T23:59:59Z';
    const { error } = await supabase.auth.admin.updateUserById(targetId, {
      ban_duration: body.unban ? 'none' : '876000h', // ~100 years
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Set role ──
  if (action === 'set_role') {
    const targetId = body.user_id;
    const role = body.role; // 'admin' | 'coordinadora' | 'agente'
    if (!targetId || !role) return json({ error: 'user_id and role required' }, 400);
    if (targetId === user.id) return json({ error: 'Cannot change your own role' }, 400);

    // Remove all existing roles
    await supabase.from('user_roles').delete().eq('user_id', targetId);

    // Insert new role (agente = no role entry needed, just remove all)
    if (role !== 'agente') {
      const { error } = await supabase.from('user_roles').insert({ user_id: targetId, role });
      if (error) return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
