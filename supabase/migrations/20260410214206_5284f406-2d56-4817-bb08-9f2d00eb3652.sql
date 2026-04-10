
-- Delete all data from tables, preserving the admin user (8cae77ab-3d55-4a69-b316-90ec593d2a81)

-- First delete dependent tables (no FK constraints but keeping order clean)
DELETE FROM public.ride_messages;
DELETE FROM public.ratings;
DELETE FROM public.carpool_messages;
DELETE FROM public.carpool_requests;
DELETE FROM public.bundle_purchases;
DELETE FROM public.bookings;
DELETE FROM public.ride_instances;
DELETE FROM public.driver_schedules;
DELETE FROM public.shuttle_schedules;
DELETE FROM public.stops;
DELETE FROM public.saved_locations;
DELETE FROM public.ride_bundles;
DELETE FROM public.route_requests;
DELETE FROM public.carpool_routes;
DELETE FROM public.carpool_verifications;
DELETE FROM public.driver_applications;
DELETE FROM public.shuttles;
DELETE FROM public.routes;

-- Delete all user roles except admin's
DELETE FROM public.user_roles WHERE user_id != '8cae77ab-3d55-4a69-b316-90ec593d2a81';

-- Delete all profiles except admin's
DELETE FROM public.profiles WHERE user_id != '8cae77ab-3d55-4a69-b316-90ec593d2a81';

-- Delete all non-admin users from auth
DELETE FROM auth.users WHERE id != '8cae77ab-3d55-4a69-b316-90ec593d2a81';
