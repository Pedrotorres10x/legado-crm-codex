import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CandidateProfile = {
  user_id: string;
  full_name: string | null;
};

type CandidateRoleRow = {
  user_id: string;
};

export async function resolveAssignedAgentId(
  supabase: SupabaseClient,
  preferredAgentId?: string | null,
): Promise<string | null> {
  if (preferredAgentId) return preferredAgentId;

  let roleRows: CandidateRoleRow[] | null = null;
  let rolesError: Error | null = null;

  const primaryRoles = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'agent');

  roleRows = (primaryRoles.data ?? []) as CandidateRoleRow[];
  rolesError = primaryRoles.error;

  if (rolesError) throw rolesError;

  let candidateIds = Array.from(new Set((roleRows || []).map((row) => row.user_id).filter(Boolean)));
  if (!candidateIds.length) {
    const fallbackRoles = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'coordinadora']);

    if (fallbackRoles.error) throw fallbackRoles.error;
    candidateIds = Array.from(new Set(((fallbackRoles.data || []) as CandidateRoleRow[]).map((row) => row.user_id).filter(Boolean)));
  }

  if (!candidateIds.length) return null;

  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', candidateIds);

  if (profilesError) throw profilesError;

  const profiles = ((profileRows || []) as CandidateProfile[])
    .filter((profile) => candidateIds.includes(profile.user_id));

  if (!profiles.length) return candidateIds[0] || null;

  const loadEntries = await Promise.all(
    profiles.map(async (profile) => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', profile.user_id)
        .in('status', ['nuevo', 'en_seguimiento', 'activo']);

      if (error) throw error;

      return {
        user_id: profile.user_id,
        full_name: profile.full_name || '',
        load: count ?? 0,
      };
    }),
  );

  loadEntries.sort((a, b) => {
    if (a.load !== b.load) return a.load - b.load;
    return a.full_name.localeCompare(b.full_name, 'es', { sensitivity: 'base' });
  });

  return loadEntries[0]?.user_id || null;
}
