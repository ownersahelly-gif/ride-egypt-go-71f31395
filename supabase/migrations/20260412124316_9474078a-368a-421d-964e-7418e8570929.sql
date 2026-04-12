
-- Package templates (Starter, Standard, Pro, etc.)
CREATE TABLE public.package_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  ride_count INTEGER, -- NULL = unlimited
  factor NUMERIC NOT NULL DEFAULT 1.0,
  validity_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.package_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage package templates"
  ON public.package_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active package templates"
  ON public.package_templates FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_package_templates_updated_at
  BEFORE UPDATE ON public.package_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Route-specific factor overrides per package
CREATE TABLE public.route_package_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  package_template_id UUID NOT NULL REFERENCES public.package_templates(id) ON DELETE CASCADE,
  factor_override NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, package_template_id)
);

ALTER TABLE public.route_package_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage route overrides"
  ON public.route_package_overrides FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view route overrides"
  ON public.route_package_overrides FOR SELECT
  USING (true);

CREATE TRIGGER update_route_package_overrides_updated_at
  BEFORE UPDATE ON public.route_package_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Time-based pricing rules
CREATE TABLE public.time_based_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL DEFAULT 'Time Rule',
  name_ar TEXT NOT NULL DEFAULT 'قاعدة وقتية',
  day_of_week INTEGER[], -- NULL = all days, array of 0-6
  start_time TIME,
  end_time TIME,
  factor NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_based_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time rules"
  ON public.time_based_pricing_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active time rules"
  ON public.time_based_pricing_rules FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_time_based_pricing_rules_updated_at
  BEFORE UPDATE ON public.time_based_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert global default factor into app_settings
INSERT INTO public.app_settings (key, value)
VALUES ('global_default_factor', '1.0')
ON CONFLICT DO NOTHING;
