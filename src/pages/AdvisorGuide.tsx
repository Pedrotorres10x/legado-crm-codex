import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Lock, Shield, BookOpen, Sparkles, ArrowRight, Target, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { ADVISOR_GUIDE_PASS_SCORE, ADVISOR_GUIDE_SECTIONS, ADVISOR_GUIDE_TOTAL, getAdvisorGuideExamQuestions } from '@/content/advisor-guide';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import Rule42210Card from '@/components/performance/Rule42210Card';

const AdvisorGuide = () => {
  const { user } = useAuth();
  const progressStorageKey = `advisor-guide-progress:${user?.id || 'guest'}`;
  const answersStorageKey = `advisor-guide-answers:v2:${user?.id || 'guest'}`;
  const readyStorageKey = `advisor-guide-ready:v2:${user?.id || 'guest'}`;
  const opensStorageKey = `advisor-guide-opens:v1:${user?.id || 'guest'}`;
  const [expandedSection, setExpandedSection] = useState<string>(ADVISOR_GUIDE_SECTIONS[0]?.id || '');
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [examReadySections, setExamReadySections] = useState<string[]>([]);
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const rawProgress = window.localStorage.getItem(progressStorageKey);
    const rawAnswers = window.localStorage.getItem(answersStorageKey);
    const rawReady = window.localStorage.getItem(readyStorageKey);
    const rawOpens = window.localStorage.getItem(opensStorageKey);

    if (rawProgress) {
      try {
        const parsed = JSON.parse(rawProgress);
        if (Array.isArray(parsed)) {
          setCompletedSections(parsed);
        }
      } catch {
        // ignore invalid local state
      }
    }

    if (rawAnswers) {
      try {
        const parsed = JSON.parse(rawAnswers);
        if (parsed && typeof parsed === 'object') {
          setAnswers(parsed);
        }
      } catch {
        // ignore invalid local state
      }
    }

    if (rawReady) {
      try {
        const parsed = JSON.parse(rawReady);
        if (Array.isArray(parsed)) {
          setExamReadySections(parsed);
        }
      } catch {
        // ignore invalid local state
      }
    }

    if (rawOpens) {
      try {
        const parsed = JSON.parse(rawOpens);
        if (parsed && typeof parsed === 'object') {
          setOpenCounts(parsed);
        }
      } catch {
        // ignore invalid local state
      }
    }
  }, [answersStorageKey, opensStorageKey, progressStorageKey, readyStorageKey]);

  const completionRatio = useMemo(
    () => Math.round((completedSections.length / ADVISOR_GUIDE_TOTAL) * 100),
    [completedSections.length],
  );

  const firstPendingOrder = useMemo(() => {
    const firstPending = ADVISOR_GUIDE_SECTIONS.find((section) => !completedSections.includes(section.id));
    return firstPending?.order ?? ADVISOR_GUIDE_TOTAL;
  }, [completedSections]);

  const onboardingDeadline = useMemo(() => {
    if (!user?.created_at) return null;
    const createdAt = new Date(user.created_at);
    const due = new Date(createdAt);
    due.setDate(due.getDate() + 14);
    const diff = due.getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return { due, days };
  }, [user?.created_at]);

  const handleSelectAnswer = (sectionId: string, questionId: string, answerId: string) => {
    setAnswers((current) => {
      const next = {
        ...current,
        [sectionId]: {
          ...(current[sectionId] || {}),
          [questionId]: answerId,
        },
      };
      window.localStorage.setItem(answersStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const unlockExam = (sectionId: string) => {
    setExamReadySections((current) => {
      if (current.includes(sectionId)) return current;
      const next = [...current, sectionId];
      window.localStorage.setItem(readyStorageKey, JSON.stringify(next));
      const section = ADVISOR_GUIDE_SECTIONS.find((item) => item.id === sectionId);
      if (section) {
        void logGuideEvent('advisor_guide_exam_unlocked', section, {
          event: 'exam_unlocked',
        });
      }
      return next;
    });
  };

  const markSectionCompleted = (sectionId: string) => {
    setCompletedSections((current) => {
      if (current.includes(sectionId)) return current;
      const next = [...current, sectionId];
      window.localStorage.setItem(progressStorageKey, JSON.stringify(next));
      const section = ADVISOR_GUIDE_SECTIONS.find((item) => item.id === sectionId);
      if (section) {
        void logGuideEvent('advisor_guide_section_completed', section, {
          event: 'section_completed',
        });
      }
      return next;
    });
  };

  useEffect(() => {
    const firstUnlocked = ADVISOR_GUIDE_SECTIONS.find((section) => section.order <= firstPendingOrder)?.id;
    if (firstUnlocked && !completedSections.includes(expandedSection) && firstPendingOrder !== 0 && ADVISOR_GUIDE_SECTIONS.find((section) => section.id === expandedSection)?.order! > firstPendingOrder) {
      setExpandedSection(firstUnlocked);
    }
  }, [completedSections, expandedSection, firstPendingOrder]);

  const logGuideEvent = async (
    action: string,
    section: (typeof ADVISOR_GUIDE_SECTIONS)[number],
    snapshot: Record<string, unknown>,
  ) => {
    if (!user?.id) return;

    await supabase.from('audit_log').insert({
      action,
      table_name: 'advisor_guide',
      record_id: `${user.id}:${section.id}`,
      user_id: user.id,
      record_snapshot: {
        sectionId: section.id,
        sectionOrder: section.order,
        chapterLabel: section.chapterLabel ?? null,
        sectionTitle: section.title,
        ...snapshot,
      },
    });
  };

  useEffect(() => {
    const section = ADVISOR_GUIDE_SECTIONS.find((item) => item.id === expandedSection);
    if (!section || !user?.id || section.order > firstPendingOrder) return;

    setOpenCounts((current) => {
      const nextCount = (current[section.id] || 0) + 1;
      const next = { ...current, [section.id]: nextCount };
      window.localStorage.setItem(opensStorageKey, JSON.stringify(next));
      void logGuideEvent(
        nextCount > 1 ? 'advisor_guide_section_reread' : 'advisor_guide_section_opened',
        section,
        {
          event: nextCount > 1 ? 'section_reread' : 'section_opened',
          readCount: nextCount,
          reread: nextCount > 1,
          completed: completedSections.includes(section.id),
        },
      );
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSection, firstPendingOrder, user?.id]);

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(215,176,106,0.28),_transparent_32%),linear-gradient(135deg,_rgba(17,24,39,1)_0%,_rgba(33,47,68,1)_55%,_rgba(56,75,105,1)_100%)] p-6 text-white shadow-[var(--shadow-card)] md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-white/15 text-white backdrop-blur">Formación interna</Badge>
              <Badge className="border-0 bg-white/10 text-white/90 backdrop-blur">Onboarding obligatorio</Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-white/65">Método comercial</p>
              </div>
              <h1 className="max-w-4xl text-3xl font-display font-bold tracking-tight md:text-5xl">
                Guía de asesores para trabajar con método, no por intuición
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/80 md:text-base">
                Aquí aprendes cómo trabajar en Legado desde el primer día: personas primero, captación con confianza, producto bien trabajado, cierre sano y relaciones que traen la siguiente oportunidad.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Qué te llevas</p>
                <p className="mt-2 text-sm font-medium text-white">Claridad para saber qué hacer, cómo captar y cómo pensar el negocio.</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Qué se espera de ti</p>
                <p className="mt-2 text-sm font-medium text-white">Leer, entender y aprobar cada bloque para empezar a producir con criterio.</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Cómo se aprueba</p>
                <p className="mt-2 text-sm font-medium text-white">No basta con entrar: tienes que leer bien y demostrar comprensión real en el examen.</p>
              </div>
            </div>

            <div className="max-w-4xl">
              <Rule42210Card />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Shield className="h-4 w-4 text-primary" />
                Progreso del asesor
              </div>
              <Progress value={completionRatio} className="mt-4 bg-white/10" />
              <p className="mt-4 text-3xl font-bold">{completionRatio}%</p>
              <p className="mt-2 text-sm text-white/75">
                {completedSections.length} de {ADVISOR_GUIDE_TOTAL} capítulos aprobados.
              </p>
              <p className="mt-1 text-xs text-white/55">
                El objetivo es que domines el método, no solo que avances pantalla.
              </p>
            </div>
            <div className="rounded-[28px] border border-red-500/40 bg-red-500/15 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <AlertTriangle className="h-4 w-4 text-red-200" />
                Plazo obligatorio
              </div>
              <p className="mt-3 text-sm leading-6 text-white">
                La guía tiene que estar completada en las primeras dos semanas, como máximo.
              </p>
              {onboardingDeadline && (
                <p className="mt-2 text-xs text-red-100">
                  {completionRatio >= 100
                    ? 'Guía completada dentro del onboarding.'
                    : onboardingDeadline.days >= 0
                      ? `Quedan ${onboardingDeadline.days} día${onboardingDeadline.days === 1 ? '' : 's'} para completar la formación.`
                      : `Plazo vencido hace ${Math.abs(onboardingDeadline.days)} día${Math.abs(onboardingDeadline.days) === 1 ? '' : 's'}.`}
                </p>
              )}
            </div>
            <div className="rounded-[28px] border border-white/12 bg-black/15 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <BookOpen className="h-4 w-4 text-primary" />
                Cómo aprovechar esta guía
              </div>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Léela con calma, interioriza los ejemplos y aprueba cada examen. La idea no es memorizar frases, sino empezar a trabajar con criterio desde el primer día.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit border-0 shadow-[var(--shadow-card)] xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Índice de capítulos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ADVISOR_GUIDE_SECTIONS.map((section) => {
              const isDone = completedSections.includes(section.id);
              const isUnlocked = section.order <= firstPendingOrder;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => isUnlocked && setExpandedSection(section.id)}
                  disabled={!isUnlocked}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all',
                    expandedSection === section.id
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border/60 hover:border-primary/30 hover:bg-muted/30',
                    !isUnlocked && 'cursor-not-allowed opacity-55 hover:border-border/60 hover:bg-transparent',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : !isUnlocked ? <Lock className="h-3.5 w-3.5" /> : section.order}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isUnlocked ? section.objective : 'Se desbloquea cuando apruebes el capítulo anterior.'}
                    </p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {ADVISOR_GUIDE_SECTIONS.map((section) => {
            const chapterAnswers = answers[section.id] || {};
            const isExpanded = expandedSection === section.id;
            const isDone = completedSections.includes(section.id);
            const isUnlocked = section.order <= firstPendingOrder;
            const examQuestions = getAdvisorGuideExamQuestions(section);
            const answeredCount = examQuestions.filter((question) => chapterAnswers[question.id]).length;
            const score = examQuestions.reduce((acc, question) => {
              const selected = chapterAnswers[question.id];
              const selectedOption = question.options.find((option) => option.id === selected);
              return acc + (selectedOption?.correct ? 1 : 0);
            }, 0);
            const hasPassed = score >= ADVISOR_GUIDE_PASS_SCORE;
            const examUnlocked = examReadySections.includes(section.id) || isDone;

            return (
              <Card
                key={section.id}
                className={cn(
                  'overflow-hidden border-0 shadow-[var(--shadow-card)] transition-all',
                  isExpanded ? 'opacity-100 ring-1 ring-primary/15' : 'opacity-55 hover:opacity-75',
                  !isUnlocked && 'pointer-events-none opacity-35',
                )}
              >
                <CardHeader className={cn(
                  'gap-3 border-b',
                  isExpanded ? 'border-primary/10 bg-[linear-gradient(135deg,rgba(215,176,106,0.10),rgba(255,255,255,0))]' : 'border-transparent',
                )}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {section.chapterLabel && <Badge className="border-0 bg-primary/10 text-primary">{section.chapterLabel}</Badge>}
                        {isDone && (
                          <Badge className="bg-emerald-500 text-white border-0">Aprobado</Badge>
                        )}
                        {!isUnlocked && (
                          <Badge variant="destructive">Bloqueado</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl md:text-2xl">{section.title}</CardTitle>
                      <p className="max-w-3xl text-sm text-muted-foreground">{section.objective}</p>
                    </div>
                    {!isExpanded && isUnlocked && (
                      <Button variant="outline" onClick={() => setExpandedSection(section.id)}>
                        Abrir capítulo
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-5">
                    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Regla 4-2-2-10</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        4 toques al día → 2 visitas a la semana → 2 captaciones al mes → 10 ventas al año.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Si mantienes la actividad, el negocio aparece.
                      </p>
                    </div>

                    {section.intro && section.intro.length > 0 && (
                      <div className="rounded-3xl border border-border/60 bg-background p-5">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Introducción</p>
                        <div className="mt-3 space-y-3 text-sm leading-7 text-foreground/90">
                          {section.intro.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_320px]">
                      <div className="space-y-5">
                        <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                            <Target className="h-4 w-4 text-primary" />
                            Por qué importa
                          </div>
                          <p className="mt-3 text-sm leading-7 text-foreground/90">{section.whyItMatters}</p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Qué debes interiorizar</p>
                          <ul className="mt-3 space-y-3 text-sm text-foreground">
                            {section.bullets.map((bullet) => (
                              <li key={bullet} className="flex gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3">
                                <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {section.sections && section.sections.length > 0 && (
                          <div className="space-y-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Desarrollo del capítulo</p>
                            {section.sections.map((contentBlock) => (
                              <div key={contentBlock.title} className="rounded-3xl border border-border/60 bg-background p-5">
                                <h3 className="text-lg font-semibold">{contentBlock.title}</h3>
                                {contentBlock.paragraphs && contentBlock.paragraphs.length > 0 && (
                                  <div className="mt-3 space-y-3 text-sm leading-7 text-foreground/90">
                                    {contentBlock.paragraphs.map((paragraph) => (
                                      <p key={paragraph}>{paragraph}</p>
                                    ))}
                                  </div>
                                )}
                                {contentBlock.bullets && contentBlock.bullets.length > 0 && (
                                  <ul className="mt-4 space-y-2 text-sm text-foreground">
                                    {contentBlock.bullets.map((bullet) => (
                                      <li key={bullet} className="flex gap-3">
                                        <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                                        <span>{bullet}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border border-primary/15 bg-primary/5 p-5">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                            <BrainCircuit className="h-4 w-4 text-primary" />
                            Idea clave
                          </div>
                          <p className="mt-3 text-base font-medium leading-7 text-foreground">
                            {section.successNote}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
                          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Error típico</p>
                          <p className="mt-3 text-sm leading-6">{section.mistake}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {!examUnlocked && (
                      <div className="rounded-3xl border border-amber-300/50 bg-amber-50 p-5">
                        <p className="text-sm font-semibold text-amber-900">Paso obligatorio antes del examen</p>
                        <p className="mt-2 text-sm text-amber-800">
                          Cuando llegues al final del capítulo, abre el examen. El siguiente bloque solo se desbloquea si apruebas este.
                        </p>
                        <Button className="mt-4" onClick={() => unlockExam(section.id)}>
                          <Sparkles className="mr-2 h-4 w-4" />
                          He leído el capítulo completo, abrir examen
                        </Button>
                      </div>
                    )}

                    {examUnlocked && (
                      <div className="space-y-5">
                        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Examen obligatorio</p>
                              <p className="mt-2 text-sm text-foreground">
                                Este capítulo se aprueba con un mínimo de {ADVISOR_GUIDE_PASS_SCORE}/10. El siguiente no se abre hasta que lo apruebes.
                              </p>
                            </div>
                            <Badge variant="destructive">{answeredCount}/10 respondidas</Badge>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {examQuestions.map((question, questionIndex) => {
                            const selectedAnswer = chapterAnswers[question.id];
                            return (
                              <div key={question.id} className="rounded-3xl border border-border/60 bg-background p-5">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pregunta {questionIndex + 1}</p>
                                <p className="mt-2 text-sm font-medium text-foreground">{question.prompt}</p>
                                <div className="mt-3 grid gap-2">
                                  {question.options.map((option) => (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => handleSelectAnswer(section.id, question.id, option.id)}
                                      className={cn(
                                        'rounded-2xl border px-4 py-3 text-left text-sm transition-all',
                                        selectedAnswer === option.id
                                          ? 'border-primary/40 bg-primary/5 shadow-sm'
                                          : 'border-border/60 hover:border-primary/30 hover:bg-muted/30',
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Separator />

                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            onClick={() => {
                              if (answeredCount === 10) {
                                void logGuideEvent(
                                  hasPassed ? 'advisor_guide_exam_passed' : 'advisor_guide_exam_failed',
                                  section,
                                  {
                                    event: hasPassed ? 'exam_passed' : 'exam_failed',
                                    score,
                                    answeredCount,
                                    passScore: ADVISOR_GUIDE_PASS_SCORE,
                                  },
                                );
                              }
                              if (hasPassed) {
                                markSectionCompleted(section.id);
                              }
                            }}
                            disabled={answeredCount < 10 || !hasPassed}
                            className="min-w-[240px]"
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Aprobar examen y abrir siguiente capítulo
                          </Button>
                          {answeredCount < 10 && (
                            <p className="text-xs text-muted-foreground">
                              Tienes que responder las 10 preguntas antes de cerrar el capítulo.
                            </p>
                          )}
                          {answeredCount === 10 && !hasPassed && (
                            <p className="text-xs text-destructive">
                              Llevas {score}/10. Necesitas {ADVISOR_GUIDE_PASS_SCORE}/10 para aprobar. Repasa el capítulo y vuelve a intentarlo.
                            </p>
                          )}
                          {answeredCount === 10 && hasPassed && !isDone && (
                            <p className="text-xs text-emerald-600">
                              Examen aprobado con {score}/10. Ya puedes dar este capítulo por superado.
                            </p>
                          )}
                          {isDone && (
                            <p className="text-xs text-emerald-600">
                              Capítulo aprobado y siguiente capítulo abierto.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdvisorGuide;
