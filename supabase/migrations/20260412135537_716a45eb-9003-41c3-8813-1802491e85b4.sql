
-- Replace the promote_waitlist_on_cancel function to also call the push-notification edge function
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

      -- Send push notification via edge function
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'notification_type', 'waitlist_promoted',
          'record', jsonb_build_object(
            'id', next_waitlist.id,
            'user_id', next_waitlist.user_id,
            'route_id', next_waitlist.route_id
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
