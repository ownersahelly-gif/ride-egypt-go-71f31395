import { useRef, useCallback, useEffect, useState } from 'react';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Smoothly interpolates a map marker between GPS coordinate updates.
 * Uses velocity tracking to prevent backward jitter — the marker
 * always moves forward along the direction of travel.
 */
export const useSmoothMarker = (animationDurationMs = 1500) => {
  const [displayPosition, setDisplayPosition] = useState<LatLng | null>(null);
  const displayRef = useRef<LatLng | null>(null);
  const targetRef = useRef<LatLng | null>(null);
  const startRef = useRef<LatLng | null>(null);
  const animStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // Velocity estimation for direction-aware smoothing
  const velocityRef = useRef<LatLng>({ lat: 0, lng: 0 });
  const lastUpdateRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (!startRef.current || !targetRef.current) return;

    const elapsed = time - animStartRef.current;
    const progress = Math.min(elapsed / animationDurationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    const pos = {
      lat: startRef.current.lat + (targetRef.current.lat - startRef.current.lat) * eased,
      lng: startRef.current.lng + (targetRef.current.lng - startRef.current.lng) * eased,
    };

    displayRef.current = pos;
    setDisplayPosition(pos);

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animationDurationMs]);

  const updatePosition = useCallback((newPos: LatLng) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const now = performance.now();

    // First position — snap immediately
    if (!targetRef.current) {
      displayRef.current = newPos;
      setDisplayPosition(newPos);
      startRef.current = newPos;
      targetRef.current = newPos;
      lastUpdateRef.current = now;
      return;
    }

    // Update velocity estimate (exponential moving average)
    const dt = (now - lastUpdateRef.current) / 1000;
    if (dt > 0.1 && dt < 15) {
      const vLat = (newPos.lat - targetRef.current.lat) / dt;
      const vLng = (newPos.lng - targetRef.current.lng) / dt;
      velocityRef.current = {
        lat: velocityRef.current.lat * 0.5 + vLat * 0.5,
        lng: velocityRef.current.lng * 0.5 + vLng * 0.5,
      };
    }

    // Movement vector from current target to new position
    const moveLat = newPos.lat - targetRef.current.lat;
    const moveLng = newPos.lng - targetRef.current.lng;

    const vMag = Math.sqrt(velocityRef.current.lat ** 2 + velocityRef.current.lng ** 2);

    let finalTarget = newPos;

    // If we have a meaningful velocity, check for backward movement
    if (vMag > 0.0000005) {
      const unitV = {
        lat: velocityRef.current.lat / vMag,
        lng: velocityRef.current.lng / vMag,
      };

      // Project movement onto velocity direction
      const forwardComponent = moveLat * unitV.lat + moveLng * unitV.lng;

      if (forwardComponent < 0) {
        // Backward movement detected — predict forward instead
        const predictT = Math.min(dt || 1, 3) * 0.4;
        finalTarget = {
          lat: targetRef.current.lat + velocityRef.current.lat * predictT,
          lng: targetRef.current.lng + velocityRef.current.lng * predictT,
        };
      } else {
        // Forward movement — use GPS position but remove lateral noise
        const lateralLat = moveLat - unitV.lat * forwardComponent;
        const lateralLng = moveLng - unitV.lng * forwardComponent;
        // Keep 70% of lateral movement (reduce sideways jitter)
        finalTarget = {
          lat: targetRef.current.lat + unitV.lat * forwardComponent + lateralLat * 0.7,
          lng: targetRef.current.lng + unitV.lng * forwardComponent + lateralLng * 0.7,
        };
      }
    }

    startRef.current = displayRef.current || targetRef.current;
    targetRef.current = finalTarget;
    lastUpdateRef.current = now;
    animStartRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { position: displayPosition, updatePosition };
};
