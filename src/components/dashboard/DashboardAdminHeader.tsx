import { Search, Settings, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmt as fmtCurrency } from '@/lib/commissions';

type DashboardAdminHeaderProps = {
  semesterLabel: string;
  cost: number;
  editingCost: boolean;
  costInput: string;
  setCostInput: (value: string) => void;
  setEditingCost: (value: boolean) => void;
  onSaveCost: () => void;
  onOpenDemands: () => void;
  onOpenBuyersWithoutDemand: () => void;
};

export default function DashboardAdminHeader({
  semesterLabel,
  cost,
  editingCost,
  costInput,
  setCostInput,
  setEditingCost,
  onSaveCost,
  onOpenDemands,
  onOpenBuyersWithoutDemand,
}: DashboardAdminHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground">Vista gerencial — {semesterLabel}</p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onOpenDemands}>
          <Search className="mr-1.5 h-4 w-4" />Demandas
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenBuyersWithoutDemand}>
          <Users className="mr-1.5 h-4 w-4" />Compradores sin demanda
        </Button>
        {editingCost ? (
          <>
            <Input
              type="number"
              className="h-9 w-28"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="€/mes"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onSaveCost()}
            />
            <Button size="sm" onClick={onSaveCost}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingCost(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCostInput(cost.toString());
              setEditingCost(true);
            }}
          >
            <Settings className="mr-1.5 h-4 w-4" />Coste fijo: {fmtCurrency(cost)}/mes
          </Button>
        )}
      </div>
    </div>
  );
}
