import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
function fixture(){
  const rows=[Array(10).fill('header')];const mail=[];let failMail=false;
  const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),getParent:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/test/edit'}),getRange:(r,c,h=1,w=1)=>({
    getValues:()=>rows.slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w)),
    setValue:value=>{rows[r-1][c-1]=value;},
    createTextFinder:text=>({matchEntireCell:()=>({findNext:()=>{const i=rows.findIndex((row,index)=>index>=r-1 && row[c-1]===text);return i>=0?{getRow:()=>i+1}:null;}})})
  })};
  const cache=new Map();const lock={waitLock(){},tryLock:()=>true,hasLock:()=>true,releaseLock(){}};
  const context=vm.createContext({console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret'})},
    LockService:{getScriptLock:()=>lock},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>s,base64EncodeWebSafe:s=>s,formatDate:d=>d.toISOString()},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:data=>{if(failMail)throw Error('offline');mail.push(data);}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}
  });vm.runInContext(source,context);
  return{context,rows,mail,fail:()=>{failMail=true;},recover:()=>{failMail=false;}};
}
const lead={secret:'secret',requestId:'d7a8e2ca-1518-4de0-9d9b-5df72a49e3f1',fullName:'=FORMULA()',email:'test@example.com',company:'Test',role:'Autre',newsletter:false,source:'guide-influence-maroc-2026'};
const post=(f,data=lead)=>f.context.doPost({postData:{contents:JSON.stringify(data)}});
test('script authenticates webhook and records one lead for repeated request IDs',()=>{
  const f=fixture();assert.equal(post(f,{...lead,secret:'wrong'}).ok,false);assert.equal(f.rows.length,1);
  assert.equal(post(f).ok,true);assert.equal(post(f).ok,true);assert.equal(f.rows.length,2);assert.equal(f.mail.length,1);
  assert.equal(f.rows[1][6],'Non recueilli — case retirée');
  assert.equal(f.rows[1][1],"'=FORMULA()");
  assert.equal(f.mail[0].to,'sd.mimouni@richmedia.ma,a.amazouz@richmedia.ma,t.elabbadi@richmedia.ma');
});
test('mail failures keep the lead and the scheduled retry delivers it',()=>{
  const f=fixture();f.fail();assert.equal(post(f).ok,true);assert.equal(f.rows.length,2);assert.equal(f.rows[1][9],'À réessayer');assert.equal(f.mail.length,0);
  f.recover();f.context.retryNotifications();assert.equal(f.mail.length,1);assert.equal(f.rows[1][9],'Envoyée');
  f.context.retryNotifications();assert.equal(f.mail.length,1);
});
