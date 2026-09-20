(() => {
  const form=document.querySelector('#download-form');
  const content=document.querySelector('#form-content');
  const success=document.querySelector('#download-success');
  const error=document.querySelector('#form-error');
  const submit=form.querySelector('[type=submit]');
  const label=submit.querySelector('span');
  const link=document.querySelector('#download-link');
  const privacy=document.querySelector('#privacy-dialog');
  let pending=false;
  let requestId=crypto.randomUUID();
  let lastPayload='';
  document.querySelectorAll('[data-focus-form]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>(content.hidden?link:document.querySelector('#full-name')).focus({preventScroll:true}),450)));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    form.querySelectorAll('input[required]').forEach(input=>input.value=input.value.trim());
    if(!form.reportValidity())return;
    const values=new FormData(form);
    const payload={fullName:values.get('fullName'),email:values.get('email'),company:values.get('company'),role:values.get('role'),newsletter:values.get('newsletter')==='yes',publicConsent:values.get('publicConsent')==='yes',website:values.get('website')||''};
    const fingerprint=JSON.stringify(payload);
    if(lastPayload && lastPayload!==fingerprint)requestId=crypto.randomUUID();
    lastPayload=fingerprint;
    pending=true;submit.disabled=true;submit.setAttribute('aria-busy','true');error.hidden=true;label.textContent='Enregistrement…';
    try {
      const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId}),signal:AbortSignal.timeout(30000)});
      let result;
      try { result=await response.json(); }
      catch { throw Error('Le service du formulaire est momentanément indisponible. Merci de réessayer plus tard.'); }
      if(!response.ok || result.ok!==true)throw Error(result.message||'L’enregistrement a échoué. Merci de réessayer.');
      if(!result.downloadUrl?.startsWith('/download/guide.pdf?token='))throw Error('Le lien de téléchargement est indisponible. Réessayez.');
      link.href=result.downloadUrl;link.download='Guide-strategique-influence-Lemon-Mind-2026.pdf';
      content.hidden=true;success.hidden=false;success.focus({preventScroll:true});link.click();
    } catch(e) {
      error.textContent=e.name==='TimeoutError'?'Le service met du temps à répondre. Réessayez : votre demande ne sera pas enregistrée deux fois.':e.message;
      error.hidden=false;
    } finally {pending=false;submit.disabled=false;submit.removeAttribute('aria-busy');label.textContent='Télécharger le guide';}
  });
  document.querySelector('#form-back').addEventListener('click',()=>{success.hidden=true;content.hidden=false;document.querySelector('#full-name').focus({preventScroll:true});});
  document.querySelectorAll('[data-privacy]').forEach(button=>button.addEventListener('click',()=>privacy.showModal()));
  privacy.querySelector('.dialog-close').addEventListener('click',()=>privacy.close());
  privacy.addEventListener('click',event=>{if(event.target===privacy){const r=privacy.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)privacy.close();}});
})();
