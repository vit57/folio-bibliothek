import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {bundleFixture} from './fixtures.mjs';
import {revealReader} from './reader-v15.mjs';

export async function epubPackageV1105(browser,url,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1080},...options}),page=await context.newPage(),errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.method()!=='GET')outbound.push(request.url());});
 try{
  const payload=async encrypted=>{const zip=await JSZip.loadAsync(await bundleFixture({title:'Paket aus Dateien',prefix:'',encrypted}));return await Promise.all(Object.values(zip.files).filter(e=>!e.dir).map(async e=>({path:e.name,bytes:[...await e.async('uint8array')]})));};
  await context.addInitScript(({plain,encrypted})=>{
   const selected=file=>/^Paketauswahl.*\.epub\.zip$/.test(file?.name||''),nativeBuffer=File.prototype.arrayBuffer,nativeReader=FileReader.prototype.readAsArrayBuffer,size=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get,nativeEntries=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'webkitEntries')?.get;
   Object.defineProperty(File.prototype,'size',{get(){return selected(this)?0:size.call(this);}});
   File.prototype.arrayBuffer=function(){return selected(this)?Promise.reject(new DOMException('Path does not exist','NotFoundError')):nativeBuffer.call(this);};
   FileReader.prototype.readAsArrayBuffer=function(file){if(selected(file)){Object.defineProperty(this,'error',{value:new DOMException('Path does not exist','NotFoundError')});queueMicrotask(()=>this.onerror?.(new Event('error')));return;}return nativeReader.call(this,file);};
   function tree(file){
    const name=file.name.slice(0,-4),dir=(name,children=[])=>({name,children,isDirectory:true,isFile:false,createReader(){let index=0;return {readEntries(ok){const batch=children.slice(index,index+2);index+=2;queueMicrotask(()=>ok(batch));}};}}),root=dir(name),directories=new Map([['',root]]);
    for(const item of file.name.includes('DRM')?encrypted:plain){let prefix='';const parts=item.path.split('/');for(const name of parts.slice(0,-1)){const path=prefix+name+'/';if(!directories.has(path)){const child=dir(name);directories.get(prefix).children.push(child);directories.set(path,child);}prefix=path;}directories.get(prefix).children.push({name:parts.at(-1),isDirectory:false,isFile:true,file(ok){queueMicrotask(()=>ok(new File([new Uint8Array(item.bytes)],parts.at(-1))));}});}
    if(file.name.includes('Direkt'))return {...root,name:file.name,fullPath:'/'+file.name};
    return {name:file.name,fullPath:'/'+file.name,isDirectory:true,isFile:false,createReader:()=>({readEntries(ok,bad){queueMicrotask(()=>bad(new DOMException('Path does not exist','NotFoundError')));}}),filesystem:{root:{getDirectory(request,flags,ok,bad){if(request!==name||flags.create)throw new Error('Unexpected path access');queueMicrotask(()=>file.name.includes('Gesperrt')?bad(new DOMException('No permission','SecurityError')):ok(root));}}}};
   }
   Object.defineProperty(HTMLInputElement.prototype,'webkitEntries',{get(){const file=this.files?.[0];return selected(file)?file.name.includes('Ohne Eintrag')?[]:[tree(file)]:nativeEntries?.call(this)||[];}});
   const nativeDrop=DataTransferItem.prototype.webkitGetAsEntry;DataTransferItem.prototype.webkitGetAsEntry=function(){const file=this.getAsFile();return selected(file)?tree(file):nativeDrop?.call(this);};
   window.dropPackage=()=>{const transfer=new DataTransfer(),file=new File([],'Paketauswahl Direkt.epub.zip',{type:'application/zip'});transfer.items.add(file);document.body.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));transfer.items.clear();};
  },{plain:await payload(false),encrypted:await payload(true)});
  await page.goto(url);await page.locator('.book-card').first().waitFor();
  const importPackage=async name=>page.locator('#file-input').setInputFiles({name,mimeType:'application/zip',buffer:Buffer.alloc(0)});
  await importPackage('Paketauswahl Umbenannt.epub.zip');await expect(page.locator('.book-title',{hasText:'Paket aus Dateien'})).toHaveCount(1);
  await page.locator('.book-title',{hasText:'Paket aus Dateien'}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Bewusstes Lesen');await page.locator('#page-number').fill('2');await page.locator('#page-number').press('Tab');await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await page.getByRole('button',{name:'Bibliothek',exact:true}).click();await page.reload();await page.locator('.book-title',{hasText:'Paket aus Dateien'}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  await page.evaluate(()=>window.dropPackage());await expect(page.locator('.book-title',{hasText:'Paket aus Dateien'})).toHaveCount(2);
  for(const name of ['Paketauswahl DRM.epub.zip','Paketauswahl Gesperrt.epub.zip','Paketauswahl Ohne Eintrag.epub.zip']){
   await importPackage(name);await expect(page.getByRole('dialog',{name:'Import nicht möglich',exact:true})).toBeVisible();
   if(name.includes('DRM'))await expect(page.getByRole('dialog')).toContainText('verschlüsselte Inhalte');
   await page.getByText('Details zur Fehlersuche',{exact:true}).click();const report=JSON.parse(await page.getByLabel('Importdiagnose',{exact:true}).inputValue());assert.equal(report.saved,0);assert.equal(report.files[0].reportedBytes,0);assert.deepEqual(report.files[0].readErrors,['NotFoundError','NotFoundError']);
   if(name.includes('Gesperrt')){assert.equal(report.files[0].entryKind,'directory');assert.deepEqual(report.files[0].entryErrors,['NotFoundError','SecurityError']);assert.equal(report.files[0].receivedBytes,0);}
   if(name.includes('Ohne Eintrag'))assert.equal(report.files[0].entryKind,'unavailable');
   await page.getByRole('button',{name:'Fertig',exact:true}).click();
  }
  await expect(page.locator('.book-title',{hasText:'Paket aus Dateien'})).toHaveCount(2);assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  console.log(`BESTANDEN EPUB-Paketauswahl ${options.isMobile?'WebKit iPad-Simulation':'Chromium'}: 0 Byte/NotFoundError, Paketname mit Safari-ZIP-Endung, mehrere Eintragsbatches, Lesen/Speichern/Reload, Drop mit sofort freigegebenem DataTransfer, DRM-Abweisung und gesperrte/fehlende Einträge. Keine Buchdaten im Netzwerk.`);
 }catch(error){console.error('Paketdiagnose',await page.locator('#dialog').innerText().catch(()=>''));throw error;}finally{await context.close();}
}
