import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PropertySnapshot = {
  id: string;
  title?: string | null;
  status?: string | null;
  legal_risk_level?: string | null;
  arras_buyer_id?: string | null;
  deed_date?: string | null;
};

type ClosingTaskAnalysis = {
  property: PropertySnapshot;
  pendingSignatureCount: number;
  blockers: string[];
};

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

const AUTO_CLOSING_SOURCES = [
  'closing_blocked',
  'closing_signature_pending',
  'closing_deed_due',
] as const;

type AutoClosingSource = (typeof AUTO_CLOSING_SOURCES)[number];

type DesiredTask = {
  key: string;
  source: AutoClosingSource;
  task: TaskInsert;
};

const buildTaskKey = (propertyId: string, source: AutoClosingSource) => `${propertyId}:${source}`;

const buildDesiredTasks = ({
  agentId,
  analysis,
  now,
}: {
  agentId: string;
  analysis: ClosingTaskAnalysis;
  now: Date;
}): DesiredTask[] => {
  const propertyTitle = analysis.property.title || 'inmueble';
  const propertyId = analysis.property.id;
  const tasks: DesiredTask[] = [];

  if (analysis.blockers.length > 0) {
    tasks.push({
      key: buildTaskKey(propertyId, 'closing_blocked'),
      source: 'closing_blocked',
      task: {
        agent_id: agentId,
        property_id: propertyId,
        contact_id: analysis.property.arras_buyer_id || null,
        completed: false,
        due_date: now.toISOString(),
        priority: analysis.property.legal_risk_level === 'alto' ? 'alta' : 'media',
        task_type: 'seguimiento',
        title: `Resolver bloqueo de cierre: ${propertyTitle}`,
        description: analysis.blockers[0],
        source: 'closing_blocked',
      },
    });
  }

  if (analysis.pendingSignatureCount > 0) {
    tasks.push({
      key: buildTaskKey(propertyId, 'closing_signature_pending'),
      source: 'closing_signature_pending',
      task: {
        agent_id: agentId,
        property_id: propertyId,
        contact_id: analysis.property.arras_buyer_id || null,
        completed: false,
        due_date: now.toISOString(),
        priority: 'media',
        task_type: 'seguimiento',
        title: `Resolver firma pendiente: ${propertyTitle}`,
        description: `${analysis.pendingSignatureCount} documento(s) siguen pendientes de firma dentro del cierre.`,
        source: 'closing_signature_pending',
      },
    });
  }

  if (analysis.property.deed_date && !['vendido', 'alquilado'].includes(analysis.property.status || '')) {
    const deedDate = new Date(analysis.property.deed_date);
    tasks.push({
      key: buildTaskKey(propertyId, 'closing_deed_due'),
      source: 'closing_deed_due',
      task: {
        agent_id: agentId,
        property_id: propertyId,
        contact_id: analysis.property.arras_buyer_id || null,
        completed: false,
        due_date: deedDate.toISOString(),
        priority: deedDate < now ? 'alta' : 'media',
        task_type: 'seguimiento',
        title: `${deedDate < now ? 'Revisar escritura vencida' : 'Preparar escritura'}: ${propertyTitle}`,
        description:
          deedDate < now
            ? 'La fecha de escritura ya ha pasado y la operacion sigue abierta.'
            : `Escritura programada para ${deedDate.toLocaleString('es-ES')}.`,
        source: 'closing_deed_due',
      },
    });
  }

  return tasks;
};

const taskNeedsUpdate = (existing: Pick<TaskRow, 'title' | 'description' | 'due_date' | 'priority' | 'contact_id'>, next: TaskInsert) =>
  existing.title !== next.title ||
  (existing.description || null) !== (next.description || null) ||
  existing.due_date !== next.due_date ||
  (existing.priority || 'media') !== (next.priority || 'media') ||
  (existing.contact_id || null) !== (next.contact_id || null);

export const syncClosingAutomationTasks = async ({
  agentId,
  analyses,
}: {
  agentId: string;
  analyses: ClosingTaskAnalysis[];
}) => {
  if (!agentId || analyses.length === 0) return;

  const propertyIds = Array.from(new Set(analyses.map(({ property }) => property.id).filter(Boolean)));
  if (propertyIds.length === 0) return;

  const now = new Date();
  const desiredTasks = analyses.flatMap((analysis) => buildDesiredTasks({ agentId, analysis, now }));
  const desiredMap = new Map(desiredTasks.map((item) => [item.key, item]));

  const { data: existingTasks, error: existingError } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, priority, contact_id, property_id, source, completed')
    .eq('agent_id', agentId)
    .eq('completed', false)
    .in('property_id', propertyIds)
    .in('source', [...AUTO_CLOSING_SOURCES]);

  if (existingError) throw existingError;

  const existingMap = new Map(
    (existingTasks || []).map((task) => [buildTaskKey(task.property_id || '', task.source as AutoClosingSource), task]),
  );

  const inserts = desiredTasks
    .filter(({ key }) => !existingMap.has(key))
    .map(({ task }) => task);

  const updates = desiredTasks
    .map(({ key, task }) => {
      const existing = existingMap.get(key);
      if (!existing || !taskNeedsUpdate(existing, task)) return null;
      return {
        id: existing.id,
        patch: {
          title: task.title,
          description: task.description,
          due_date: task.due_date,
          priority: task.priority,
          contact_id: task.contact_id,
        },
      };
    })
    .filter(Boolean) as Array<{ id: string; patch: Database['public']['Tables']['tasks']['Update'] }>;

  const staleTasks = (existingTasks || []).filter((task) => {
    const key = buildTaskKey(task.property_id || '', task.source as AutoClosingSource);
    return !desiredMap.has(key);
  });

  if (inserts.length > 0) {
    const { error } = await supabase.from('tasks').insert(inserts);
    if (error) throw error;
  }

  await Promise.all(
    updates.map(({ id, patch }) => supabase.from('tasks').update(patch).eq('id', id)),
  );

  if (staleTasks.length > 0) {
    const staleIds = staleTasks.map((task) => task.id);
    const { error } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: now.toISOString() })
      .in('id', staleIds);
    if (error) throw error;
  }
};
