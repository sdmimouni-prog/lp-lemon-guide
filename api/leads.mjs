import {createRequestHandler} from '../server.mjs';
const handler=createRequestHandler();
export default function leads(req,res) {
  req.url='/api/leads';
  return handler(req,res);
}
