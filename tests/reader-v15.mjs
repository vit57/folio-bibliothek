import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {pdfFixture} from './fixtures.mjs';

export async function revealReader(page){
  await page.locator('.reader:not(.analysis-open)').waitFor();await expect(page.locator('#leaf-position')).toContainText('%');
  if(await page.locator('.reader.chrome-hidden').count()){
    if(await page.locator('.guide-controls:visible').count()){await page.locator('.guide-controls [data-action=guide-menu]').click();await page.locator('[data-action=guide-controls-toggle]').click();}else{const box=await page.locator('#reading-scroll').boundingBox();await page.mouse.click(box.x+3,box.y+90);}
    await expect(page.locator('.reader')).not.toHaveClass(/chrome-hidden/);await expect(page.locator('.reader-footer')).toBeVisible();
  }
}
async function textPoint(page,index=2){return page.locator('#epub-page p:not(.eyebrow)').first().evaluate((n,index)=>{const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let text;while(walker.nextNode()){if(walker.currentNode.length>index){text=walker.currentNode;break;}index-=walker.currentNode.length;}if(!text)throw new Error('Textstelle fehlt');const r=document.createRange();r.setStart(text,index);r.setEnd(text,index+1);const b=r.getBoundingClientRect();return {x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};},index);}
export async function readerV15(browser,url,options={}){
  const tablet=!!options.isMobile,name=tablet?'ipad':'mac',context=await browser.newContext({viewport:{width:1440,height:1080},...options}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();
    await page.getByRole('button',{name:'Dunklen Modus einschalten',exact:true}).click();
    await page.getByRole('button',{name:'Die Kunst des aufmerksamen Lesens',exact:true}).click();await page.locator('#epub-page').waitFor();
    if(tablet){
      await expect(page.locator('.reader')).toHaveClass(/chrome-hidden/);await expect(page.getByRole('button',{name:'Themes & Darstellung',exact:true})).not.toBeVisible();
      const letter=await textPoint(page);await page.touchscreen.tap(letter.x,letter.y);await expect(page.locator('.reader')).toHaveClass(/chrome-hidden/);
      const before=await page.locator('.epub-window').boundingBox();await revealReader(page);assert.deepEqual(await page.locator('.epub-window').boundingBox(),before);
      const another=await textPoint(page,35);await page.touchscreen.tap(another.x,another.y);await expect(page.locator('.reader')).toHaveClass(/chrome-hidden/);assert.deepEqual(await page.locator('.epub-window').boundingBox(),before);await revealReader(page);
    }
    const title=await page.locator('.reader-book-title').boundingBox();assert.ok(title.height<48);
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await expect(page.locator('.reader-settings-dialog')).toBeVisible();await expect(page.locator('.reader-pane')).toHaveCount(0);
    await page.locator('.more-themes summary').click();await expect(page.locator('.theme-tile')).toHaveCount(15);
    for(const tile of await page.locator('.theme-tile').all()){
      const p=await tile.evaluate(n=>{const c=getComputedStyle(n);return {bg:c.backgroundColor,ink:c.color};});
      assert.notEqual(p.bg,p.ink);assert.notEqual(p.bg,'rgba(0, 0, 0, 0)');
    }
    const original=page.locator('[data-action="theme:original"]');assert.equal(await original.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');assert.equal(await original.evaluate(n=>getComputedStyle(n).color),'rgb(36, 40, 35)');
    await page.locator('[data-action="theme:midnight"]').click();await expect(page.locator('.reader')).toHaveAttribute('data-theme','midnight');await expect(page.locator('.type-preview')).toHaveCSS('background-color','rgb(23, 25, 31)');
    await expect(page.locator('#reader-font option')).toHaveCount(13);await page.locator('#reader-font').selectOption('Liberation Sans');
    await expect.poll(()=>page.evaluate(()=>document.fonts.check('26px "Folio Liberation"'))).toBe(true);
    await page.locator('#reader-bold').check();await expect(page.locator('#epub-page')).toHaveCSS('font-weight','600');
    await page.locator('#line-guide-setting').check();await page.locator('[data-action="guide-lines:3"]').click();await expect(page.locator('#line-guide')).toBeVisible();
    await page.locator('#guide-position').evaluate(n=>{n.value='55';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#line-guide')).toHaveAttribute('data-line',/^[1-9]/);
    await page.screenshot({path:`test-results/v15-settings-${name}.png`});
    await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    const handle=await page.locator('.guide-handle').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+70);await page.mouse.up();
    const dragged=await page.locator('#line-guide').evaluate(n=>parseFloat(n.style.getPropertyValue('--guide-position')));assert.ok(dragged>55-5);
    await page.locator('.guide-handle').focus();await page.keyboard.press('ArrowUp');assert.ok(await page.locator('#line-guide').evaluate(n=>parseFloat(n.style.getPropertyValue('--guide-position')))<dragged);
    // Text selection must stay available and must not trigger the chrome tap.
    await page.evaluate(()=>{const n=document.querySelector('#epub-page p:not(.eyebrow)').firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,8);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));});
    await page.getByRole('button',{name:'Gelb markieren',exact:true}).click();await page.locator('#epub-page mark').waitFor();
    await revealReader(page);await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#line-guide-setting').uncheck();await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    if(tablet){const letter=await textPoint(page,35);await page.touchscreen.tap(letter.x,letter.y);await expect(page.locator('.reader')).toHaveClass(/chrome-hidden/);}
    await page.screenshot({path:`test-results/v15-reader-${name}.png`});await revealReader(page);
    await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
    if(tablet)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
    for(const design of ['glass','realpaper','folio']){
      await page.locator(`[data-action="app-design:${design}"]`).click();await expect(page.locator('html')).toHaveAttribute('data-design',design);
      await expect(page.locator('.book-card').last()).toHaveCSS('opacity','1');await page.screenshot({path:`test-results/v15-${design}-dark-${name}.png`});
      await page.locator('#app-theme').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-appearance','light');await page.screenshot({path:`test-results/v15-${design}-light-${name}.png`});await page.locator('#app-theme').selectOption('dark');
    }
    await page.locator('[data-action="app-design:glass"]').click();await page.getByRole('button',{name:'Fertig',exact:true}).click();await page.reload();await page.locator('.book-card').first().waitFor();await expect(page.locator('html')).toHaveAttribute('data-design','glass');
    await page.getByRole('button',{name:'Die Kunst des aufmerksamen Lesens',exact:true}).click();await page.locator('#epub-page mark').waitFor();await revealReader(page);await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();
    await expect(page.locator('#reader-font')).toHaveValue('Liberation Sans');await expect(page.locator('#reader-bold')).toBeChecked();await expect(page.locator('[data-action="guide-lines:3"]')).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
    await page.locator('#file-input').setInputFiles({name:'v15-fit.pdf',mimeType:'application/pdf',buffer:pdfFixture()});await page.locator('.book-title',{hasText:'v15-fit'}).click();await page.locator('.pdf-sheet canvas').waitFor();
    const fits=await page.locator('.pdf-sheet').evaluate(n=>{const b=n.getBoundingClientRect(),s=document.querySelector('#reading-scroll'),r=s.getBoundingClientRect(),c=getComputedStyle(s);return b.top>=r.top+parseFloat(c.paddingTop)-1&&b.bottom<=r.bottom-parseFloat(c.paddingBottom)+1&&b.left>=r.left&&b.right<=r.right;});assert.equal(fits,true,JSON.stringify(await page.locator('.pdf-sheet').evaluate(n=>{const b=n.getBoundingClientRect(),s=document.querySelector('#reading-scroll');return {sheet:b.toJSON(),scroll:s.getBoundingClientRect().toJSON(),style:getComputedStyle(s).padding};})));
    await revealReader(page);await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await expect(page.locator('#reader-font')).toHaveCount(0);await page.locator('#line-guide-setting').check();await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();await expect(page.locator('#line-guide')).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false,JSON.stringify(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,vw:innerWidth,vh:innerHeight,overflow:[...document.querySelectorAll('body *')].filter(n=>{const b=n.getBoundingClientRect();return b.right>innerWidth+1||b.bottom>innerHeight+1;}).slice(0,12).map(n=>({tag:n.tagName,cls:n.className,box:n.getBoundingClientRect().toJSON()}))}))));assert.deepEqual(errors,[]);
    console.log(`BESTANDEN v1.5 ${name}: iPad-Menütaps ohne Umbruch, feste Theme-Farben, 15 Themes, 13 Schriften, lokale Schrift, Fettdruck, Line Guide, Folio/Glass/Papier hell/dunkel, Speicherung und PDF-Passung.`);
  }catch(e){await page.screenshot({path:`test-results/v15-failure-${name}.png`}).catch(()=>{});throw e;}finally{await context.close();}
}
