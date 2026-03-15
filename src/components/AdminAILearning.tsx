import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Brain, BookOpen, GitBranch, Activity, Plus, Trash2, Zap, RefreshCw } from "lucide-react";

const AI_FUNCTIONS = ["ai-chat", "ai-description", "ai-search", "ai-summary", "ai-scoring", "ai-reengagement", "portal-lead-inbound"];
const KB_CATEGORIES = ["legal", "pricing", "zones", "process", "faq", "market", "portals", "commissions"];

export default function AdminAILearning() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("knowledge");

  // ── Knowledge Base ───────────────────────────────────────────────────────
  const { data: kbEntries = [], isLoading: kbLoading } = useQuery({
    queryKey: ["ai-knowledge-base"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_knowledge_base")
        .select("*")
        .order("priority", { ascending: false });
      return data || [];
    },
  });

  // ── Memories ─────────────────────────────────────────────────────────────
  const { data: memories = [], isLoading: memLoading } = useQuery({
    queryKey: ["ai-memory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_memory")
        .select("*")
        .order("usage_count", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // ── Prompt Versions ──────────────────────────────────────────────────────
  const { data: promptVersions = [], isLoading: pvLoading } = useQuery({
    queryKey: ["ai-prompt-versions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_prompt_versions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["ai-interactions-stats"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, count } = await supabase
        .from("ai_interactions")
        .select("function_name, duration_ms, quality_score", { count: "exact" })
        .gte("created_at", weekAgo);

      const byFunction: Record<string, { count: number; avgDuration: number }> = {};
      for (const row of data || []) {
        const fn = row.function_name;
        if (!byFunction[fn]) byFunction[fn] = { count: 0, avgDuration: 0 };
        byFunction[fn].count++;
        byFunction[fn].avgDuration += row.duration_ms || 0;
      }
      for (const fn of Object.keys(byFunction)) {
        byFunction[fn].avgDuration = Math.round(byFunction[fn].avgDuration / byFunction[fn].count);
      }
      return { total: count || 0, byFunction };
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const addKBEntry = useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await supabase.from("ai_knowledge_base").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
      toast({ title: "Entrada añadida a la base de conocimiento" });
    },
  });

  const deleteKBEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] }),
  });

  const toggleMemory = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ai_memory").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-memory"] }),
  });

  const activatePrompt = useMutation({
    mutationFn: async ({ id, functionName }: { id: string; functionName: string }) => {
      // Deactivate all prompts for this function first
      await supabase.from("ai_prompt_versions").update({ is_active: false }).eq("function_name", functionName);
      const { error } = await supabase.from("ai_prompt_versions").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-prompt-versions"] });
      toast({ title: "Prompt activado" });
    },
  });

  const runImprovement = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-improve-prompts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-prompt-versions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-memory"] });
      toast({ title: "Análisis completado", description: `Funciones analizadas: ${Object.keys(data?.results || {}).length}` });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Interacciones IA (7d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{memories.filter((m: any) => m.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Memorias activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{kbEntries.filter((k: any) => k.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Entradas KB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{promptVersions.filter((p: any) => p.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Prompts activos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => runImprovement.mutate()} disabled={runImprovement.isPending} variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          {runImprovement.isPending ? "Analizando..." : "Ejecutar auto-mejora"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="knowledge" className="gap-2"><BookOpen className="h-4 w-4" />Base de conocimiento</TabsTrigger>
          <TabsTrigger value="memories" className="gap-2"><Brain className="h-4 w-4" />Memorias</TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2"><GitBranch className="h-4 w-4" />Versiones prompts</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2"><Activity className="h-4 w-4" />Actividad</TabsTrigger>
        </TabsList>

        {/* ── Knowledge Base ─────────────────────────────────────────────── */}
        <TabsContent value="knowledge" className="space-y-4">
          <KBEntryDialog onSave={(entry: any) => addKBEntry.mutate(entry)} />

          {kbLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {kbEntries.map((entry: any) => (
                <Card key={entry.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{entry.title}</CardTitle>
                        <CardDescription className="flex gap-2 mt-1">
                          <Badge variant="outline">{entry.category}</Badge>
                          <Badge variant="secondary">P{entry.priority}</Badge>
                          {(entry.applies_to || []).map((fn: string) => (
                            <Badge key={fn} variant="outline" className="text-xs">{fn}</Badge>
                          ))}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteKBEntry.mutate(entry.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content.substring(0, 300)}{entry.content.length > 300 ? "..." : ""}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Memories ───────────────────────────────────────────────────── */}
        <TabsContent value="memories" className="space-y-4">
          {memLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {memories.map((mem: any) => (
                <Card key={mem.id} className={!mem.is_active ? "opacity-50" : ""}>
                  <CardContent className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{mem.category}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">{mem.context_key}</span>
                        <Badge variant="secondary" className="text-xs">
                          {mem.usage_count}× · ⭐{Number(mem.relevance_score).toFixed(1)}
                        </Badge>
                      </div>
                      <p className="text-sm truncate">{mem.content}</p>
                      <p className="text-xs text-muted-foreground">{mem.source_function} · {new Date(mem.created_at).toLocaleDateString("es-ES")}</p>
                    </div>
                    <Switch checked={mem.is_active} onCheckedChange={(v) => toggleMemory.mutate({ id: mem.id, is_active: v })} />
                  </CardContent>
                </Card>
              ))}
              {memories.length === 0 && <p className="text-muted-foreground text-center py-8">Aún no hay memorias. Se crearán automáticamente con el uso de la IA.</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Prompt Versions ────────────────────────────────────────────── */}
        <TabsContent value="prompts" className="space-y-4">
          {pvLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {promptVersions.map((pv: any) => (
                <Card key={pv.id} className={pv.is_active ? "border-primary" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {pv.function_name} v{pv.version}
                          {pv.is_active && <Badge className="bg-primary text-primary-foreground">Activo</Badge>}
                        </CardTitle>
                        <CardDescription>{pv.change_reason || "Sin descripción"}</CardDescription>
                      </div>
                      {!pv.is_active && (
                        <Button size="sm" variant="outline" onClick={() => activatePrompt.mutate({ id: pv.id, functionName: pv.function_name })}>
                          Activar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {pv.system_prompt.substring(0, 500)}{pv.system_prompt.length > 500 ? "..." : ""}
                    </p>
                    {pv.performance_notes && (
                      <p className="text-xs text-muted-foreground mt-2">📊 {pv.performance_notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(pv.created_at).toLocaleString("es-ES")}</p>
                  </CardContent>
                </Card>
              ))}
              {promptVersions.length === 0 && <p className="text-muted-foreground text-center py-8">Sin versiones de prompts. Ejecuta la auto-mejora para generar la primera.</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4">
          {stats?.byFunction && Object.keys(stats.byFunction).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(stats.byFunction).map(([fn, data]: [string, any]) => (
                <Card key={fn}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{fn}</p>
                        <p className="text-sm text-muted-foreground">{data.count} llamadas · {data.avgDuration}ms avg</p>
                      </div>
                      <Badge variant="outline">{data.count}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Sin actividad IA esta semana.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Dialog to add KB entry ─────────────────────────────────────────────────
function KBEntryDialog({ onSave }: { onSave: (entry: any) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("faq");
  const [priority, setPriority] = useState("5");
  const [appliesTo, setAppliesTo] = useState<string[]>(["ai-chat"]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      category,
      priority: parseInt(priority),
      applies_to: appliesTo,
      is_active: true,
    });
    setTitle("");
    setContent("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />Añadir conocimiento</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva entrada de conocimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Plazos legales de arras en CV" />
          </div>
          <div>
            <Label>Contenido</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Escribe la regla, dato o conocimiento..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad (1-10)</Label>
              <Input type="number" min={1} max={10} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Aplica a funciones</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {AI_FUNCTIONS.map((fn) => (
                <Badge
                  key={fn}
                  variant={appliesTo.includes(fn) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setAppliesTo((prev) => prev.includes(fn) ? prev.filter((f) => f !== fn) : [...prev, fn])}
                >
                  {fn}
                </Badge>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={!title.trim() || !content.trim()} className="w-full">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
