import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fmt as fmtCurrency } from '@/lib/commissions';
import { toast } from 'sonner';

type KpiTargetsConfig = {
  ventas_ano?: number;
  captaciones_mes?: number;
  citas_semana?: number;
  toques_horus_dia?: number;
};

type MatchConfigValue = {
  send_hour?: string;
  price_margin?: number;
};

type CommissionTotalRow = {
  agency_commission?: number | null;
  agent_total?: number | null;
};

type Params = {
  semesterStartIso: string;
  cost: number;
  updateCost: (value: number) => Promise<boolean>;
};

export function useDashboardAdminState({
  semesterStartIso,
  cost,
  updateCost,
}: Params) {
  const [stats, setStats] = useState({ totalAgents: 0, totalAgency: 0, totalPaid: 0, pendingApproval: 0 });
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const [kpiTargets, setKpiTargets] = useState({ ventas_ano: 10, captaciones_mes: 2, citas_semana: 2, toques_horus_dia: 4 });
  const [kpiEditing, setKpiEditing] = useState(false);
  const [kpiForm, setKpiForm] = useState({ ventas_ano: '10', captaciones_mes: '2', citas_semana: '2', toques_horus_dia: '4' });
  const [matchConfig, setMatchConfig] = useState({ send_hour: '09:00', price_margin: 25 });
  const [matchEditing, setMatchEditing] = useState(false);
  const [matchForm, setMatchForm] = useState({ send_hour: '09:00', price_margin: '25' });

  useEffect(() => {
    const fetchAdminStats = async () => {
      const [rolesRes, agencyRes, paidRes, pendingRes, kpiRes, matchRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
        supabase.from('commissions').select('agency_commission').in('status', ['aprobado', 'pagado']).gte('created_at', semesterStartIso),
        supabase.from('commissions').select('agent_total').eq('status', 'pagado').gte('created_at', semesterStartIso),
        supabase.from('commissions').select('id', { count: 'exact', head: true }).eq('status', 'borrador'),
        supabase.from('settings').select('value').eq('key', 'kpi_targets').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'match_config').maybeSingle(),
      ]);

      if (kpiRes.data?.value) {
        const v = kpiRes.data.value as KpiTargetsConfig;
        const targets = {
          ventas_ano: v.ventas_ano ?? 10,
          captaciones_mes: v.captaciones_mes ?? 2,
          citas_semana: v.citas_semana ?? 2,
          toques_horus_dia: v.toques_horus_dia ?? 4,
        };
        setKpiTargets(targets);
        setKpiForm({
          ventas_ano: targets.ventas_ano.toString(),
          captaciones_mes: targets.captaciones_mes.toString(),
          citas_semana: targets.citas_semana.toString(),
          toques_horus_dia: targets.toques_horus_dia.toString(),
        });
      }

      if (matchRes.data?.value) {
        const mc = matchRes.data.value as MatchConfigValue;
        const cfg = { send_hour: mc.send_hour ?? '09:00', price_margin: mc.price_margin ?? 25 };
        setMatchConfig(cfg);
        setMatchForm({ send_hour: cfg.send_hour, price_margin: cfg.price_margin.toString() });
      }

      const agencyRows = (agencyRes.data || []) as CommissionTotalRow[];
      const paidRows = (paidRes.data || []) as CommissionTotalRow[];
      setStats({
        totalAgents: rolesRes.count || 0,
        totalAgency: agencyRows.reduce((sum, row) => sum + (row.agency_commission || 0), 0),
        totalPaid: paidRows.reduce((sum, row) => sum + (row.agent_total || 0), 0),
        pendingApproval: pendingRes.count || 0,
      });
    };

    fetchAdminStats();
  }, [semesterStartIso]);

  const handleSaveCost = async () => {
    const val = Number(costInput);
    if (!val || val <= 0) {
      toast.error('Introduce un valor válido');
      return;
    }
    const ok = await updateCost(val);
    if (ok) {
      toast.success(`Coste fijo actualizado a ${fmtCurrency(val)}/mes`);
      setEditingCost(false);
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleSaveKpis = async () => {
    const targets = {
      ventas_ano: Number(kpiForm.ventas_ano) || 10,
      captaciones_mes: Number(kpiForm.captaciones_mes) || 2,
      citas_semana: Number(kpiForm.citas_semana) || 2,
      toques_horus_dia: Number(kpiForm.toques_horus_dia) || 4,
    };
    const { error } = await supabase.from('settings').upsert({ key: 'kpi_targets', value: targets }, { onConflict: 'key' });
    if (error) {
      toast.error('Error al guardar KPIs');
      return;
    }
    setKpiTargets(targets);
    setKpiEditing(false);
    toast.success('Objetivos KPI actualizados');
  };

  const handleSaveMatchConfig = async () => {
    const cfg = {
      send_hour: matchForm.send_hour || '09:00',
      price_margin: Math.max(1, Math.min(100, Number(matchForm.price_margin) || 25)),
    };
    const { error } = await supabase.from('settings').upsert({ key: 'match_config', value: cfg }, { onConflict: 'key' });
    if (error) {
      toast.error('Error al guardar configuración');
      return;
    }
    setMatchConfig(cfg);
    setMatchEditing(false);
    toast.success('Configuración de envío actualizada');
  };

  return {
    stats,
    editingCost,
    setEditingCost,
    costInput,
    setCostInput,
    kpiTargets,
    kpiEditing,
    setKpiEditing,
    kpiForm,
    setKpiForm,
    matchConfig,
    matchEditing,
    setMatchEditing,
    matchForm,
    setMatchForm,
    handleSaveCost,
    handleSaveKpis,
    handleSaveMatchConfig,
  };
}
