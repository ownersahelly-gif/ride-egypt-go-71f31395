
DROP TRIGGER IF EXISTS on_driver_application_approved ON public.driver_applications;
DROP TRIGGER IF EXISTS on_new_driver_application ON public.driver_applications;

CREATE OR REPLACE FUNCTION public.notify_driver_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'notification_type', 'driver_approved',
        'record', jsonb_build_object('user_id', NEW.user_id)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_driver_application_approved
  AFTER UPDATE ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_on_approval();

CREATE OR REPLACE FUNCTION public.notify_admins_on_driver_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'notification_type', 'new_driver_application',
      'record', jsonb_build_object('user_id', NEW.user_id)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_driver_application
  AFTER INSERT ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_driver_application();
