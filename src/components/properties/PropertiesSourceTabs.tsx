import { Building2, Globe, Home, Rss } from 'lucide-react';

type SourceTab = 'all' | 'propias' | 'office' | 'xml' | 'internacional';

type PropertiesSourceTabsProps = {
  isMobile: boolean;
  sourceTab: SourceTab;
  onSelectTab: (value: SourceTab) => void;
};

const TABS = [
  { key: 'all', label: 'Todos', icon: null },
  { key: 'propias', label: 'Propias', icon: Home },
  { key: 'office', label: 'Oficina', icon: Building2 },
  { key: 'xml', label: 'Feed XML', icon: Rss },
  { key: 'internacional', label: 'Intl.', icon: Globe },
] as const;

export default function PropertiesSourceTabs({
  isMobile,
  sourceTab,
  onSelectTab,
}: PropertiesSourceTabsProps) {
  if (isMobile) return null;

  return (
    <div className="overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-1 rounded-xl bg-muted/50 p-1 md:w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelectTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all md:px-4 md:text-sm ${
              sourceTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
