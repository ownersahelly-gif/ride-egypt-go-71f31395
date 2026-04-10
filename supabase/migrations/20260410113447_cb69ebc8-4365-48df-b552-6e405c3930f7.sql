
-- Clean all transactional data (order matters for foreign key constraints)
DELETE FROM public.ratings;
DELETE FROM public.ride_messages;
DELETE FROM public.bookings;
DELETE FROM public.ride_instances;
DELETE FROM public.route_requests;
