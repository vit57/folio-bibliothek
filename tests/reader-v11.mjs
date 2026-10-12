import {revealReader} from './reader-v15.mjs';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {paginationFixture} from './fixtures.mjs';

export async function readerV11(browser,url,options={}) {
  const context=await browser.newContext({viewport:{width:1200,height:800},...options,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();
    await page.locator('#file-input').setInputFiles({name:'pagination.epub',mimeType:'application/epub+zip',buffer:await paginationFixture()});
    await page.locator('.book-title',{hasText:'EPUB Lernprobe'}).click();await revealReader(page);await page.locator('#epub-page h1').waitFor();
    assert.equal(await page.locator('#epub-page h1').innerText(),'Ein langer Gedanke');
    const noScroll=async()=>{await expect.poll(()=>page.evaluate(()=>{const stage=document.querySelector('#reading-scroll'),sheet=document.querySelector('.epub-sheet,.pdf-sheet'),box=sheet.getBoundingClientRect(),bounds=stage.getBoundingClientRect();return {vertical:stage.scrollHeight-stage.clientHeight,horizontal:stage.scrollWidth-stage.clientWidth,body:document.documentElement.scrollHeight-innerHeight,inside:box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1&&box.left>=bounds.left-1&&box.right<=bounds.right+1};})).toEqual({vertical:0,horizontal:0,body:0,inside:true});};
    await noScroll();await expect(page.locator('#leaf-position')).toContainText('Leseseite 1 /');assert.ok(Number((await page.locator('#leaf-position').textContent()).match(/Leseseite 1 \/ (\d+)/)[1])>1);
    await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();await expect(page.locator('#leaf-position')).toContainText('Leseseite 2 /');await expect(page.locator('#page-number')).toHaveValue('1');await noScroll();
    await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();await expect(page.locator('#leaf-position')).toContainText('Leseseite 1 /');await noScroll();
    await page.evaluate(()=>{const n=document.querySelector('#epub-page p').firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,20);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));});
    await page.getByRole('button',{name:'Gelb markieren',exact:true}).waitFor();
    await expect.poll(()=>page.evaluate(()=>{const pop=document.querySelector('#selection-tools').getBoundingClientRect(),rect=getSelection().getRangeAt(0).getBoundingClientRect();return Math.min(Math.abs(pop.bottom-rect.top),Math.abs(pop.top-rect.bottom));})).toBeLessThan(90);
    await page.getByRole('button',{name:'Gelb markieren',exact:true}).click();await page.locator('#epub-page mark').waitFor();
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();
    await page.locator('#reader-width').evaluate(n=>{n.value='500';n.dispatchEvent(new Event('input',{bubbles:true}));});
    await expect.poll(()=>page.locator('.epub-sheet').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBeLessThanOrEqual(500);assert.equal(await page.locator('.reader').evaluate(n=>n.style.getPropertyValue('--page-width')),'500px');
    await page.locator('#reader-size').evaluate(n=>{n.value='34';n.dispatchEvent(new Event('input',{bubbles:true}));});await noScroll();await expect(page.locator('#epub-page mark')).toHaveCount(1);
    await page.locator('#animation-setting').check();await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();await expect(page.locator('#leaf-position')).toContainText('Leseseite 2 /');await noScroll();
    await page.getByRole('button',{name:'Inhalt & Suche',exact:true}).click();await expect(page.locator('#toc-items')).not.toContainText('<link');
    await page.locator('#book-search').fill('ABSATZ_ENDE');await page.locator('.toc-search-result').click();
    await expect.poll(()=>page.evaluate(()=>{const root=document.querySelector('#epub-page'),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),windowBox=document.querySelector('.epub-window').getBoundingClientRect();while(walker.nextNode()){const n=walker.currentNode,at=n.textContent.indexOf('ABSATZ_ENDE');if(at<0)continue;const r=document.createRange();r.setStart(n,at);r.setEnd(n,at+11);const box=r.getBoundingClientRect();return box.left>=windowBox.left-1&&box.right<=windowBox.right+1&&box.bottom<=windowBox.bottom+1;}return false;})).toBe(true);
    await page.getByRole('button',{name:'Inhaltsverzeichnis schließen',exact:true}).click();
    await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await page.locator('[data-action="learning-tab:book"]').click();
    await page.getByLabel('Warum lese ich dieses Buch?',{exact:true}).fill('Bessere eigene Entscheidungen treffen.');
    await page.getByLabel('Was möchte ich danach können?',{exact:true}).fill('Die Kernaussagen verständlich erklären.');
    await page.getByLabel('Leitfrage 1',{exact:true}).fill('Wie kann ich einen Gedanken prüfen?');
    await page.getByRole('button',{name:'Buchkompass speichern',exact:true}).click();
    await page.locator('[data-action="learning-tab:chapter"]').click();await page.getByLabel('1 · Ziel in einem Satz',{exact:true}).fill('Eine eigene Erklärung entwickeln.');
    await page.getByRole('button',{name:'Freien Abruf beginnen',exact:true}).click();
    await expect(page.locator('#reading-scroll')).toHaveCount(0);await expect(page.locator('.analysis-workspace')).toBeVisible();
    await page.getByLabel('2 · Freier Abruf – aus dem Gedächtnis',{exact:true}).fill('Lesen, erinnern, abgleichen und anwenden.');
    await page.locator('#chapter-learning-form').getByRole('button',{name:'Buch zum Abgleich öffnen',exact:true}).click();await page.locator('#epub-page').waitFor();await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(page.getByLabel('2 · Freier Abruf – aus dem Gedächtnis',{exact:true})).toHaveValue('Lesen, erinnern, abgleichen und anwenden.');
    await page.getByLabel('3 · Was fehlte oder war falsch?',{exact:true}).fill('Mir fehlte ein konkretes Beispiel.');
    await page.getByLabel('Meine Korrektur / Erklärung',{exact:true}).fill('Ein Gegenbeispiel prüft die Grenzen einer Idee.');
    await page.locator('#understanding').selectOption('3');await page.getByRole('button',{name:'Lernsitzung speichern',exact:true}).click();await page.locator('.next-review').waitFor();
    await page.screenshot({path:`test-results/learning-${options.isMobile?'ipad':'mac'}.png`,fullPage:true});
    await page.locator('[data-action="learning-tab:cards"]').click();await page.getByRole('button',{name:'Lernkarte',exact:true}).click();
    await page.getByLabel('Frage auf der Vorderseite',{exact:true}).fill('Wozu dient der Abgleich?');await page.getByLabel('Antwort auf der Rückseite',{exact:true}).fill('Um eigene Lücken und falsche Zusammenhänge zu erkennen.');await page.locator('#annotation-form button[type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Frei abrufen',exact:true}).click();await page.getByRole('button',{name:'Antwort vergleichen',exact:true}).click();await page.getByRole('button',{name:'In 7 Tagen',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Lernraum schließen',exact:true}).click();await page.getByRole('button',{name:'Inhalt & Suche',exact:true}).click();await page.locator('#toc-items button',{hasText:'Eine Illustration'}).click();await expect(page.locator('#page-number')).toHaveValue('2');await page.getByRole('button',{name:'Inhaltsverzeichnis schließen',exact:true}).click();await noScroll();
    const picture=await page.locator('#epub-page img').evaluate(img=>{const r=img.getBoundingClientRect(),b=document.querySelector('.epub-window').getBoundingClientRect();return {height:r.height,inside:r.top>=b.top-1&&r.bottom<=b.bottom+1};});assert.ok(picture.height>20);assert.equal(picture.inside,true);
    await page.screenshot({path:`test-results/fitted-page-${options.isMobile?'ipad':'mac'}.png`,fullPage:true});
    // Simulate a v1 book record. Only this isolated test profile is changed.
    await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('folio-books-v1',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('books','readwrite'),s=t.objectStore('books'),all=s.getAll();all.onsuccess=()=>{const b=all.result.find(b=>b.title==='EPUB Lernprobe');b.parserVersion=1;b.toc[0].title='<link href="styles.css"/> <body> kaputter Titel';s.put(b);};t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};}));
    await page.reload();await page.locator('.book-title',{hasText:'EPUB Lernprobe'}).click();await revealReader(page);await page.getByRole('button',{name:'Inhalt & Suche',exact:true}).click();await expect(page.locator('#toc-items')).not.toContainText('<link');
    await page.locator('#toc-items button',{hasText:'Ein langer Gedanke'}).click();await page.locator('#epub-page mark').waitFor();await page.getByRole('button',{name:'Inhaltsverzeichnis schließen',exact:true}).click();await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await page.locator('[data-action="learning-tab:book"]').click();await expect(page.getByLabel('Warum lese ich dieses Buch?',{exact:true})).toHaveValue('Bessere eigene Entscheidungen treffen.');
    await page.getByRole('button',{name:'Lernraum schließen',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();if(options.isMobile)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Sicherung & Geräte',exact:true}).click();const backup=page.waitForEvent('download');await page.getByRole('button',{name:'Sicherung herunterladen',exact:true}).click();const transfer=await backup;const backupPath=await transfer.path();const restored=await browser.newContext({viewport:{width:1200,height:800},...options}),other=await restored.newPage();await other.goto(url);await other.locator('.book-card').first().waitFor();await other.locator('#backup-input').setInputFiles(backupPath);await other.getByRole('button',{name:'Sicherung übernehmen',exact:true}).click();await other.locator('.book-title',{hasText:'EPUB Lernprobe'}).click();await revealReader(other);await other.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await other.locator('[data-action="learning-tab:book"]').click();await expect(other.getByLabel('Warum lese ich dieses Buch?',{exact:true})).toHaveValue('Bessere eigene Entscheidungen treffen.');await restored.close();
    assert.deepEqual(errors,[]);
    console.log(`BESTANDEN: ${options.isMobile?'iPad':'Mac'} – XHTML, Bildschirmseiten, lange Absätze, Hochformatbilder, Breite, Markierleiste, Lernkompass, freier Abruf, Lernkarten, Wiederholung und EPUB-Reparatur.`);
  }catch(error){await page.screenshot({path:`test-results/v11-failure-${options.isMobile?'ipad':'mac'}.png`,fullPage:true}).catch(()=>{});console.error(errors);throw error;}finally{await context.close();}
}
