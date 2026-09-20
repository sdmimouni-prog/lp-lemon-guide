import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer,createRequestHandler,validateLead,createDownloadToken,validDownloadToken} from '../server.mjs';
const lead=()=>({fullName:'Test technique',email:'test@example.com',company:'Test',role:'Autre',newsletter:false,publicConsent:true,requestId:randomUUID(),website:''});
test('Vercel parsed request bodies reach Google and return JSON',async()=>{
  const data=lead();let output;let status;
  const handler=createRequestHandler({APPS_SCRIPT_URL:'https://test.invalid',LEMON_WEBHOOK_SECRET:'secret',DOWNLOAD_SECRET:'download'},async(_,opts)=>{
    assert.equal(JSON.parse(opts.body).requestId,data.requestId);
    return new Response(JSON.stringify({ok:true,requestId:data.requestId}));
  });
  await handler({method:'POST',url:'/api/leads',body:data,headers:{'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}},{writeHead(code){status=code;},end(body){output=JSON.parse(body);}});
  assert.equal(status,200);assert.equal(output.ok,true);assert.match(output.downloadUrl,/^\/download\/guide.pdf\?token=/);
});
test('Vercel download route validates the token before redirecting to the static PDF',async()=>{
  let status;let headers;
  const handler=createRequestHandler({DOWNLOAD_SECRET:'secret',PUBLIC_GUIDE_URL:'/assets/guide.pdf'});
  const res={writeHead(code,value){status=code;headers=value;},end(){}};
  await handler({method:'GET',url:'/download/guide.pdf?token=invalid'},res);assert.equal(status,403);
  await handler({method:'GET',url:'/download/guide.pdf?token='+createDownloadToken('secret')},res);assert.equal(status,302);assert.equal(headers.Location,'/assets/guide.pdf');
});
test('validation refuses invalid emails, missing consent, bots and overlong data',()=>{
  for(const mutation of [{email:'invalid'},{publicConsent:false},{website:'spam'},{company:'x'.repeat(161)},{role:'unknown'}])assert.throws(()=>validateLead({...lead(),...mutation}));
  assert.equal(validateLead({...lead(),fullName:' Test '}).fullName,'Test');
});
test('download signatures reject expiry, tampering and missing secret',()=>{
  const t=createDownloadToken('secret',100000);
  assert.equal(validDownloadToken(t,'secret',100000),true);
  assert.equal(validDownloadToken(t,'wrong',100000),false);
  assert.equal(validDownloadToken(t,'secret',4000000),false);
  assert.equal(validDownloadToken(t+'0','secret',100000),false);
  assert.equal(validDownloadToken(t,''),false);
});
test('only confirmed sheet writes unlock the original PDF; private files are not exposed',async()=>{
  let ok=false;let received;
  const config={APPS_SCRIPT_URL:'https://example.test/exec',LEMON_WEBHOOK_SECRET:'private',DOWNLOAD_SECRET:'downloads'};
  const server=createServer(config,async(url,opts)=>{received=JSON.parse(opts.body);return new Response(JSON.stringify({ok,requestId:received.requestId}),{status:200});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const send=data=>fetch(base+'/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal((await send(lead())).status,502);
    assert.equal((await fetch(base+'/download/guide.pdf')).status,403);
    for(const path of ['/.env','/server.mjs','/private/guide-influence-lemon-mind-2026.pdf','/google-apps-script/Code.gs'])assert.equal((await fetch(base+path)).status,404);
    ok=true;
    const data=lead();const response=await send(data);assert.equal(response.status,200);
    const result=await response.json();assert.equal(received.secret,'private');assert.equal(received.requestId,data.requestId);
    const pdf=await fetch(base+result.downloadUrl,{method:'HEAD'});
    assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(pdf.headers.get('content-length'),'27270483');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('unconfigured service fails explicitly rather than pretending to save leads',async()=>{
  const server=createServer({});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/leads`,{method:'POST'});assert.equal(response.status,503);assert.equal((await response.json()).ok,false);}finally{await new Promise(resolve=>server.close(resolve));}
});
