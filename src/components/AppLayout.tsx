import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import CrmNotificationBell from './CrmNotificationBell';
import GlobalSearch from './GlobalSearch';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileLayout from './MobileLayout';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { user } = useAuth();
  const isMobile = useIsMobile();

  usePushNotifications(user?.id);   // Native push notifications (Android APK)
  useRealtimeNotifications(user?.id); // Real-time in-app notifications (no API key needed)
  

  // On mobile, render the simplified layout
  if (isMobile) return <MobileLayout />;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-8 py-3 border-b border-border/60 glass">
          <div className="flex items-center gap-2">
            {!isHome && (
              <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 hover:shadow-card"
            >
              <span>Buscar...</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">⌘K</kbd>
            </button>
            <CrmNotificationBell />
          </div>
        </header>
        <GlobalSearch />
        <main className="flex-1">
          <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
