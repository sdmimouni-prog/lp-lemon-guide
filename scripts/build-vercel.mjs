import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('public/assets/',root),{recursive:true});
for(const file of ['index.html','form.js'])await copyFile(new URL(file,root),new URL('public/'+file,root));
await copyFile(new URL('private/guide-influence-lemon-mind-2026.pdf',root),new URL('public/assets/guide-influence-lemon-mind-2026.pdf',root));
console.log('Vercel static assets ready. API routes are deployed from api/.');
