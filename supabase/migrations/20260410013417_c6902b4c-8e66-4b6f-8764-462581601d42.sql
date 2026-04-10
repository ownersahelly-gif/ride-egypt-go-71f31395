
-- Fix bookings with off-route locations
-- Route corridor: Madinaty (30.107, 31.639) → along Ring Road → Smart Village (30.071, 31.017)
-- Lat should stay ~30.06-30.11

-- Fix Fifth Settlement - AUC (was lat 30.008, too far south)
UPDATE bookings SET custom_pickup_lat = 30.075, custom_pickup_lng = 31.44, custom_pickup_name = 'El Rehab - Gate 3'
WHERE id = '200b5e11-eefd-465b-bbf6-6210f029d92c';

-- Fix New Cairo - Waterway (was lat 30.030, too far south)  
UPDATE bookings SET custom_pickup_lat = 30.065, custom_pickup_lng = 31.40, custom_pickup_name = 'New Cairo - Ninety Street'
WHERE id = 'c254b89a-487a-4e1b-8e46-0e3b08bef9de';

-- Fix Nasr City - City Stars (lat was ok but let's tighten)
UPDATE bookings SET custom_pickup_lat = 30.073, custom_pickup_lng = 31.345, custom_pickup_name = 'Nasr City - City Stars'
WHERE id = '51ab44f3-f476-4451-832a-9a61ee92a52c';

-- Fix Heliopolis (adjust to be on-route)
UPDATE bookings SET custom_pickup_lat = 30.088, custom_pickup_lng = 31.310, custom_pickup_name = 'Heliopolis - Ard El Golf'
WHERE id = '33b0dd14-c44d-422f-9e5b-24ddb0730d4c';

-- Fix Rehab City pickup to be closer to route
UPDATE bookings SET custom_pickup_lat = 30.085, custom_pickup_lng = 31.53, custom_pickup_name = 'El Shorouk - Main Gate'
WHERE id = '80438f92-34cf-439e-a779-79bea64b7305';

-- Fix dropoff points to be along the route too
UPDATE bookings SET custom_dropoff_lat = 30.075, custom_dropoff_lng = 31.18, custom_dropoff_name = 'Ring Road - Autostrad'
WHERE id = 'c254b89a-487a-4e1b-8e46-0e3b08bef9de';

UPDATE bookings SET custom_dropoff_lat = 30.072, custom_dropoff_lng = 31.12, custom_dropoff_name = 'Mohandessin - Sphinx Square'
WHERE id = '80438f92-34cf-439e-a779-79bea64b7305';
