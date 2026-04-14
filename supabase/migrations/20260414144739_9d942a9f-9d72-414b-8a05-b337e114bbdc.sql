CREATE TABLE public.combined_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_link TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.combined_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage combined routes"
ON public.combined_routes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_combined_routes_updated_at
BEFORE UPDATE ON public.combined_routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();