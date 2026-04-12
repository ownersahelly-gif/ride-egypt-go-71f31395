
-- Function to auto-promote waitlisted bookings when a booking is cancelled
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_waitlist RECORD;
BEGIN
  -- Only trigger when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    -- Find the next waitlisted booking for the same route, date, and time
    SELECT * INTO next_waitlist
    FROM public.bookings
    WHERE route_id = NEW.route_id
      AND scheduled_date = NEW.scheduled_date
      AND scheduled_time = NEW.scheduled_time
      AND status = 'waitlist'
    ORDER BY waitlist_position ASC
    LIMIT 1;

    IF FOUND THEN
      -- Promote from waitlist to confirmed
      UPDATE public.bookings
      SET status = 'confirmed', waitlist_position = NULL, updated_at = now()
      WHERE id = next_waitlist.id;

      -- Restore the seat on the ride instance
      -- (The cancelled booking freed a seat, the promoted one takes it)
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on bookings table
CREATE TRIGGER promote_waitlist_after_cancel
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_on_cancel();
