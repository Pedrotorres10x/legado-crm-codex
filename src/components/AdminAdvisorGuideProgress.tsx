import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, BookOpenCheck, CheckCircle2, Clock3, Eye, GraduationCap, RefreshCcw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { ADVISOR_GUIDE_PASS_SCORE, ADVISOR_GUIDE_SECTIONS, ADVISOR_GUIDE_TOTAL } from '@/content/advisor-guide';

type GuideEventRow = {
  action: string;
  created_at: string;
  record_snapshot: {
    sectionId?: string;
    score?: number;
  } | null;
  user_id: string | null;
};

type AgentProfileRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
};

type AgentGuideRow = {
  userId: string;
  fullName: string;
  email: string | null;
  createdAt: string;
  dueAt: Date;
  approvedCount: number;
  completionRatio: number;
  reviewedCount: number;
  reviewedChapterIds: string[];
  approvedChapterIds: string[];
  lastActivityAt: string | null;
  overdue: boolean;
  completed: boolean;
  completedAt: string | null;
  trafficLight: 'green' | 'yellow' | 'red';
  examScores: Array<{
    sectionId: string;
    score: number;
    passed: boolean;
    attemptedAt: string;
  }>;
};

const chapterLabelById = new Map(
  ADVISOR_GUIDE_SECTIONS.map((section) => [section.id, section.chapterLabel ?? `Cap. ${section.order}`]),
);

const chapterTitleById = new Map(
  ADVISOR_GUIDE_SECTIONS.map((section) => [section.id, section.title]),
);

const formatRelative = (value: string | null) => {
  if (!value) return 'Sin actividad';
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: es });
};

const formatDue = (createdAt: string) => {
  const dueAt = new Date(createdAt);
  dueAt.setDate(dueAt.getDate() + 14);
  return dueAt;
};

const getTrafficLight = (
  completed: boolean,
  overdue: boolean,
  latestExamBySection: Map<string, AgentGuideRow['examScores'][number]>,
) => {
  if (completed) return 'green' as const;
  if (overdue) return 'red' as const;
  const hasFailedExam = [...latestExamBySection.values()].some((exam) => !exam.passed);
  if (hasFailedExam) return 'red' as const;
  return 'yellow' as const;
};

const trafficLightMeta = {
  green: {
    label: 'Verde',
    summary: 'Guía completa',
    badgeClass: 'rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15',
    cardClass: 'border-emerald-500/30 bg-emerald-500/5',
    textClass: 'text-emerald-700',
  },
  yellow: {
    label: 'Amarillo',
    summary: 'En curso',
    badgeClass: 'rounded-full bg-amber-500/15 text-amber-700 hover:bg-amber-500/15',
    cardClass: 'border-amber-500/30 bg-amber-500/5',
    textClass: 'text-amber-700',
  },
  red: {
    label: 'Rojo',
    summary: 'Intervención',
    badgeClass: 'rounded-full bg-red-500/15 text-red-700 hover:bg-red-500/15',
    cardClass: 'border-red-500/30 bg-red-500/5',
    textClass: 'text-red-700',
  },
} as const;

const AdminAdvisorGuideProgress = () => {
  const [rows, setRows] = useState<AgentGuideRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuideProgress = async () => {
      setLoading(true);

      const rolesRes = await supabase.from('user_roles').select('user_id').eq('role', 'agent');
      const agentIds = (rolesRes.data || []).map((item) => item.user_id).filter(Boolean);

      if (!agentIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [profilesRes, auditRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, created_at').in('user_id', agentIds),
        supabase
          .from('audit_log')
          .select('user_id, action, created_at, record_snapshot')
          .eq('table_name', 'advisor_guide')
          .in('user_id', agentIds)
          .order('created_at', { ascending: false }),
      ]);

      const profiles = (profilesRes.data || []) as AgentProfileRow[];
      const events = (auditRes.data || []) as GuideEventRow[];
      const eventsByUser = new Map<string, GuideEventRow[]>();

      events.forEach((event) => {
        if (!event.user_id) return;
        const bucket = eventsByUser.get(event.user_id) || [];
        bucket.push(event);
        eventsByUser.set(event.user_id, bucket);
      });

      const nextRows = profiles.map((profile) => {
        const userEvents = eventsByUser.get(profile.user_id) || [];
        const approvedChapterIds = new Set<string>();
        const reviewedChapterIds = new Set<string>();
        const latestExamBySection = new Map<string, AgentGuideRow['examScores'][number]>();
        let lastActivityAt: string | null = null;
        let completedAt: string | null = null;
        let reviewedCount = 0;

        userEvents.forEach((event) => {
          const sectionId = event.record_snapshot?.sectionId;
          if (!lastActivityAt || new Date(event.created_at) > new Date(lastActivityAt)) {
            lastActivityAt = event.created_at;
          }

          if (event.action === 'advisor_guide_section_completed' && sectionId) {
            approvedChapterIds.add(sectionId);
            if (!completedAt || new Date(event.created_at) > new Date(completedAt)) {
              completedAt = event.created_at;
            }
          }

          if (event.action === 'advisor_guide_section_reread' && sectionId) {
            reviewedChapterIds.add(sectionId);
            reviewedCount += 1;
          }

          if ((event.action === 'advisor_guide_exam_passed' || event.action === 'advisor_guide_exam_failed') && sectionId) {
            const score = typeof event.record_snapshot?.score === 'number' ? event.record_snapshot.score : 0;
            const previous = latestExamBySection.get(sectionId);
            if (!previous || new Date(event.created_at) > new Date(previous.attemptedAt)) {
              latestExamBySection.set(sectionId, {
                sectionId,
                score,
                passed: event.action === 'advisor_guide_exam_passed',
                attemptedAt: event.created_at,
              });
            }
          }
        });

        const dueAt = formatDue(profile.created_at);
        const completed = approvedChapterIds.size >= ADVISOR_GUIDE_TOTAL;
        const overdue = !completed && dueAt.getTime() < Date.now();
        const trafficLight = getTrafficLight(completed, overdue, latestExamBySection);

        return {
          userId: profile.user_id,
          fullName: profile.full_name,
          email: profile.email,
          createdAt: profile.created_at,
          dueAt,
          approvedCount: approvedChapterIds.size,
          completionRatio: Math.round((approvedChapterIds.size / ADVISOR_GUIDE_TOTAL) * 100),
          reviewedCount,
          reviewedChapterIds: [...reviewedChapterIds].sort(
            (a, b) => (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === a)?.order || 0) - (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === b)?.order || 0),
          ),
          approvedChapterIds: [...approvedChapterIds].sort(
            (a, b) => (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === a)?.order || 0) - (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === b)?.order || 0),
          ),
          lastActivityAt,
          overdue,
          completed,
          completedAt,
          trafficLight,
          examScores: [...latestExamBySection.values()].sort(
            (a, b) => (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === a.sectionId)?.order || 0) - (ADVISOR_GUIDE_SECTIONS.find((section) => section.id === b.sectionId)?.order || 0),
          ),
        };
      });

      nextRows.sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.completionRatio !== b.completionRatio) return a.completionRatio - b.completionRatio;
        return a.fullName.localeCompare(b.fullName, 'es');
      });

      setRows(nextRows);
      setLoading(false);
    };

    void fetchGuideProgress();
  }, []);

  const summary = useMemo(() => {
    const completed = rows.filter((row) => row.completed).length;
    const overdue = rows.filter((row) => row.overdue).length;
    const inProgress = rows.filter((row) => !row.completed && row.approvedCount > 0).length;
    const untouched = rows.filter((row) => row.approvedCount === 0 && !row.lastActivityAt).length;
    const green = rows.filter((row) => row.trafficLight === 'green').length;
    const yellow = rows.filter((row) => row.trafficLight === 'yellow').length;
    const red = rows.filter((row) => row.trafficLight === 'red').length;

    return { completed, overdue, inProgress, untouched, green, yellow, red };
  }, [rows]);

  if (loading) {
    return (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 text-sm text-muted-foreground">Cargando seguimiento de la guía...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Formación asesores
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Aquí ves si cada agente está cumpliendo la guía, qué capítulos domina, qué repasa y quién va fuera de plazo.
            </p>
          </div>
          <Badge variant="destructive" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
            2 semanas máximo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Verde</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.green}</p>
            <p className="mt-1 text-xs text-emerald-700/80">Guía completa y cerrada.</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Amarillo</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{summary.yellow}</p>
            <p className="mt-1 text-xs text-amber-700/80">En curso dentro de plazo.</p>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-red-700">Rojo</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{summary.red}</p>
            <p className="mt-1 text-xs text-red-700/80">Fuera de plazo o suspendiendo.</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Completados</p>
            <p className="mt-2 text-2xl font-bold">{summary.completed}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ya acabaron la guía entera.</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">En curso</p>
            <p className="mt-2 text-2xl font-bold">{summary.inProgress}</p>
            <p className="mt-1 text-xs text-muted-foreground">Han arrancado, pero aún no han terminado.</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fuera de plazo</p>
            <p className="mt-2 text-2xl font-bold">{summary.overdue}</p>
            <p className="mt-1 text-xs text-muted-foreground">Casos ya vencidos.</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sin arrancar</p>
            <p className="mt-2 text-2xl font-bold">{summary.untouched}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ni progreso ni actividad registrada.</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            No hay agentes o todavía no existe actividad de guía registrada.
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {rows.map((row) => {
              const deadlineLabel = format(row.dueAt, 'dd MMM yyyy', { locale: es });
              const lastScore = row.examScores[row.examScores.length - 1];
              const daysToDeadline = Math.ceil((row.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const traffic = trafficLightMeta[row.trafficLight];

              return (
                <AccordionItem
                  key={row.userId}
                  value={row.userId}
                  className={`rounded-[24px] border px-5 ${traffic.cardClass}`}
                >
                  <AccordionTrigger className="py-5 hover:no-underline">
                    <div className="grid w-full gap-4 text-left lg:grid-cols-[minmax(0,1.2fr)_220px_220px]">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{row.fullName}</p>
                          <Badge className={traffic.badgeClass}>{traffic.label}</Badge>
                          <Badge variant="outline" className="rounded-full">{traffic.summary}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{row.email || 'Sin email'}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            Última actividad {formatRelative(row.lastActivityAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BookOpenCheck className="h-3.5 w-3.5" />
                            {row.approvedCount} de {ADVISOR_GUIDE_TOTAL} aprobados
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <RefreshCcw className="h-3.5 w-3.5" />
                            {row.reviewedCount} relecturas
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progreso</span>
                          <span>{row.completionRatio}%</span>
                        </div>
                        <Progress value={row.completionRatio} />
                        <p className="text-xs text-muted-foreground">
                          {row.completed
                            ? `Completada ${row.completedAt ? formatRelative(row.completedAt) : ''}`.trim()
                            : row.overdue
                              ? `Debía estar lista el ${deadlineLabel}`
                              : `Vence el ${deadlineLabel}${daysToDeadline >= 0 ? ` · quedan ${daysToDeadline} día${daysToDeadline === 1 ? '' : 's'}` : ''}`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Último examen</p>
                        {lastScore ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge className={lastScore.passed ? 'rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15' : 'rounded-full bg-red-500/15 text-red-700 hover:bg-red-500/15'}>
                                {lastScore.score}/10
                              </Badge>
                              <span className="text-sm font-medium">
                                {chapterLabelById.get(lastScore.sectionId)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {lastScore.passed ? 'Aprobado' : `Suspendido · mínimo ${ADVISOR_GUIDE_PASS_SCORE}/10`}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Todavía sin exámenes corregidos.</p>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-5">
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lectura ejecutiva</p>
                          <div className="mt-3 space-y-2 text-sm">
                            <p>
                              {row.overdue
                                ? 'Va fuera de plazo y toca intervenir.'
                                : row.completed
                                  ? 'Onboarding formativo cerrado.'
                                  : row.trafficLight === 'red'
                                    ? 'Sigue dentro de plazo, pero ya está suspendiendo y toca corregir.'
                                    : 'Sigue dentro del plazo, pero aún no ha terminado.'}
                            </p>
                            <p className="text-muted-foreground">
                              {row.reviewedChapterIds.length
                                ? `Está repasando ${row.reviewedChapterIds.length} capítulo${row.reviewedChapterIds.length === 1 ? '' : 's'}, lo cual ayuda a ver dónde necesita reforzarse.`
                                : 'Todavía no hay capítulos revisitados registrados.'}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Capítulos revisados</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.reviewedChapterIds.length ? row.reviewedChapterIds.map((sectionId) => (
                              <Badge key={sectionId} variant="outline" className="rounded-full">
                                <Eye className="mr-1 h-3 w-3" />
                                {chapterLabelById.get(sectionId)}
                              </Badge>
                            )) : <span className="text-sm text-muted-foreground">Sin relecturas aún.</span>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Capítulos aprobados</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.approvedChapterIds.length ? row.approvedChapterIds.map((sectionId) => (
                              <Badge key={sectionId} className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                {chapterLabelById.get(sectionId)}
                              </Badge>
                            )) : <span className="text-sm text-muted-foreground">Todavía no ha aprobado capítulos.</span>}
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notas por capítulo</p>
                          <ScrollArea className="mt-3 w-full whitespace-nowrap">
                            <div className="flex gap-2 pb-2">
                              {ADVISOR_GUIDE_SECTIONS.map((section) => {
                                const exam = row.examScores.find((item) => item.sectionId === section.id);
                                const approved = row.approvedChapterIds.includes(section.id);

                                return (
                                  <div
                                    key={section.id}
                                    className="min-w-[150px] rounded-2xl border p-3"
                                    title={chapterTitleById.get(section.id)}
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      {section.chapterLabel ?? `Cap. ${section.order}`}
                                    </p>
                                    <p className="mt-2 text-sm font-medium leading-5">{section.title}</p>
                                    <div className="mt-3 flex items-center gap-2">
                                      {exam ? (
                                        <Badge className={exam.passed ? 'rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15' : 'rounded-full bg-red-500/15 text-red-700 hover:bg-red-500/15'}>
                                          {exam.score}/10
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="rounded-full">Sin nota</Badge>
                                      )}
                                      {approved ? (
                                        <Badge variant="outline" className="rounded-full">Aprobado</Badge>
                                      ) : row.overdue ? (
                                        <Badge variant="destructive" className="rounded-full">Pendiente</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="rounded-full">Pendiente</Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </div>

                        {row.overdue ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700">
                            <div className="flex items-center gap-2 font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              Va fuera de plazo
                            </div>
                            <p className="mt-2">
                              La guía debía estar terminada el {deadlineLabel}. Ahora mismo lleva {row.approvedCount} de {ADVISOR_GUIDE_TOTAL} capítulos aprobados.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAdvisorGuideProgress;
