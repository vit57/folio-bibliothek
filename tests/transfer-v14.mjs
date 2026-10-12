import {revealReader} from './reader-v15.mjs';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {chaptersFixture,pdfFixture} from './fixtures.mjs';

export async function transferV14(browser,url,options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1050},...options,acceptDownloads:true});
  const page=await context.newPage(),errors=[],device=options.isMobile?'ipad':'mac';page.on('pageerror',e=>errors.push(e.message));
  const download=async(format,name)=>{await page.locator('#export-format').selectOption(format);const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Export erstellen',exact:true}).click();const d=await waiting;await d.saveAs(`test-results/${name}`);return readFile(await d.path());};
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();
    await page.getByRole('button',{name:'Importieren',exact:true}).click();await page.getByRole('button',{name:'Aus Apple Books übernehmen',exact:true}).click();
    await expect(page.locator('#dialog')).toContainText('Separate Apple-Books-Markierungen');
    const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Apple-Books-Dateien auswählen',exact:true}).click();const chooser=await choose;assert.ok(chooser.isMultiple());
    await chooser.setFiles({name:'apple-export.epub',mimeType:'application/epub+zip',buffer:await chaptersFixture()});
    await page.locator('.book-title',{hasText:'Verknüpfte Kapitel'}).click();await revealReader(page);await page.locator('#epub-page').waitFor();
    await page.getByRole('button',{name:'Inhalt & Suche',exact:true}).click();
    const left=await page.locator('.toc-pane').boundingBox(),main=await page.locator('.reading-main').boundingBox();assert.ok(left.x<page.viewportSize().width/2);if(!options.isMobile)assert.ok(left.x<main.x+1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`test-results/v14-toc-${device}.png`,fullPage:true});
    await page.getByRole('button',{name:'Inhaltsverzeichnis schließen',exact:true}).click();
    await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();
    await page.locator('.book-turn-layer').waitFor({state:'attached'});
    assert.equal(await page.locator('.book-turn-layer').getAttribute('aria-hidden'),'true');
    await page.evaluate(()=>{for(const a of document.querySelector('#page-content').getAnimations({subtree:true})){a.pause();a.currentTime=260;}});await page.screenshot({path:`test-results/v14-turn-${device}.png`,fullPage:false});await page.evaluate(()=>{for(const a of document.querySelector('#page-content').getAnimations({subtree:true}))a.play();});await page.locator('.book-turn-layer').waitFor({state:'detached'});
    assert.equal(await page.locator('.epub-sheet').evaluate(n=>getComputedStyle(n).opacity),'1');
    await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();await page.locator('.book-turn-layer').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Notizen & Fragen',exact:true}).click();await page.getByRole('button',{name:'Notiz',exact:true}).click();await page.getByLabel('Deine Notiz',{exact:true}).fill('MEIN-EINTRAG: Eine eigene Notiz am ersten Kapitel.');await page.getByRole('button',{name:'Speichern',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Seitenleiste schließen',exact:true}).click();await page.getByRole('button',{name:'Lesezeichen setzen',exact:true}).click();await page.getByRole('button',{name:'Lesezeichen entfernen',exact:true}).waitFor();
    await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();
    const source=page.getByLabel('Quelle der Kapitelanalyse',{exact:true});await source.selectOption({label:'Erstes echtes Kapitel'});
    await page.getByLabel('1 · Ziel in einem Satz',{exact:true}).fill('Äpfel, Größe, Ernährung – verständlich erklären.');
    await page.getByLabel('2 · Freier Abruf – aus dem Gedächtnis',{exact:true}).fill(Array.from({length:65},(_,n)=>`Gedanke ${n+1}: Äpfel & Ernährung, Größe und Maß. Eine eigene Erklärung mit genügend Text für einen Seitenwechsel im PDF.`).join('\n\n'));
    await page.locator('#understanding').selectOption('3');await page.getByRole('button',{name:'Lernsitzung speichern',exact:true}).click();await expect(page.locator('.draft-status')).toContainText('Lernsitzung gespeichert');
    await source.selectOption({label:'Zweites echtes Kapitel'});await page.getByLabel('1 · Ziel in einem Satz',{exact:true}).fill('NUR-KAPITEL-ZWEI');await page.getByRole('button',{name:'Lernsitzung speichern',exact:true}).click();await expect(page.locator('.draft-status')).toContainText('Lernsitzung gespeichert');
    await source.selectOption({label:'Erstes echtes Kapitel'});await page.getByLabel('Freie Notizen',{exact:true}).fill('ENTWURF-MITNEHMEN');await expect(page.locator('.draft-status')).toContainText('auf diesem Gerät gesichert');
    await page.getByRole('button',{name:'Wissen exportieren',exact:true}).click();await expect(page.locator('#export-summary')).toContainText('Erstes echtes Kapitel');
    const md=(await download('md',`v14-kapitel-${device}.md`)).toString('utf8');assert.ok(md.includes('Äpfel'));assert.ok(md.includes('MEIN-EINTRAG'));assert.ok(md.includes('Lesezeichen'));assert.ok(md.includes('ENTWURF-MITNEHMEN'));assert.ok(!md.includes('NUR-KAPITEL-ZWEI'));
    const pdf=await download('pdf',`v14-journal-${device}.pdf`);assert.ok(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));
    if(browser.browserType().name()==='chromium')await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:url});
    await page.locator('#export-format').selectOption('copy');await page.getByRole('button',{name:'Export erstellen',exact:true}).click();await expect(page.locator('#toast')).toContainText('Markdown in die Zwischenablage kopiert');
    if(browser.browserType().name()==='chromium')assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('ENTWURF-MITNEHMEN'));
    await page.locator('#export-scope').selectOption('book');const zip=await JSZip.loadAsync(await download('notion',`v14-notion-${device}.zip`));
    assert.ok(zip.file('Books.csv'));assert.ok(zip.file('Chapters.csv'));assert.ok(zip.file('Fundstücke.csv'));const notes=Object.keys(zip.files).find(n=>n.startsWith('Bücher/')&&n.endsWith('.md'));assert.ok(notes);assert.ok((await zip.file(notes).async('string')).includes('NUR-KAPITEL-ZWEI'));
    await page.locator('#export-book-select').selectOption('');assert.equal(await page.locator('#export-scope option[value=chapter]').evaluate(n=>n.disabled),true);
    await page.screenshot({path:`test-results/v14-export-${device}.png`,fullPage:true});await page.getByRole('button',{name:'Schließen',exact:true}).click();
    await page.getByRole('button',{name:'Buch zum Abgleich öffnen',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
    await page.locator('.book-card').filter({hasText:'Verknüpfte Kapitel'}).getByRole('button',{name:'Buchoptionen',exact:true}).click();await page.getByText('Leseziele & Buchinformationen',{exact:true}).click();
    await page.getByLabel('Tags (mit Komma trennen)',{exact:true}).fill('Wissen, Lernprojekt');await page.getByLabel('Erscheinungsjahr',{exact:true}).fill('2026');await page.getByLabel('Leseziel: Abschnitt',{exact:true}).fill('1');await page.getByLabel('Link zur Quelle',{exact:true}).fill('https://example.com/book');await page.getByLabel('Als Nachschlagewerk nutzen',{exact:true}).check();await page.getByRole('button',{name:'Änderungen speichern',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    await page.locator('.book-card').filter({hasText:'Verknüpfte Kapitel'}).getByRole('button',{name:'Buchoptionen',exact:true}).click();await page.getByText('Leseziele & Buchinformationen',{exact:true}).click();await page.getByLabel('Link zur Quelle',{exact:true}).fill('ftp://example.com/invalid');await page.getByLabel('Tags (mit Komma trennen)',{exact:true}).fill('UNGUELTIGER-ENTWURF');await page.getByRole('button',{name:'Änderungen speichern',exact:true}).click();await expect(page.locator('#toast')).toContainText('https://');await page.getByRole('button',{name:'Schließen',exact:true}).click();
    await page.getByRole('searchbox',{name:'Alle Bücher durchsuchen',exact:true}).fill('Lernprojekt');await page.locator('.search-result').waitFor();await page.locator('.search-result').first().click();await revealReader(page);
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#animation-setting').uncheck();await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();assert.equal(await page.locator('.book-turn-layer').count(),0);
    await page.getByRole('button',{name:'Bibliothek',exact:true}).click();await page.locator('#file-input').setInputFiles({name:'apple-export.pdf',mimeType:'application/pdf',buffer:pdfFixture()});await page.locator('.book-title',{hasText:/^apple-export$/}).click();await revealReader(page);await page.locator('.pdf-sheet canvas').waitFor();
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#animation-setting').check();await page.locator('#animation-style').selectOption('page');await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();await page.locator('.book-turn-layer').waitFor({state:'attached'});await page.locator('.book-turn-layer').waitFor({state:'detached'});await page.locator('.textLayer span',{hasText:'Mondbibliothek'}).waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();assert.equal(await page.locator('.book-turn-layer').count(),0);
    assert.deepEqual(errors,[]);console.log(`BESTANDEN: ${device} – Inhalt links, Apple-Dateiauswahl, Kapitel-/Buch-/Gesamtexport, Markdown, Notion ZIP, echtes mehrseitiges PDF, Entwürfe, Buchfelder, Tagsuche und Seitenanimation samt deaktivierter/reduzierter Bewegung.`);
  }catch(error){await page.screenshot({path:`test-results/v14-failure-${device}.png`,fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
}
