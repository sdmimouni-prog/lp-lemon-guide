import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHmac, timingSafeEqual} from 'node:crypto';

const root = new URL('./', import.meta.url);
const roles = new Set(['Direction générale','Direction marketing','Communication','Digital et social media','Entrepreneur / Fondateur','Autre']);
export function validateLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('invalid');
  const result = {};
  for (const [key,max] of [['fullName',120],['email',254],['company',160],['role',80]]) {
    if (typeof body[key] !== 'string') throw Error('invalid');
    result[key] = body[key].trim();
    if (!result[key] || result[key].length > max || /[\r\n\x00-\x1f]/.test(result[key])) throw Error('invalid');
  }
  result.email=result.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || !roles.has(result.role)) throw Error('invalid');
  if (typeof body.newsletter !== 'boolean' || body.publicConsent !== true || body.website) throw Error('invalid');
  if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw Error('invalid');
  return {...result, newsletter:body.newsletter,publicConsent:true,requestId:body.requestId,source:'guide-influence-maroc-2026'};
}
export function createDownloadToken(secret, now=Date.now()) {
  const expiry=String(Math.floor(now/1000)+3600);
  return `${expiry}.${createHmac('sha256',secret).update(expiry).digest('hex')}`;
}
export function validDownloadToken(token,secret,now=Date.now()) {
  if(!secret || !/^\d+\.[a-f0-9]{64}$/.test(token||''))return false;
  const [expiry,sig]=token.split('.');
  const expected=createHmac('sha256',secret).update(expiry).digest();
  return Number(expiry)>now/1000 && timingSafeEqual(Buffer.from(sig,'hex'),expected);
}
export function createRequestHandler(config=process.env, fetcher=fetch) {
  const rates=new Map();
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  return async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='POST' && url.pathname==='/api/leads') {
        if (!config.APPS_SCRIPT_URL || !config.LEMON_WEBHOOK_SECRET || !config.DOWNLOAD_SECRET) return json(res,503,{ok:false,message:'La connexion du formulaire est en cours de configuration. Merci de réessayer plus tard.'});
        if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return json(res,403,{ok:false});
        if(!String(req.headers['content-type']).startsWith('application/json'))return json(res,415,{ok:false});
        const ip=config.VERCEL ? String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
        const now=Date.now();
        for(const [key,value] of rates)if(now-value.start>60000)rates.delete(key);
        const rate=rates.get(ip)||{start:now,count:0};rates.set(ip,rate);
        if(++rate.count>10)return json(res,429,{ok:false,message:'Trop de tentatives. Réessayez dans une minute.'});
        let raw=req.body === undefined ? '' : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
        if(req.body === undefined)for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return json(res,413,{ok:false});}
        if(Buffer.byteLength(raw)>8192)return json(res,413,{ok:false});
        let lead;
        try{lead=validateLead(JSON.parse(raw));}catch{return json(res,400,{ok:false,message:'Vérifiez les champs obligatoires et votre accord au partage.'});}
        const upstream=await fetcher(config.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...lead,secret:config.LEMON_WEBHOOK_SECRET}),signal:AbortSignal.timeout(25000),redirect:'follow'});
        let saved;
        try {saved=await upstream.json();} catch {return json(res,502,{ok:false,message:'La connexion Google ne répond pas correctement. Merci de réessayer plus tard.'});}
        if(!upstream.ok || saved.ok!==true || saved.requestId!==lead.requestId) return json(res,502,{ok:false,message:'L’enregistrement n’a pas été confirmé. Réessayez : votre demande ne sera pas enregistrée deux fois.'});
        const token=createDownloadToken(config.DOWNLOAD_SECRET);
        return json(res,200,{ok:true,downloadUrl:`/download/guide.pdf?token=${token}`});
      }
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{ok:false});
      const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/form.js':['form.js','text/javascript; charset=utf-8']};
      let file=files[url.pathname];
      if(url.pathname==='/download/guide.pdf'){
        if(!validDownloadToken(url.searchParams.get('token'),config.DOWNLOAD_SECRET))return json(res,403,{ok:false,message:'Remplissez le formulaire pour télécharger le guide.'});
        if(config.PUBLIC_GUIDE_URL){res.writeHead(302,{'Location':config.PUBLIC_GUIDE_URL,'Cache-Control':'no-store'});return res.end();}
        file=['private/guide-influence-lemon-mind-2026.pdf','application/pdf'];
        res.setHeader('Content-Disposition','attachment; filename="Guide-strategique-influence-Lemon-Mind-2026.pdf"');
      }
      if(!file)return json(res,404,{ok:false});
      const path=new URL(file[0],root);const info=await stat(path);
      res.writeHead(200,{'Content-Type':file[1],'Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);
    }catch(error){console.error('Request failed:',error.name);if(!res.headersSent)json(res,502,{ok:false,message:'Le service est momentanément indisponible. Merci de réessayer.'});else res.end();}
  };
}
export function createServer(config=process.env, fetcher=fetch) {return http.createServer(createRequestHandler(config,fetcher));}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT||8097),process.env.HOST||'127.0.0.1',()=>console.log(`Lemon Mind: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8097}`));
