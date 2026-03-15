import { useEffect, useState } from 'react';

export type WorkspacePersona = 'agent' | 'admin';

const STORAGE_KEY = 'workspace_persona';

export const useWorkspacePersona = (canViewAll: boolean) => {
  const [persona, setPersonaState] = useState<WorkspacePersona>('agent');

  useEffect(() => {
    if (!canViewAll) {
      setPersonaState('agent');
      return;
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'admin' || saved === 'agent') {
      setPersonaState(saved);
    }
  }, [canViewAll]);

  const setPersona = (next: WorkspacePersona) => {
    const resolved = canViewAll ? next : 'agent';
    setPersonaState(resolved);
    window.localStorage.setItem(STORAGE_KEY, resolved);
  };

  return {
    persona: canViewAll ? persona : 'agent',
    isAgentMode: !canViewAll || persona === 'agent',
    isAdminMode: canViewAll && persona === 'admin',
    setPersona,
  };
};
