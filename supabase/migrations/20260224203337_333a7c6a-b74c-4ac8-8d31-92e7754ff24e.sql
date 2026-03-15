
-- ═══════════════════════════════════════════════════════════════════════════
-- AI Learning System: Memory, Knowledge Base, Prompt Versions
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. AI Memory: stores learned patterns from AI interactions
CREATE TABLE public.ai_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,                    -- e.g. 'lead_classification', 'description_style', 'matching', 'portal_parsing'
  context_key text NOT NULL,                 -- e.g. 'idealista_lead_format', 'luxury_description_tone'
  content text NOT NULL,                     -- the learned pattern/rule
  source_function text,                      -- which edge function generated this
  source_interaction_id uuid,                -- optional reference to what triggered it
  relevance_score numeric NOT NULL DEFAULT 1.0,  -- higher = more relevant (boosted by usage)
  usage_count integer NOT NULL DEFAULT 0,    -- how many times this memory was used
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid                            -- admin who approved or system
);

CREATE INDEX idx_ai_memory_category ON public.ai_memory (category, is_active);
CREATE INDEX idx_ai_memory_relevance ON public.ai_memory (relevance_score DESC) WHERE is_active = true;

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage ai_memory" ON public.ai_memory FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ai_memory" ON public.ai_memory FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System update ai_memory" ON public.ai_memory FOR UPDATE
  USING (true);

CREATE POLICY "Auth view ai_memory" ON public.ai_memory FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. AI Knowledge Base: manually curated rules and facts
CREATE TABLE public.ai_knowledge_base (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,                    -- e.g. 'legal', 'pricing', 'zones', 'process', 'faq'
  title text NOT NULL,
  content text NOT NULL,                     -- the knowledge entry (markdown supported)
  tags text[] DEFAULT '{}'::text[],
  applies_to text[] DEFAULT '{}'::text[],    -- which AI functions should use this: ['ai-chat', 'ai-description', 'ai-search']
  priority integer NOT NULL DEFAULT 5,       -- 1-10, higher = injected first
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_ai_kb_category ON public.ai_knowledge_base (category, is_active);
CREATE INDEX idx_ai_kb_applies ON public.ai_knowledge_base USING GIN (applies_to);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage ai_knowledge_base" ON public.ai_knowledge_base FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth view ai_knowledge_base" ON public.ai_knowledge_base FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. AI Prompt Versions: tracks system prompt evolution
CREATE TABLE public.ai_prompt_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,               -- e.g. 'ai-chat', 'ai-description', 'ai-search'
  version integer NOT NULL DEFAULT 1,
  system_prompt text NOT NULL,
  change_reason text,                        -- why this version was created
  performance_notes text,                    -- observations about this version
  is_active boolean NOT NULL DEFAULT false,  -- only one active per function
  interactions_count integer NOT NULL DEFAULT 0,
  avg_quality_score numeric,                 -- from feedback if available
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid                            -- 'system' for auto-generated
);

CREATE UNIQUE INDEX idx_ai_prompt_active ON public.ai_prompt_versions (function_name) WHERE is_active = true;
CREATE INDEX idx_ai_prompt_function ON public.ai_prompt_versions (function_name, version DESC);

ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage ai_prompt_versions" ON public.ai_prompt_versions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ai_prompt_versions" ON public.ai_prompt_versions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System update ai_prompt_versions" ON public.ai_prompt_versions FOR UPDATE
  USING (true);

CREATE POLICY "Auth view ai_prompt_versions" ON public.ai_prompt_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. AI Interactions Log: tracks all AI calls for analysis
CREATE TABLE public.ai_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  input_summary text,                        -- brief summary of what was asked
  output_summary text,                       -- brief summary of the response
  prompt_version_id uuid REFERENCES public.ai_prompt_versions(id),
  memory_ids_used uuid[] DEFAULT '{}'::uuid[],
  kb_ids_used uuid[] DEFAULT '{}'::uuid[],
  tokens_used integer,
  duration_ms integer,
  quality_score numeric,                     -- null until rated
  feedback text,                             -- optional agent feedback
  agent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_interactions_function ON public.ai_interactions (function_name, created_at DESC);
CREATE INDEX idx_ai_interactions_quality ON public.ai_interactions (function_name, quality_score) WHERE quality_score IS NOT NULL;

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view ai_interactions" ON public.ai_interactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

CREATE POLICY "Agent view own ai_interactions" ON public.ai_interactions FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "System insert ai_interactions" ON public.ai_interactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System update ai_interactions" ON public.ai_interactions FOR UPDATE
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_ai_memory_updated_at BEFORE UPDATE ON public.ai_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_kb_updated_at BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
