import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Subscribes to realtime booking status changes for the current user
 * and shows toast notifications.
 */
export const useBookingNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`booking-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any).status;

          if (newStatus === oldStatus) return;

          switch (newStatus) {
            case 'confirmed':
              toast.success('Booking Confirmed! 🎉', {
                description: 'Your driver has confirmed your ride. Get ready!',
              });
              break;
            case 'boarded':
              toast.info('Welcome Aboard! 🚐', {
                description: 'You have been marked as boarded. Enjoy your ride!',
              });
              break;
            case 'completed':
              toast.success('Ride Completed! ✅', {
                description: 'You have arrived at your destination. Thanks for riding with Massar!',
              });
              break;
            case 'cancelled':
              toast.error('Booking Cancelled', {
                description: 'Your booking has been cancelled.',
              });
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};

/**
 * For drivers: subscribes to new bookings on their shuttle
 */
export const useDriverBookingNotifications = (shuttleId: string | null) => {
  useEffect(() => {
    if (!shuttleId) return;

    const channel = supabase
      .channel(`driver-notifications-${shuttleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `shuttle_id=eq.${shuttleId}`,
        },
        () => {
          toast.info('New Booking! 📋', {
            description: 'A new passenger has booked a ride on your shuttle.',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shuttleId]);
};
