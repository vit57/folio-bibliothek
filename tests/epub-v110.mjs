import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {bundleFixture} from './fixtures.mjs';
import {revealReader} from './reader-v15.mjs';
export async function epubV110(browser,url,options={}){
 const name=options.isMobile?'ipad':'mac',context=await browser.newContext({viewport:{width:1440,height:1080},...options}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url);await page.locator('.book-card').first().waitFor();
  for(const [n,settings] of [{title:'EPUB im Buchordner'},{title:'EPUB mit Metadatenvariante',caseVariant:true},{title:'EPUB aus Paketdokument',missingContainer:true}].entries()){
   await page.locator('#file-input').setInputFiles({name:`Original-${n}.epub.zip`,mimeType:'application/zip',buffer:await bundleFixture(settings)});await page.locator('.book-title',{hasText:settings.title}).waitFor();await page.locator('.book-title',{hasText:settings.title}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Bewusstes Lesen');assert.equal(await page.evaluate(()=>window.EPUB_EXECUTED),undefined);await expect(page.locator('#epub-page script,#epub-page iframe')).toHaveCount(0);await page.locator('#page-number').fill('2');await page.locator('#page-number').press('Tab');await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  }
  const cover=await page.locator('.book-card',{has:page.locator('.book-title',{hasText:'EPUB im Buchordner'})}).locator('.cover').getAttribute('src');assert.ok(cover.startsWith('data:image/png;'));
  await page.reload();await page.locator('.book-title',{hasText:'EPUB im Buchordner'}).click();await revealReader(page);await expect(page.locator('#epub-page')).toContainText('Sternenkarte');await page.screenshot({path:`test-results/v110-epub-${name}.png`});await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
  for(const settings of [{encrypted:true},{encrypted:true,caseVariant:true},{encrypted:true,missingContainer:true}]){await page.locator('#file-input').setInputFiles({name:'Geschuetzt.epub.zip',mimeType:'application/zip',buffer:await bundleFixture(settings)});await expect(page.getByRole('dialog')).toContainText('verschlüsselte Inhalte');await page.getByRole('button',{name:'Fertig',exact:true}).click();}
  await page.locator('#file-input').setInputFiles({name:'Unlesbar.epub.zip',mimeType:'application/zip',buffer:Buffer.from('invalid')});await expect(page.getByRole('dialog')).not.toContainText('Dieses ZIP enthält keine');await page.getByRole('button',{name:'Fertig',exact:true}).click();assert.deepEqual(errors,[]);console.log(`BESTANDEN EPUB 1.10 ${name}: Buchordner, Metadaten-Schreibvarianten, OPF-Wiederherstellung, relative Cover/Kapitel, gespeicherte Lesestelle, Bereinigung und DRM-Prüfung.`);
 }catch(e){await page.screenshot({path:`test-results/v110-failure-${name}.png`}).catch(()=>{});throw e;}finally{await context.close();}
}
