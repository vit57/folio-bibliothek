import {revealReader} from './reader-v15.mjs';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';

export async function appearanceV12(browser,url,options={}) {
  const tablet=!!options.isMobile,context=await browser.newContext({viewport:{width:2560,height:1440},...options});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();
    assert.ok(await page.locator('.book-title').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=16);
    assert.equal(await page.locator('.profile>svg').count(),0);
    await page.getByRole('button',{name:'Dunklen Modus einschalten',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-appearance','dark');
    await expect(page.locator('.tabs .selected')).toHaveCSS('color','rgb(169, 197, 147)');
    const palette=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,sidebar:getComputedStyle(document.querySelector('.sidebar')).backgroundColor,text:getComputedStyle(document.querySelector('.book-title')).color}));
    assert.equal(palette.body,'rgb(23, 29, 25)');assert.equal(palette.sidebar,'rgb(32, 40, 33)');assert.notEqual(palette.text,'rgb(44, 53, 45)');
    await page.screenshot({path:`test-results/dark-library-${tablet?'ipad':'mac'}.png`,fullPage:true});
    await page.locator('.book-title',{hasText:'Die Kunst des aufmerksamen Lesens'}).click();await revealReader(page);await page.locator('#epub-page').waitFor();
    const centered=()=>page.evaluate(()=>{const title=document.querySelector('.reader-book-title').getBoundingClientRect(),header=document.querySelector('.reader-header').getBoundingClientRect();return Math.abs((title.left+title.right)/2-(header.left+header.right)/2);});
    await expect.poll(centered).toBeLessThan(2);
    assert.ok(await page.locator('.page-position label').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=17);
    assert.ok(await page.locator('#leaf-position').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=14);
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#reader-size').evaluate(n=>{n.value='40';n.dispatchEvent(new Event('input',{bubbles:true}));});
    for(const font of ['Times New Roman','Palatino','Arial']){await page.locator('#reader-font').selectOption(font);assert.equal(await page.locator('#epub-page').evaluate(n=>getComputedStyle(n).fontSize),'40px');assert.equal(await page.locator('#epub-page').evaluate(n=>getComputedStyle(n).fontSizeAdjust),'0.52');}
    await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(page.locator('.analysis-workspace')).toBeVisible();await expect(page.locator('.reader-pane')).toHaveCount(0);
    const workspace=await page.locator('.learning-canvas').boundingBox();assert.ok(workspace.width>(tablet?650:900));
    await page.locator('[data-action="learning-tab:book"]').click();await page.getByLabel('Warum lese ich dieses Buch?',{exact:true}).fill('Gedanken gründlich prüfen und im Alltag anwenden.');
    assert.ok(await page.getByLabel('Warum lese ich dieses Buch?',{exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=17);
    await page.screenshot({path:`test-results/analysis-workspace-${tablet?'ipad':'mac'}.png`,fullPage:true});
    await page.getByRole('button',{name:'Buch zum Abgleich öffnen',exact:true}).click();await page.locator('#epub-page').waitFor();await page.getByRole('button',{name:'Lernen & Verstehen',exact:true}).click();await expect(page.getByLabel('Warum lese ich dieses Buch?',{exact:true})).toHaveValue('Gedanken gründlich prüfen und im Alltag anwenden.');
    await page.getByRole('button',{name:'Darstellung & Lesbarkeit',exact:true}).click();await page.locator('#ui-scale').evaluate(n=>{n.value='1.6';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#ui-scale-value')).toHaveText('160 %');await page.getByRole('button',{name:'Fertig',exact:true}).click();
    assert.ok(await page.getByLabel('Warum lese ich dieses Buch?',{exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=25);
    await page.getByRole('button',{name:'Lernraum schließen',exact:true}).click();await page.locator('#epub-page').waitFor();await expect.poll(centered).toBeLessThan(2);
    await expect.poll(()=>page.evaluate(()=>{const r=document.querySelector('#reading-scroll');return Math.max(r.scrollHeight-r.clientHeight,document.documentElement.scrollHeight-innerHeight);})).toBeLessThanOrEqual(1);
    await page.reload();await page.locator('.book-card').first().waitFor();await expect(page.locator('html')).toHaveAttribute('data-appearance','dark');assert.equal(await page.locator('html').evaluate(n=>Number(n.style.getPropertyValue('--ui-scale'))),1.6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);console.log(`BESTANDEN: ${tablet?'iPad':'großer Mac-Bildschirm'} – App-Dunkelmodus, Lesbarkeit, zentrierte Kopfzeile, großer Zähler, Schriften, Analyse-Arbeitsfläche, Entwürfe und 160 % UI-Größe.`);
  }catch(e){await page.screenshot({path:`test-results/v12-failure-${tablet?'ipad':'mac'}.png`,fullPage:true}).catch(()=>{});throw e;}finally{await context.close();}
}
