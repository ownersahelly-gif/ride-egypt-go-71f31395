

# Overhaul Ride Flow: Stop-Based Navigation, Driver Start, Live Tracking, Payment Visibility

This is a significant rework of the ActiveRide (driver) and TrackShuttle (passenger) pages to use **predefined route stops** instead of per-passenger custom locations, plus adding proper ride start mechanics, Google Maps navigation with only booked stops, arrival timers using global wait time, boarding code verification with payment info, and ETA visibility rules.

---

## What Changes

### 1. Hide ETA before ride starts (TrackShuttle)
- The "Estimated arrival to you" banner currently shows even before the ride starts. It should be **hidden** until the driver actually starts the ride (shuttle status becomes active / GPS starts broadcasting).

### 2. Driver "Start Ride" mechanics (ActiveRide)
- Driver can start a ride **up to 2 hours before** the scheduled departure time (currently the link just goes to `/active-ride` with no time gate).
- When started: shuttle status → `active`, GPS broadcasting begins, clients see live location.

### 3. Refactor ActiveRide to use predefined route stops (not per-passenger custom locations)
- Currently `ActiveRide` builds `OrderedStop[]` from each booking's custom pickup/dropoff coordinates. This needs to change to use the **route's predefined stops** from the `stops` table.
- Fetch stops for the route, then group bookings by their `pickup_stop_id` and `dropoff_stop_id`.
- **Only include stops that have at least one booking** — skip empty stops entirely.
- Order stops by `stop_order` from the database.

### 4. Google Maps navigation link with only booked stops
- When driver starts the ride, generate a Google Maps directions URL that includes **only stops with bookings** as waypoints (origin → booked stops in order → destination).
- Provide a prominent "Navigate Full Trip" button at the top that opens this multi-waypoint Google Maps link.
- Individual per-stop navigation links remain for the current stop card.

### 5. "I Arrived" button + Global Wait Timer
- When driver reaches a stop (or manually clicks "I Arrived"), start a countdown timer using the **global stop waiting time** from `app_settings` (`stop_waiting_time_minutes`) instead of the hardcoded 60 seconds.
- Fetch this setting on mount in ActiveRide.
- The "I Arrived" button triggers notification to passengers at that stop.

### 6. Boarding code verification with payment info
- When verifying a boarding code at a stop, show **all passengers booked for that stop** (not just one).
- For each passenger, after code verification:
  - If `payment_proof_url` exists (InstaPay paid): show **"0 EGP needed"** or "Paid via InstaPay ✓"
  - If no payment proof (cash): show the **total_price** the passenger must pay in cash.

### 7. TrackShuttle: Show live location + working ETA only after ride starts
- Keep the current "Ride hasn't started yet" placeholder when no GPS.
- Once driver starts (GPS broadcasting), show the map with live shuttle + route through booked stops.
- ETA calculation should use the route stops (not custom locations) and only count stops before the user's pickup stop.

---

## Technical Details

### Files Modified

**`src/pages/ActiveRide.tsx`** (major rewrite):
- Fetch route stops from `stops` table, filter to only stops with bookings
- Group bookings by `pickup_stop_id` / `dropoff_stop_id`
- Replace `OrderedStop` interface to be stop-centric (each stop has an array of passengers)
- Build Google Maps multi-waypoint URL: `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=lat,lng|lat,lng|...`
- Fetch `stop_waiting_time_minutes` from `app_settings` on mount, use it for the wait timer instead of hardcoded 60s
- At each pickup stop: show list of passengers for that stop, each with boarding code input
- After verifying code: check `payment_proof_url` on booking — if present show "Paid ✓ (0 EGP)", if not show "Cash: {total_price} EGP"
- Add "Start Ride" time gate: only allow if current time is within 2 hours before scheduled departure

**`src/pages/TrackShuttle.tsx`**:
- Hide ETA banner when ride hasn't started yet (when `!hasLiveGps`)
- Refactor stop-based tracking to use predefined route stops instead of per-passenger custom locations
- Fetch route stops, determine user's pickup/dropoff stop, calculate ETA based on route stops

**`src/pages/DriverDashboard.tsx`**:
- Add time gate check for "Start Ride" button: only show if within 2 hours of departure
- Pass route/schedule info to ActiveRide via URL params or state

### Data Flow
- Bookings already have `pickup_stop_id` and `dropoff_stop_id` columns
- Route stops come from `stops` table with `stop_order`
- Global wait time from `app_settings` key `stop_waiting_time_minutes`
- Payment detection: `booking.payment_proof_url` exists = InstaPay paid

### No database changes needed
All required columns and tables already exist.

