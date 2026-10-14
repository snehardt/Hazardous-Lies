import type { PeerOptions } from 'peerjs';

// Fetch temporary relay credentials before PeerJS starts either game channel.
export async function loadPeerOptions(options?:PeerOptions,endpoint?:string,fetcher:typeof fetch=fetch):Promise<PeerOptions|undefined> {
  if(!endpoint)return options;
  try {
    const response=await fetcher(endpoint,{signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!response.ok)throw new Error(`Relay service returned ${response.status}`);
    const data=await response.json();
    const servers=data.iceServers;
    if(!Array.isArray(servers) || !servers.length || servers.length>16)throw new Error('Invalid relay configuration');
    let hasRelay=false;
    for(const server of servers) {
      const urls=typeof server?.urls==='string'?[server.urls]:server?.urls;
      if(!Array.isArray(urls) || !urls.length || urls.some(url=>typeof url!=='string' || !/^(stun|stuns|turn|turns):/.test(url)))throw new Error('Invalid relay addresses');
      if(urls.some(url=>/^turns?:/.test(url))) {
        if(typeof server.username!=='string' || !server.username || typeof server.credential!=='string' || !server.credential)throw new Error('Missing relay credentials');
        hasRelay=true;
      }
    }
    if(!hasRelay)throw new Error('No TURN relay supplied');
    return {...options,config:{...options?.config,iceServers:servers}};
  }catch {
    throw new Error('Could not load the multiplayer relay. Click Retry Connection. If this repeats, the game owner needs to check the relay service configuration.');
  }
}
