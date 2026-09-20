import {createRequestHandler} from '../server.mjs';
const handler=createRequestHandler({...process.env,PUBLIC_GUIDE_URL:'/assets/guide-influence-lemon-mind-2026.pdf'});
export default function download(req,res) {
  const query=new URL(req.url,'https://localhost').search;
  req.url='/download/guide.pdf'+query;
  return handler(req,res);
}
