
-- Saved pickup/dropoff locations per user per route
CREATE TABLE public.saved_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_name text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_name text,
  label text,
  use_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved locations" ON public.saved_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own saved locations" ON public.saved_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved locations" ON public.saved_locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved locations" ON public.saved_locations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_locations_updated_at BEFORE UPDATE ON public.saved_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ride bundle definitions
CREATE TABLE public.ride_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  bundle_type text NOT NULL DEFAULT 'weekly',
  ride_count integer NOT NULL DEFAULT 10,
  price numeric NOT NULL DEFAULT 0,
  discount_percentage integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ride_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bundles" ON public.ride_bundles FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage bundles" ON public.ride_bundles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ride_bundles_updated_at BEFORE UPDATE ON public.ride_bundles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bundle purchases by users
CREATE TABLE public.bundle_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bundle_id uuid REFERENCES public.ride_bundles(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  rides_remaining integer NOT NULL DEFAULT 0,
  rides_total integer NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payment_proof_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bundle purchases" ON public.bundle_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bundle purchases" ON public.bundle_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bundle purchases" ON public.bundle_purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all bundle purchases" ON public.bundle_purchases FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bundle_purchases_updated_at BEFORE UPDATE ON public.bundle_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
