import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_CALL_DURATION = 90; // 1.5 minutes max

interface VoiceCallProps {
  tripId: string;
  userId: string;
}

const VoiceCall = ({ tripId, userId }: VoiceCallProps) => {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    if (localTrackRef.current) {
      localTrackRef.current.close();
      localTrackRef.current = null;
    }
    if (clientRef.current) {
      try { await clientRef.current.leave(); } catch {}
      clientRef.current = null;
    }
    setInCall(false);
    setDuration(0);
  }, []);

  useEffect(() => {
    if (inCall && duration >= MAX_CALL_DURATION) {
      endCall();
    }
  }, [duration, inCall, endCall]);

  const startCall = useCallback(async () => {
    try {
      setConnecting(true);

      const { data: authData } = await supabase.auth.getUser();
      let callerName = 'Driver';

      if (authData.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (profile?.full_name?.trim()) {
          callerName = profile.full_name.trim();
        }
      }

      const { data: pushData, error: pushError } = await supabase.functions.invoke('initiate-call', {
        body: {
          recipientUserId: userId,
          driverName: callerName,
          tripId,
        },
      });

      if (pushError || pushData?.success === false) {
        const errMsg = pushData?.error || pushError?.message || 'Failed to notify recipient';
        toast.error(
          errMsg.includes('No device token')
            ? 'Recipient must open the native app and allow notifications first'
            : errMsg
        );
        return;
      }

      const uid = Math.floor(Math.random() * 100000);
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: { channelName: `call_${tripId}`, uid },
      });

      if (error || !data?.token) {
        console.error('Failed to get Agora token:', error);
        toast.error('Failed to start call');
        return;
      }

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      const appId = data.appId || import.meta.env.VITE_AGORA_APP_ID;
      await client.join(appId, `call_${tripId}`, data.token, uid);

      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localAudioTrack;
      await client.publish([localAudioTrack]);

      client.on('user-published', async (user: any, mediaType: 'audio' | 'video' | 'datachannel') => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setInCall(true);
    } catch (err) {
      console.error('Error starting call:', err);
      toast.error('Error starting call');
    } finally {
      setConnecting(false);
    }
  }, [tripId, userId]);

  if (inCall) {
    return (
      <Button
        onClick={endCall}
        size="icon"
        className="rounded-full bg-destructive hover:bg-destructive/90 w-10 h-10"
        title="End Call"
      >
        <PhoneOff className="w-5 h-5 text-white" />
      </Button>
    );
  }

  return (
    <Button
      onClick={startCall}
      variant="outline"
      size="icon"
      className="rounded-full w-10 h-10"
      disabled={connecting}
      title="Call"
    >
      <Phone className="w-5 h-5" />
    </Button>
  );
};

export default VoiceCall;
