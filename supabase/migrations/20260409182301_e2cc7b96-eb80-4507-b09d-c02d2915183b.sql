
-- Insert admin role for aliehabg12@gmail.com
-- We need to look up the user_id from auth.users by email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'aliehabg12@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
