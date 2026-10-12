import {revealReader} from './reader-v15.mjs';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {chaptersFixture,pdfFixture} from './fixtures.mjs';

export async function reliabilityV13(browser,url,options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1050},...options,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const goal=()=>page.getByLabel('1 · Ziel in einem Satz',{exact:true});
  const recall=()=>page.getByLabel('2 · Freier Abruf – aus dem Gedächtnis',{exact:true});
  const source=()=>page.getByLabel('Quelle der Kapitelanalyse',{exact:true});
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();
    assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\/pdf-[^/]+\.js/.test(r.name))),false);
    await page.locator('#file-input').setInputFiles({name:'chapters.epub',mimeType:'application/epub+zip',buffer:await chaptersFixture()});
    await page.locator('.book-title',{hasText:'Verknüpfte Kapitel'}).click();await revealReader(page);await page.locator('#epub-page').waitFor();
    await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();await expect(page.locator('#leaf-position')).toContainText('Leseseite 1 /');
    await expect(page.locator('.reader')).toHaveAttribute('data-surface','integrated');await expect(page.locator('.epub-sheet')).toHaveCSS('border-radius','0px');await expect(page.locator('.epub-sheet')).toHaveCSS('box-shadow','none');
    await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();
    await expect(source()).toContainText('Erstes echtes Kapitel');await expect(source()).toContainText('Zweites echtes Kapitel');
    await expect(page.locator('.chapter-binding')).toContainText('Erstes echtes Kapitel');
    await goal().fill('Kapitel A verstehen');await recall().fill('Mein erster Entwurf bleibt erhalten.');
    await expect(page.locator('.draft-status')).toContainText('auf diesem Gerät gesichert');
    await source().selectOption({label:'Zweites echtes Kapitel'});await expect(goal()).toHaveValue('');await expect(page.locator('.chapter-binding')).toContainText('Zweites echtes Kapitel');
    await goal().fill('Kapitel B verstehen');await recall().fill('Ein anderer Gedanke in Kapitel B.');
    await expect(page.locator('.draft-status')).toContainText('auf diesem Gerät gesichert');
    await page.reload();await page.locator('.book-title',{hasText:'Verknüpfte Kapitel'}).click();await revealReader(page);await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();
    await expect(goal()).toHaveValue('Kapitel B verstehen');await expect(recall()).toHaveValue('Ein anderer Gedanke in Kapitel B.');await expect(page.locator('.draft-status')).toContainText('wiederhergestellt');
    await source().selectOption({label:'Erstes echtes Kapitel'});await expect(goal()).toHaveValue('Kapitel A verstehen');await expect(recall()).toHaveValue('Mein erster Entwurf bleibt erhalten.');
    await page.locator('#understanding').selectOption('3');await page.getByRole('button',{name:'Lernsitzung speichern',exact:true}).click();await expect(page.locator('.draft-status')).toContainText('Lernsitzung gespeichert');
    await recall().fill('Meine überarbeitete Erklärung.');await page.getByRole('button',{name:'Lernsitzung speichern',exact:true}).click();await expect(page.locator('.recall-history')).toContainText('Mein erster Entwurf bleibt erhalten.');
    await source().selectOption({label:'Zweites echtes Kapitel'});await expect(recall()).toHaveValue('Ein anderer Gedanke in Kapitel B.');
    await page.screenshot({path:`test-results/v13-analysis-${options.isMobile?'ipad':'mac'}.png`,fullPage:true});
    // Simulate a v1.2 import while preserving both its text tree and learning records.
    await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('folio-books-v1',1);request.onsuccess=()=>{const database=request.result,transaction=database.transaction('books','readwrite'),store=transaction.objectStore('books'),all=store.getAll();all.onsuccess=()=>{const book=all.result.find(b=>b.title==='Verknüpfte Kapitel');book.parserVersion=2;for(const source of book.pages){delete source.segments;delete source.chapterNavigation;}store.put(book);};transaction.oncomplete=()=>{database.close();resolve();};transaction.onerror=()=>reject(transaction.error);};}));
    await page.reload();await page.locator('.book-title',{hasText:'Verknüpfte Kapitel'}).click();await revealReader(page);await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(source()).toContainText('Zweites echtes Kapitel');await expect(recall()).toHaveValue('Ein anderer Gedanke in Kapitel B.');
    await page.getByRole('button',{name:'Buch zum Abgleich öffnen',exact:true}).click();await page.locator('#epub-page').waitFor();
    await expect(page.locator('.reading-toolbar>span')).toHaveText('Zweites echtes Kapitel');
    await page.getByRole('button',{name:'Bibliothek',exact:true}).click();if(options.isMobile)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();
    await page.getByRole('button',{name:'Sicherung & Geräte',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Sicherung herunterladen',exact:true}).click();const file=await (await downloading).path();
    const other=await browser.newContext({viewport:{width:1200,height:900},...options});
    try{const restored=await other.newPage();await restored.goto(url);await restored.locator('.book-card').first().waitFor();await restored.locator('#backup-input').setInputFiles(file);await restored.getByRole('button',{name:'Sicherung übernehmen',exact:true}).click();await restored.locator('.book-title',{hasText:'Verknüpfte Kapitel'}).click();await revealReader(restored);await restored.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(restored.getByLabel('2 · Freier Abruf – aus dem Gedächtnis',{exact:true})).toHaveValue('Ein anderer Gedanke in Kapitel B.');}finally{await other.close();}
    await page.getByRole('button',{name:'Schließen',exact:true}).click();
    await page.locator('#file-input').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:pdfFixture()});await page.locator('.book-title',{hasText:/^source$/}).click();await revealReader(page);await page.locator('.textLayer span').first().waitFor();
    await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(page.locator('.chapter-binding')).toContainText('PDF-Seite');await source().selectOption({label:'Seite 2'});await expect(page.locator('.chapter-binding')).toContainText('Seite 2');
    assert.deepEqual(errors,[]);console.log(`BESTANDEN: ${options.isMobile?'iPad':'Mac'} – EPUB-Kapitelanker, getrennte Formulare, Entwurfsrettung nach Neuladen und Gerätewechsel, Abrufverlauf, PDF-Seitenbindung und verzögertes Laden des PDF-Moduls.`);
  }catch(error){await page.screenshot({path:`test-results/v13-failure-${options.isMobile?'ipad':'mac'}.png`,fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
}
