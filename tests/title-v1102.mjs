import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {revealReader} from './reader-v15.mjs';

// An installed-app shell is different from a regular Safari tab. WebKit on
// macOS cannot render iPadOS's native status bar, so model its occupied region.
export async function installedTitle(browser,url,options){
 const context=await browser.newContext({...options,viewport:{width:834,height:1194}}),page=await context.newPage();
 await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
 try{
  await page.goto(url);await page.locator('.book-card').first().waitFor();await expect(page.locator('html')).toHaveAttribute('data-display-mode','standalone');
  await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();await page.locator('[data-action="app-design:glass"]').click();await page.getByLabel('App-Darstellung',{exact:true}).selectOption('light');await page.getByRole('button',{name:'Fertig',exact:true}).click();await page.getByRole('button',{name:'Navigation schließen',exact:true}).click();
  // Simulated native overlay: text must lie below this region, irrespective of
  // CSS filter properties on the text itself or zero safe-area values.
  await page.addStyleTag({content:'body::after{content:"";position:fixed;inset:0 0 auto;height:64px;z-index:1000;pointer-events:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}'});
  await page.locator('.book-title',{hasText:'Die Kunst des aufmerksamen Lesens'}).click();
  const title=page.locator('.reader-running-title');await expect(title).toBeVisible();
  const measure=()=>title.evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const box=range.getBoundingClientRect(),row=n.getBoundingClientRect(),workspace=document.querySelector('.reader-workspace').getBoundingClientRect(),style=getComputedStyle(n);return {textTop:box.top,textBottom:box.bottom,rowBottom:row.bottom,workspaceTop:workspace.top,position:style.position,fontSize:style.fontSize,fontWeight:style.fontWeight,background:style.backgroundColor};});
  let geometry=await measure();assert.ok(geometry.textTop>=64);assert.ok(geometry.workspaceTop>=geometry.rowBottom);assert.equal(geometry.position,'relative');assert.equal(geometry.fontSize,'14px');assert.equal(geometry.fontWeight,'600');assert.ok(!geometry.background.startsWith('rgba(')&&geometry.background!=='transparent');
  const before=await page.locator('.epub-window').boundingBox();await revealReader(page);assert.deepEqual(await page.locator('.epub-window').boundingBox(),before);await page.mouse.click(3,180);await expect(title).toBeVisible();assert.deepEqual(await page.locator('.epub-window').boundingBox(),before);await expect(page.locator('.reader-footer')).toHaveCSS('opacity','0');await page.screenshot({path:'test-results/v1102-installed-title-ipad.png'});
  await revealReader(page);await page.getByRole('button',{name:'Line Guide',exact:true}).click();await expect(title).toBeVisible();const guide=await page.locator('#line-guide').boundingBox();geometry=await measure();assert.ok(guide.y>=geometry.rowBottom,'The guide cannot dim the title row');
  await page.setViewportSize({width:1194,height:834});await expect.poll(async()=>Math.round((await measure()).workspaceTop)).toBe(Math.round(geometry.rowBottom));geometry=await measure();assert.ok(geometry.textTop>=64);assert.ok(geometry.workspaceTop>=geometry.rowBottom);await page.screenshot({path:'test-results/v1102-installed-landscape-ipad.png'});
  console.log('BESTANDEN installierter iPad-Modus: echte Titelzeile unter simulierter 64-px-Systemzone, opaker Hintergrund, stabile Lesefläche, Guide außerhalb und Querformat.');
 }finally{await context.close();}
}
