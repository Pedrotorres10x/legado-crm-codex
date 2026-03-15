import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  LayoutDashboard, Users, Building2,
  MoreHorizontal, Search, Phone,
  Shield, Globe, LogOut, UserCircle, TrendingUp, ChevronRight, Rss, Wrench, Radar, CheckSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

import { useAuth } from '@/contexts/AuthContext';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';

import CrmNotificationBell from './CrmNotificationBell';
import GlobalSearch from './GlobalSearch';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', exact: true },
  { to: '/operations', icon: Radar, label: 'Operar' },
  { to: '/contacts', icon: Users, label: 'Contactos' },
  { to: '/properties', icon: Building2, label: 'Inmuebles' },
];

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, canViewAll } = useAuth();
  const { isAgentMode } = useWorkspacePersona(canViewAll);
  const [moreOpen, setMoreOpen] = useState(false);

  usePushNotifications(user?.id);
  useRealtimeNotifications(user?.id);

  const moreLinks = [
    { to: '/tasks', icon: CheckSquare, label: 'Planificación' },
    { to: '/comms?tab=calls', icon: Phone, label: 'Llamadas' },
    { to: '/profile', icon: UserCircle, label: 'Mi ficha' },
    ...(!isAgentMode
      ? [
          { to: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
          { to: '/tools', icon: Wrench, label: 'Herramientas' },
          { to: '/portales', icon: Rss, label: 'Portales', adminOnly: true },
          { to: '/web-leads', icon: Globe, label: 'Web', adminOnly: true },
        ]
      : []),
  ];
  

  const isActive = (to: string, exact = false) => {
    if (exact) return location.pathname === to;
    const path = to.split('?')[0];
    return location.pathname.startsWith(path);
  };

  const handleNav = (to: string) => {
    hapticLight();
    setMoreOpen(false);
    navigate(to);
  };

  const handleSignOut = async () => {
    hapticMedium();
    setMoreOpen(false);
    await supabase.auth.signOut();
  };

  const isMoreActive = moreLinks.some(l => isActive(l.to));

  return (
    <div
      className="flex flex-col bg-background"
      style={{
        minHeight: '100dvh',
        // Respect device safe areas (notch, home bar, status bar)
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur-2xl"
        style={{ paddingTop: '10px', paddingBottom: '10px' }}
      >
        {/* Brand — logo + name */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#1a1f36] flex items-center justify-center overflow-hidden shadow-sm">
            <img
              src="/assets/icon-only.png"
              alt="Legado CRM"
              className="h-5 w-5 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const p = e.currentTarget.parentElement;
                if (p) p.innerHTML = '<span style="font-size:14px">🏠</span>';
              }}
            />
          </div>
          <span className="font-display font-bold text-[16px] text-foreground tracking-tight" style={{ letterSpacing: '-0.03em' }}>
            Legado CRM
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground active:bg-muted transition-colors"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <CrmNotificationBell />
        </div>
      </header>

      <GlobalSearch />

      {/* ── Main content — scrollable, with room for bottom tab bar ── */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div className="p-4 animate-fade-in-up">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Tab Bar ── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-background/98 backdrop-blur-xl border-t border-border/60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch h-16">
          {tabs.map(({ to, icon: Icon, label, exact }) => {
            const active = isActive(to, exact);
            return (
              <button
                key={to}
                onClick={() => { hapticLight(); navigate(to); }}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-[3px] text-[10px] font-semibold transition-colors select-none',
                  active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-7 w-12 rounded-2xl transition-all duration-200',
                  active ? 'bg-primary/12' : ''
                )}>
                  <Icon className={cn('transition-all duration-200', active ? 'h-[22px] w-[22px]' : 'h-5 w-5')} />
                </div>
                <span className={cn('transition-all', active ? 'opacity-100' : 'opacity-70')}>{label}</span>
              </button>
            );
          })}

          {/* Más */}
          <button
            onClick={() => { hapticMedium(); setMoreOpen(true); }}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-[3px] text-[10px] font-semibold transition-colors select-none',
              isMoreActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
            )}
          >
            <div className={cn(
              'flex items-center justify-center h-7 w-12 rounded-2xl transition-all duration-200',
              isMoreActive ? 'bg-primary/12' : ''
            )}>
              <MoreHorizontal className={cn('transition-all duration-200', isMoreActive ? 'h-[22px] w-[22px]' : 'h-5 w-5')} />
            </div>
            <span className={cn('transition-all', isMoreActive ? 'opacity-100' : 'opacity-70')}>Más</span>
          </button>
        </div>
      </nav>

      {/* ── More Sheet ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto p-0">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <SheetHeader className="px-5 pt-2 pb-3">
            <SheetTitle className="text-base font-display">{isAgentMode ? 'Trabajo de calle' : 'Menú'}</SheetTitle>
          </SheetHeader>
          <div className="px-3 pb-4 space-y-0.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {moreLinks
              .filter(l => !l.adminOnly || canViewAll)
              .map(({ to, icon: Icon, label }) => (
                <button
                  key={to}
                  onClick={() => handleNav(to)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium transition-colors active:scale-[0.98]',
                    isActive(to)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground active:bg-muted'
                  )}
                >
                  <Icon className="h-[20px] w-[20px] shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              ))}

            <div className="h-px bg-border mx-1 my-2" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-destructive active:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-[20px] w-[20px] shrink-0" />
              <span className="flex-1 text-left">Cerrar sesión</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileLayout;
