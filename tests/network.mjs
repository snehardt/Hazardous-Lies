import assert from 'node:assert/strict';
import {loadPeerOptions} from '../dist/network.js';
import worker from '../relay/worker.mjs';

const servers=[{urls:'stun:stun.cloudflare.com:3478'},{urls:['turn:turn.cloudflare.com:3478?transport=udp','turns:turn.cloudflare.com:443?transport=tcp'],username:'temporary-user',credential:'temporary-password'}];
const options={host:'localhost',config:{iceTransportPolicy:'relay',iceServers:[]}};
assert.equal(await loadPeerOptions(options),options);
const result=await loadPeerOptions(options,'https://relay.example',async()=>Response.json({iceServers:servers}));
assert.equal(result.host,'localhost');assert.equal(result.config.iceTransportPolicy,'relay');assert.deepEqual(result.config.iceServers,servers);
for(const response of [()=>new Response(null,{status:503}),()=>Response.json({iceServers:[servers[0]]}),()=>Response.json({iceServers:[{urls:'turn:example.com'}]})]) {
  await assert.rejects(loadPeerOptions(undefined,'https://relay.example',async()=>response()),/Could not load the multiplayer relay/);
}
await assert.rejects(loadPeerOptions(undefined,'https://relay.example',async()=>{throw new Error('offline');}),/Could not load/);

const request=(method='GET',origin='https://snehardt.github.io')=>new Request('https://relay.example',{method,headers:{Origin:origin}});
assert.equal((await worker.fetch(request('GET','https://other.example'),{})).status,403);
assert.equal((await worker.fetch(request('OPTIONS'),{})).status,204);
assert.equal((await worker.fetch(request('POST'),{})).status,405);
assert.equal((await worker.fetch(request(),{})).status,503);
const originalFetch=globalThis.fetch;
const env={TURN_KEY_ID:'private-key-id',TURN_KEY_API_TOKEN:'private-api-token'};
try {
  globalThis.fetch=async(url,init)=>{
    assert.match(url,/private-key-id\/credentials\/generate-ice-servers$/);
    assert.equal(init.headers.Authorization,'Bearer private-api-token');
    assert.equal(JSON.parse(init.body).ttl,14400);
    return Response.json({iceServers:servers,extra:'omit this'});
  };
  const response=await worker.fetch(request(),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://snehardt.github.io');
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),{iceServers:servers});
  globalThis.fetch=async()=>new Response('private upstream error',{status:401});
  const failed=await worker.fetch(request(),env);assert.equal(failed.status,502);assert.doesNotMatch(await failed.text(),/private upstream/);
}finally{globalThis.fetch=originalFetch;}
console.log('Relay tests passed: credential loading, preserved options, malformed/offline rejection, origin checks, secrets, temporary credentials, upstream failure.');
