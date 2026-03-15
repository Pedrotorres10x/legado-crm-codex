import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users,
  LogOut, ChevronLeft, ChevronRight, ChevronDown,
  Wrench, TrendingUp, MessageCircle,
  UserCircle, Shield, Globe, BarChart3, Receipt, ExternalLink, MessageSquare, Rss, CheckSquare, Radar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

const dailyNavEntries: NavEntry[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/operations', icon: Radar, label: 'Operaciones' },
  { to: '/tasks', icon: CheckSquare, label: 'Planificación' },
];

const crmNavEntries: NavEntry[] = [
  { to: '/properties', icon: Building2, label: 'Inmuebles' },
  { to: '/contacts', icon: Users, label: 'Personas' },
  { to: '/matches', icon: TrendingUp, label: 'Campañas' },
  { to: '/guide/advisors', icon: Receipt, label: 'Guía asesores' },
  { to: '/tools', icon: Wrench, label: 'Herramientas' },
];

const adminNavEntries: NavEntry[] = [
  { to: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
  {
    label: 'Paneles',
    icon: BarChart3,
    adminOnly: true,
    children: [
      { to: '/admin/activity', icon: BarChart3, label: 'Actividad' },
      { to: '/admin/team', icon: Users, label: 'Equipo' },
      { to: '/portales', icon: Rss, label: 'Portales' },
    ],
  },
];

const AppSidebar = () => {
  const { signOut, isAdmin, canViewAll, user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { persona, setPersona, isAgentMode, isAdminMode } = useWorkspacePersona(canViewAll);
  
  const { visibleNotifications } = useNotifications();

  const urgentCount = visibleNotifications.filter(n => (n.priority ?? 99) <= 5).length;

  const isAdminActive =
    location.pathname === '/admin/activity' ||
    location.pathname === '/admin/team' ||
    location.pathname.startsWith('/admin/team/') ||
    location.pathname === '/portales';
  const [adminOpen, setAdminOpen] = useState(isAdminActive);

  const websRoutes = ['/linkinbio-stats', '/web-leads'];
  const isWebsActive = websRoutes.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));
  const [websOpen, setWebsOpen] = useState(isWebsActive);

  useEffect(() => {
    if (isAdminMode) {
      setAdminOpen(true);
    }
  }, [isAdminMode]);

  useEffect(() => {
    if (isAdminActive) {
      setAdminOpen(true);
    }
  }, [isAdminActive]);

  const crmEntries = isAgentMode
    ? crmNavEntries.filter((entry) =>
        'to' in entry &&
        ['/properties', '/contacts', '/matches', '/guide/advisors'].includes(entry.to),
      )
    : crmNavEntries;

  const renderNavEntries = (entries: NavEntry[]) => entries.map((entry) => {
    if (isGroup(entry)) {
      if (entry.adminOnly && !canViewAll) return null;

      if (collapsed) {
        return entry.children.map(c => renderNavLink(c));
      }

      const isGroupActive = entry.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));
      const isOpen = entry.label === 'Paneles' ? adminOpen : false;
      const setOpen = entry.label === 'Paneles' ? setAdminOpen : () => {};

      return (
        <div key={entry.label}>
          <button
            onClick={() => setOpen(!isOpen)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
              isGroupActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
              isGroupActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75"
            )}>
              <entry.icon className="h-[18px] w-[18px]" />
            </div>
            <span>{entry.label}</span>
            <ChevronDown className={cn(
              "ml-auto h-4 w-4 transition-transform duration-300 text-sidebar-foreground/30",
              isOpen && "rotate-180"
            )} />
          </button>
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="space-y-0.5 mt-0.5">
              {entry.children.map(c => renderNavLink(c, true))}
            </div>
          </div>
        </div>
      );
    }

    const item = entry as NavItem;
    return renderNavLink(item);
  });

  const renderNavLink = (item: NavItem, nested = false) => {
    if (item.adminOnly && !canViewAll) {
      if (item.to !== '/admin') return null;

      return (
        <button
          key={item.to}
          type="button"
          onClick={() =>
            toast({
              title: 'Acceso restringido',
              description: 'Tu usuario no tiene rol admin o coordinadora.',
            })
          }
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 text-sidebar-foreground/45 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30",
            nested && !collapsed && "pl-12"
          )}
        >
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/35">
            <item.icon className="h-[18px] w-[18px]" />
          </div>
          {!collapsed && <span className="relative z-10">{item.label}</span>}
          {!collapsed && (
            <span className="relative z-10 ml-auto text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/35">
              Bloq.
            </span>
          )}
        </button>
      );
    }

    const itemPath = item.to.split('?')[0];
    const itemQuery = item.to.includes('?') ? item.to.split('?')[1] : null;
    const isActive = itemQuery
      ? location.pathname === itemPath && location.search.includes(itemQuery)
      : location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to) && !location.search.includes('tab='));
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
          nested && !collapsed && "pl-12",
          isActive
            ? "text-sidebar-primary-foreground"
            : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        )}
      >
        {/* Active indicator background */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl animate-fade-in" style={{ background: 'var(--gradient-primary)', opacity: 0.9 }} />
        )}
        
        <div className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
          isActive
            ? "text-sidebar-primary-foreground"
            : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75"
        )}>
          <item.icon className="h-[18px] w-[18px]" />
        </div>
        {!collapsed && <span className="relative z-10">{item.label}</span>}
        {item.to === '/admin/activity' && urgentCount > 0 && !collapsed && (
          <span className="relative z-10 ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {urgentCount > 9 ? '9+' : urgentCount}
          </span>
        )}
        {(item.to === '/tasks' || item.to === '/operations') && urgentCount > 0 && !collapsed && (
          <span className="relative z-10 ml-auto bg-primary/20 text-sidebar-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {urgentCount > 9 ? '9+' : urgentCount}
          </span>
        )}
        {isActive && !collapsed && item.to !== '/admin/activity' && (
          <div className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary-foreground animate-pulse-soft" />
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border/50 transition-all duration-400 h-screen sticky top-0 glass-sidebar",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/40 animate-fade-in">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl glow-ring"
          style={{ background: 'var(--gradient-primary)' }}>
          <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-sidebar-background animate-pulse-soft" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <span className="text-lg font-display font-bold tracking-tight text-sidebar-foreground">InmoCRM</span>
            <p className="text-[10px] text-sidebar-foreground/40 font-medium tracking-widest uppercase">Enterprise Suite</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
            Trabajo diario
          </p>
        )}
        {renderNavEntries(dailyNavEntries)}

        {!collapsed && isAdminMode && (
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
            Personas y negocio
          </p>
        )}
        {!collapsed && isAgentMode && (
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
            Personas y negocio
          </p>
        )}
        {renderNavEntries(crmEntries)}

        {canViewAll && isAdminMode && !collapsed && (
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
            Dirección
          </p>
        )}
        {isAdminMode && renderNavEntries(adminNavEntries)}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border/40 space-y-1">
        {canViewAll && !collapsed && (
          <div className="rounded-xl border border-sidebar-border/40 bg-sidebar-accent/20 p-2">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">
              Modo de trabajo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={isAgentMode ? 'secondary' : 'ghost'}
                className="h-9 justify-start gap-2"
                onClick={() => setPersona('agent')}
              >
                <UserCircle className="h-4 w-4" />Agente
              </Button>
              <Button
                type="button"
                variant={isAdminMode ? 'secondary' : 'ghost'}
                className="h-9 justify-start gap-2"
                onClick={() => setPersona('admin')}
              >
                <Shield className="h-4 w-4" />Admin
              </Button>
            </div>
          </div>
        )}

        {/* Webs dropdown */}
        {!isAgentMode && <div>
          <button
            onClick={() => setWebsOpen(!websOpen)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
              isWebsActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
              isWebsActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75"
            )}>
              <Globe className="h-[18px] w-[18px]" />
            </div>
            {!collapsed && <span>Webs</span>}
            {!collapsed && (
              <ChevronDown className={cn(
                "ml-auto h-4 w-4 transition-transform duration-300 text-sidebar-foreground/30",
                websOpen && "rotate-180"
              )} />
            )}
          </button>
          {!collapsed && (
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              websOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}>
              <div className="space-y-0.5 mt-0.5">
                {renderNavLink({ to: '/linkinbio-stats', icon: BarChart3, label: 'Link In Bio' }, true)}
                {canViewAll && renderNavLink({ to: '/web-leads', icon: Globe, label: 'Legado Colección' }, true)}
                {canViewAll && (
                  <a
                    href="https://fakturalegado.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 pl-12 text-sm font-medium transition-all duration-300 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/45">
                      <Receipt className="h-[18px] w-[18px]" />
                    </div>
                    <span className="flex items-center gap-1.5">Faktura <ExternalLink className="h-3 w-3 opacity-50" /></span>
                  </a>
                )}
                {canViewAll && (
                  <a
                    href="https://mls-benidorm.es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 pl-12 text-sm font-medium transition-all duration-300 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/45">
                      <TrendingUp className="h-[18px] w-[18px]" />
                    </div>
                    <span className="flex items-center gap-1.5">MLS Benidorm <ExternalLink className="h-3 w-3 opacity-50" /></span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>}
        <NavLink
          to="/profile"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl h-10 px-3 text-sm font-medium transition-all duration-300 ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            }`
          }
        >
          <UserCircle className="h-5 w-5 shrink-0" />
          {!collapsed && 'Mi ficha agente'}
        </NavLink>
        {canViewAll && !isAgentMode && (
          <NavLink
            to="/profile?persona=admin"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl h-10 px-3 text-sm font-medium transition-all duration-300 ${
                isActive && location.search.includes('persona=admin')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            <Shield className="h-5 w-5 shrink-0" />
            {!collapsed && 'Mi ficha admin'}
          </NavLink>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-start gap-3 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-xl h-10 transition-all duration-300"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /><span>Colapsar</span></>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-3 text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 transition-all duration-300"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && 'Cerrar Sesión'}
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
