import {chromium,webkit,devices} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {bundleFixture,pdfFixture} from './fixtures.mjs';
import {revealReader} from './reader-v15.mjs';
const root=resolve(process.env.FOLIO_TEST_DIST || 'dist'),base=process.env.FOLIO_BASE_PATH || '/';
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(!pathname.startsWith(base))throw new Error('Outside app');
 const relative=pathname.slice(base.length)||'index.html',path=resolve(root,relative);
 if(!path.startsWith(root+'/'))throw new Error('Outside distribution');
 const bytes=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+base;
await mkdir('test-results',{recursive:true});
try{for(const [engine,tablet] of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch({headless:true}),context=await browser.newContext(tablet?{...devices['iPad (gen 7)'],viewport:{width:810,height:1080}}:{viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[],badPaths=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{const u=new URL(req.url());if(u.origin===origin&&!u.pathname.startsWith(base))badPaths.push(u.pathname);});
 try{
  await page.goto(url);await expect(page.locator('.book-card')).toHaveCount(8);
  const manifest=await (await page.request.get(url+'manifest.webmanifest')).json();assert.equal(new URL(manifest.start_url,url+'manifest.webmanifest').pathname,base);assert.equal(new URL(manifest.scope,url+'manifest.webmanifest').pathname,base);for(const icon of manifest.icons)assert.ok((await page.request.get(new URL(icon.src,url+'manifest.webmanifest').href)).ok());
  await page.locator('#file-input').setInputFiles([{name:'Buch.epub.zip',mimeType:'application/zip',buffer:await bundleFixture({title:'Pages Buchprobe'})},{name:'Pages PDF.pdf',mimeType:'application/pdf',buffer:pdfFixture()}]);await expect(page.locator('.book-card')).toHaveCount(10,{timeout:30000});
  await page.locator('.book-title',{hasText:'Pages Buchprobe'}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Bewusstes Lesen');await page.locator('#page-number').fill('2');await page.locator('#page-number').press('Tab');await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  for(const design of ['folio','glass','aged','antique','library','magic']){
   if(tablet)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();await page.locator(`[data-action="app-design:${design}"]`).click();await page.getByRole('button',{name:'Fertig',exact:true}).click();if(tablet)await page.getByRole('button',{name:'Navigation schließen',exact:true}).click();
   await page.locator('.book-title',{hasText:'Die Kunst des aufmerksamen Lesens'}).click();await revealReader(page);const header=page.locator('.reader-header');assert.ok(!await page.locator('.reading-toolbar').innerText().then(t=>t.includes('Eine Frage mitbringen')),'Kapitel wird in der Werkzeugleiste nicht erneut angezeigt');assert.equal(await header.evaluate(n=>getComputedStyle(n).backdropFilter),'none');
   if(tablet){await page.mouse.click(3,180);await expect(page.locator('.reader')).toHaveClass(/chrome-hidden/);await expect(header).toHaveCSS('display','none');const title=page.locator('.reader-running-title');await expect(title).toBeVisible();await expect(title).toHaveCSS('opacity','1');await expect(title).toHaveCSS('filter','none');await expect(title).toHaveCSS('text-shadow','none');await expect(page.locator('.reader-footer')).toHaveCSS('opacity','0');await page.screenshot({path:`test-results/github-title-${design}-ipad.png`});await revealReader(page);await page.getByRole('button',{name:'Line Guide',exact:true}).click();await expect(header).toHaveCSS('display','none');await expect(title).toHaveCSS('opacity','1');await page.getByRole('button',{name:'Lesemenü öffnen',exact:true}).filter({has:page.locator('svg')}).click();await page.getByRole('menuitem',{name:'Zeilenlesen ausschalten',exact:true}).click();await revealReader(page);}
   await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  }
  await page.locator('.book-title',{hasText:'Pages PDF'}).click();await page.locator('.pdf-sheet canvas').waitFor();await revealReader(page);await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>new URL(r.scope).pathname)),base);
  const cached=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(),worker=await (await fetch(r.active.scriptURL)).text(),assets=JSON.parse(worker.match(/const ASSETS=(.*);/)[1]);const names=await caches.keys(),requests=(await Promise.all(names.map(n=>caches.open(n).then(c=>c.keys())))).flat().map(r=>new URL(r.url).pathname);return {assets,requests};});assert.ok(cached.assets.length>200);assert.ok(cached.assets.every(p=>p.startsWith(base)));assert.ok(cached.assets.every(p=>cached.requests.includes(p)));
  if(!tablet)await context.setOffline(true);await page.reload();await page.locator('.book-title',{hasText:'Pages Buchprobe'}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await context.setOffline(false);assert.deepEqual(errors,[]);assert.deepEqual(badPaths,[]);console.log(`BESTANDEN Pages ${tablet?'iPad/WebKit':'Mac/Chromium'}: ${base}, EPUB/PDF, Bilder/Schriften, Menü/Titel in 6 Designs ohne Glaseffekt, isolierter Offline-Cache und Lesestelle.`);
 }catch(error){console.error('Browserdiagnose',tablet?'WebKit':'Chromium',await page.locator('#dialog').innerText().catch(()=>''),errors);await page.screenshot({path:`test-results/github-failure-${tablet?'ipad':'mac'}.png`}).catch(()=>{});throw error;}finally{await context.close();await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
