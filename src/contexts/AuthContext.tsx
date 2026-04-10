import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { syncContacts, isAutoSyncEnabled } from '@/lib/contact-sync';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isCoordinadora: boolean;
  /** true if user can view all team data (admin or coordinadora) */
  canViewAll: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

const isLocalAdminOverride = () => {
  if (typeof window === 'undefined') return false;
  const { hostname, protocol } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    protocol === 'file:' ||
    hostname === ''
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinadora, setIsCoordinadora] = useState(false);

  const clearLocalSession = () => {
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setIsCoordinadora(false);

    if (typeof window === 'undefined') return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || key === 'workspace_persona') {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));

    try {
      window.sessionStorage.clear();
    } catch {
      // Ignore sessionStorage cleanup failures.
    }
  };

  const checkRoles = async (userId: string) => {
    if (isLocalAdminOverride()) {
      setIsAdmin(true);
      setIsCoordinadora(false);
      return;
    }

    const [adminRes, coordRes] = await Promise.all([
      supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
      supabase.rpc('has_role', { _user_id: userId, _role: 'coordinadora' }),
    ]);
    setIsAdmin(!!adminRes.data);
    setIsCoordinadora(!!coordRes.data);
  };

  const runAutoSync = async (userId: string) => {
    if (!isAutoSyncEnabled()) return;
    try {
      const result = await syncContacts(userId);
      if (result && result.total > 0) {
        toast({
          title: '📱 Contactos sincronizados',
          description: `${result.synced} contactos actualizados en tu teléfono.`,
        });
      }
    } catch {
      // Silent fail for auto-sync
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => checkRoles(session.user.id), 0);
        setTimeout(() => runAutoSync(session.user.id), 500);
      } else {
        setIsAdmin(false);
        setIsCoordinadora(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) checkRoles(session.user.id);
    }).catch(() => {
      // getSession() can fail (AbortError, network error) if Supabase is
      // temporarily unreachable. Clear any stale tokens so the SDK stops
      // retrying in the background, then unblock the UI.
      clearLocalSession();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      // Some embedded browsers/native shells keep the local session even if
      // Supabase signOut fails or the auth event never arrives.
    } finally {
      clearLocalSession();
      if (typeof window !== 'undefined') {
        const appUrl = new URL('/', window.location.origin);
        appUrl.searchParams.set('logout', String(Date.now()));
        window.location.replace(appUrl.toString());
      }
    }
  };

  const localAdminOverride = isLocalAdminOverride();
  const effectiveIsAdmin = localAdminOverride || isAdmin;
  const effectiveIsCoordinadora = !localAdminOverride && isCoordinadora;
  const canViewAll = effectiveIsAdmin || effectiveIsCoordinadora;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin: effectiveIsAdmin, isCoordinadora: effectiveIsCoordinadora, canViewAll, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
