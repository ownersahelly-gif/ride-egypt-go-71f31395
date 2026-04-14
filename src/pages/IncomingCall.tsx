import { useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const IncomingCall = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tripId = searchParams.get('tripId') || '';
  const caller = searchParams.get('caller') || 'Unknown';

  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const handleAccept = useCallback(async () => {
    try {
      setCallState('connected');

      const uid = Math.floor(Math.random() * 100000);
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: { channelName: `call_${tripId}`, uid },
      });

      if (error || !data?.token) {
        console.error('Failed to get Agora token:', error);
        setCallState('ended');
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

      // Subscribe to remote users
      client.on('user-published', async (user: any, mediaType: "audio" | "video" | "datachannel") => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accepting call:', err);
      setCallState('ended');
    }
  }, [tripId]);

  const handleDecline = useCallback(async () => {
    setCallState('ended');
    if (localTrackRef.current) {
      localTrackRef.current.close();
    }
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    navigate(-1);
  }, [navigate]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999] safe-area-top safe-area-bottom">
      {/* Caller info */}
      <div className="flex flex-col items-center gap-4 mb-16">
        <div className="w-24 h-24 rounded-full bg-muted/20 flex items-center justify-center">
          <Phone className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold">{caller}</h1>
        <p className="text-white/60 text-sm">
          {callState === 'ringing' && 'Incoming call...'}
          {callState === 'connected' && formatDuration(duration)}
          {callState === 'ended' && 'Call ended'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-12">
        {callState === 'ringing' && (
          <>
            <Button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
              size="icon"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </Button>
            <Button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
              size="icon"
            >
              <Phone className="w-7 h-7 text-white" />
            </Button>
          </>
        )}
        {callState === 'connected' && (
          <Button
            onClick={handleDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
            size="icon"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </Button>
        )}
        {callState === 'ended' && (
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="text-white border-white/30"
          >
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
};

export default IncomingCall;
