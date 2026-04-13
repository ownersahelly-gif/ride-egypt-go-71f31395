
CREATE TABLE public.published_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  departure_time TIME WITHOUT TIME ZONE NOT NULL,
  trip_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.published_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage published trips"
  ON public.published_trips FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active published trips"
  ON public.published_trips FOR SELECT
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_published_trips_date ON public.published_trips (trip_date, status);

CREATE TRIGGER update_published_trips_updated_at
  BEFORE UPDATE ON public.published_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
