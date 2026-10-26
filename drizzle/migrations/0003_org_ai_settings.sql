-- Per-organization bring-your-own-key AI provider settings.
-- API keys are readable only by org admins via RLS; the assistant pipeline
-- reads them server-side with the service role after verifying membership.
CREATE TABLE public.org_ai_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openrouter', 'openai', 'groq', 'anthropic', 'gemini')),
  api_key text NOT NULL,
  fast_model text,
  answer_model text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_ai_settings TO authenticated;
GRANT ALL ON public.org_ai_settings TO service_role;

ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can read AI settings"
  ON public.org_ai_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Org admins can insert AI settings"
  ON public.org_ai_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Org admins can update AI settings"
  ON public.org_ai_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Org admins can delete AI settings"
  ON public.org_ai_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));