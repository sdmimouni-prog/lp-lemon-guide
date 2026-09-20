const SHEET_ID = '1dgAXwEEa2yrfQBzBR0ZOzk8ulya1C87Lb8YHsZOqA7s';
const RECIPIENTS = ['sd.mimouni@richmedia.ma', 'a.amazouz@richmedia.ma', 't.elabbadi@richmedia.ma'];

function setup() {
  const book = SpreadsheetApp.openById(SHEET_ID);
  book.setSpreadsheetTimeZone('Africa/Casablanca');
  const sheet = book.getSheetByName('Leads');
  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), 10).createFilter();
  sheet.getRange('A2:A1000').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  const file = DriveApp.getFileById(SHEET_ID);
  const folders = DriveApp.getRootFolder().getFoldersByName('ChatGPT');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('ChatGPT');
  file.moveTo(folder);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_SECRET')) props.setProperty('WEBHOOK_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'retryNotifications')) {
    ScriptApp.newTrigger('retryNotifications').timeBased().everyMinutes(5).create();
  }
  console.log('Configuration terminée. Le secret de connexion est disponible dans Paramètres du projet > Propriétés du script.');
}

function doGet() { return json_({ok:true, service:'Lemon Mind leads'}); }
function doPost(e) {
  let lock;
  try {
    if (!e.postData || e.postData.contents.length > 8192) return json_({ok:false});
    const data = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || data.secret !== secret) return json_({ok:false});
    validate_(data);
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Leads');
    const last = sheet.getLastRow();
    const existing = last > 1 ? sheet.getRange(2,9,last-1,1).createTextFinder(data.requestId).matchEntireCell(true).findNext() : null;
    let row;
    if (existing) {
      row = existing.getRow();
    } else {
      const cache = CacheService.getScriptCache();
      const key = 'rate-' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.email.toLowerCase()));
      const count = Number(cache.get(key)||0);
      if(count >= 5)return json_({ok:false});
      cache.put(key,String(count+1),60);
      sheet.appendRow([new Date(),safe_(data.fullName),safe_(data.email.toLowerCase()),safe_(data.company),safe_(data.role),data.newsletter?'Oui':'Non','Oui — tableau accessible par lien',data.source,data.requestId,'À envoyer']);
      SpreadsheetApp.flush();
      row = sheet.getLastRow();
    }
    // The lead is durable before sending mail. A trigger retries delivery failures.
    try { sendNotification_(sheet,row); } catch (err) { sheet.getRange(row,10).setValue('À réessayer'); }
    return json_({ok:true,requestId:data.requestId});
  } catch(err) {
    console.error('Lead processing failed: '+err.name);
    return json_({ok:false});
  } finally { if(lock && lock.hasLock())lock.releaseLock(); }
}
function validate_(d) {
  for(const [name,max] of [['fullName',120],['email',254],['company',160],['role',80]]) {
    if(typeof d[name]!=='string'||!d[name].trim()||d[name].length>max||/[\r\n\x00-\x1f]/.test(d[name]))throw Error('invalid');
    d[name]=d[name].trim();
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)||d.publicConsent!==true||typeof d.newsletter!=='boolean'||! /^[a-f0-9-]{36}$/i.test(d.requestId)||d.source!=='guide-influence-maroc-2026')throw Error('invalid');
  if(!['Direction générale','Direction marketing','Communication','Digital et social media','Entrepreneur / Fondateur','Autre'].includes(d.role))throw Error('invalid');
}
function safe_(value) { return /^[=+\-@]/.test(value) ? "'"+value : value; }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function sendNotification_(sheet,row) {
  const data=sheet.getRange(row,1,1,10).getValues()[0];
  if(data[9]==='Envoyée')return;
  if(MailApp.getRemainingDailyQuota()<3)throw Error('quota');
  MailApp.sendEmail({
    to:RECIPIENTS.join(','),
    subject:'[Lemon Mind] Nouveau lead — Guide influence Maroc',
    name:'Lemon Mind',
    replyTo:String(data[2]).replace(/^'/,''),
    body:'Un visiteur a rempli le formulaire du guide Lemon Mind.\n\n'+
      'Nom : '+data[1]+'\nE-mail : '+data[2]+'\nEntreprise : '+data[3]+'\nFonction : '+data[4]+
      '\nActualités acceptées : '+data[5]+'\nConsentement au partage : '+data[6]+
      '\nDate : '+Utilities.formatDate(new Date(data[0]),'Africa/Casablanca','dd/MM/yyyy HH:mm:ss')+
      '\n\nTableau des leads : '+sheet.getParent().getUrl()+'\nRéférence : '+data[8]
  });
  sheet.getRange(row,10).setValue('Envoyée');
  SpreadsheetApp.flush();
}
function retryNotifications() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return;
  try {
    const sheet=SpreadsheetApp.openById(SHEET_ID).getSheetByName('Leads');
    const last=sheet.getLastRow();
    if(last<2)return;
    const states=sheet.getRange(2,10,last-1,1).getValues();
    let sent=0;
    for(let i=0;i<states.length && sent<20;i++) {
      if(states[i][0]==='À envoyer'||states[i][0]==='À réessayer') {
        try {sendNotification_(sheet,i+2);sent++;}catch(err){break;}
      }
    }
  }finally{lock.releaseLock();}
}
