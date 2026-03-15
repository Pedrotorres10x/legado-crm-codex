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

export const useAuth = () => useContext(AuthContext);

const isLocalAdminOverride = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinadora, setIsCoordinadora] = useState(false);

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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
