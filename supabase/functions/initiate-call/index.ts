import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { riderFcmToken, recipientUserId, driverName, callerName, tripId } = await req.json()
    const resolvedCallerName = (driverName || callerName || '').trim()
    let resolvedToken = (riderFcmToken || '').trim()

    if ((!resolvedToken && !recipientUserId) || !resolvedCallerName || !tripId) {
      return new Response(
        JSON.stringify({ error: 'recipientUserId or riderFcmToken, caller name, and tripId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!resolvedToken && recipientUserId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Supabase server credentials not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const { data: tokenRow, error: tokenError } = await supabase
        .from('device_tokens')
        .select('token')
        .eq('user_id', recipientUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (tokenError) {
        console.error('Failed to fetch recipient token:', tokenError)
      }

      resolvedToken = tokenRow?.token?.trim() || ''

      if (!resolvedToken) {
        return new Response(
          JSON.stringify({ error: 'No device token found for recipient user' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: 'FCM credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceAccount = JSON.parse(serviceAccountJson)

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const encode = (obj: unknown) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const unsignedToken = `${encode(header)}.${encode(payload)}`

    const pemKey = serviceAccount.private_key
    const pemContents = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '')
    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    )

    const signedJwt = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
    })

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('Failed to get access token:', tokenData)
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with FCM' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const projectId = serviceAccount.project_id
    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: resolvedToken,
            notification: {
              title: resolvedCallerName,
              body: 'Incoming call',
            },
            data: {
              type: 'incoming_call',
              tripId,
              caller: resolvedCallerName,
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'default',
              },
            },
            apns: {
              headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
              },
              payload: {
                aps: {
                  sound: 'default',
                  'content-available': 1,
                },
              },
            },
          },
        }),
      }
    )

    const fcmResult = await fcmRes.json()
    console.log('FCM response:', JSON.stringify(fcmResult))

    if (!fcmRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification', result: fcmResult }),
        { status: fcmRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, result: fcmResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error initiating call:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to initiate call' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
