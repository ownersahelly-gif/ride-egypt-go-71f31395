
-- Driver schedules: which days/times a driver will operate a route
CREATE TABLE public.driver_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  shuttle_id UUID NOT NULL REFERENCES public.shuttles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  departure_time TIME WITHOUT TIME ZONE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, route_id, day_of_week, departure_time)
);

ALTER TABLE public.driver_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own schedules" ON public.driver_schedules FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can create their own schedules" ON public.driver_schedules FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update their own schedules" ON public.driver_schedules FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can delete their own schedules" ON public.driver_schedules FOR DELETE USING (auth.uid() = driver_id);
CREATE POLICY "Anyone can view active schedules" ON public.driver_schedules FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage all schedules" ON public.driver_schedules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Ride instances: concrete rides on specific dates
CREATE TABLE public.ride_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.driver_schedules(id) ON DELETE SET NULL,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  shuttle_id UUID NOT NULL REFERENCES public.shuttles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  ride_date DATE NOT NULL,
  departure_time TIME WITHOUT TIME ZONE NOT NULL,
  available_seats INTEGER NOT NULL DEFAULT 14,
  total_seats INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shuttle_id, ride_date, departure_time)
);

ALTER TABLE public.ride_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ride instances" ON public.ride_instances FOR SELECT USING (true);
CREATE POLICY "Drivers can update their own rides" ON public.ride_instances FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can insert their own rides" ON public.ride_instances FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Admins can manage all rides" ON public.ride_instances FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_driver_schedules_updated_at BEFORE UPDATE ON public.driver_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ride_instances_updated_at BEFORE UPDATE ON public.ride_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
