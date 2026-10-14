// Deploy as a Cloudflare Worker. Both secret values stay on the Worker.
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    const allowedOrigin=env.ALLOWED_ORIGIN || 'https://snehardt.github.io';
    if(origin!==allowedOrigin)return new Response('Origin not allowed',{status:403});
    const headers={
      'Access-Control-Allow-Origin':allowedOrigin,
      'Access-Control-Allow-Methods':'GET, OPTIONS',
      'Vary':'Origin',
      'Cache-Control':'no-store',
      'Content-Type':'application/json',
    };
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='GET')return new Response(JSON.stringify({error:'Use GET'}),{status:405,headers});
    if(!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN)return new Response(JSON.stringify({error:'Relay secrets are not configured'}),{status:503,headers});
    try {
      const upstream=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,{
        method:'POST',
        headers:{Authorization:`Bearer ${env.TURN_KEY_API_TOKEN}`,'Content-Type':'application/json'},
        body:JSON.stringify({ttl:14400}),
        signal:AbortSignal.timeout(8000),
      });
      if(!upstream.ok)return new Response(JSON.stringify({error:'Relay provider rejected credential request'}),{status:502,headers});
      const data=await upstream.json();
      if(!Array.isArray(data.iceServers))throw new Error('Invalid relay response');
      // Return only temporary browser credentials, never the long-lived API token.
      return new Response(JSON.stringify({iceServers:data.iceServers}),{headers});
    }catch {
      return new Response(JSON.stringify({error:'Relay provider unavailable'}),{status:502,headers});
    }
  },
};
