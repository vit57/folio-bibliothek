import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {paginationFixture} from './fixtures.mjs';
import {revealReader} from './reader-v15.mjs';

const luminance=rgb=>{const v=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
export async function readerV16(browser,url,options={}){
  const tablet=!!options.isMobile,name=tablet?'ipad':'mac',context=await browser.newContext({viewport:{width:1440,height:1080},...options,acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url);await page.locator('.book-card').first().waitFor();if(tablet)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
    await expect(page.locator('.design-choice')).toHaveCount(8);
    for(const design of ['folio','glass','realpaper','aged','antique','editorial','library','magic']){
      await page.locator(`[data-action="app-design:${design}"]`).click();await page.getByRole('button',{name:'Fertig',exact:true}).click();if(tablet)await page.getByRole('button',{name:'Navigation schließen',exact:true}).click();
      const color=await page.locator('.continue-card').evaluate(n=>({bg:getComputedStyle(n).backgroundColor,metadata:getComputedStyle(n.querySelector('.continue-copy p')).color,progress:getComputedStyle(n.querySelector('.continue-progress>span:last-child')).color,bar:getComputedStyle(n.querySelector('.progress-track')).height}));assert.ok(ratio(color.bg,color.metadata)>=4.5,JSON.stringify({design,...color}));assert.ok(ratio(color.bg,color.progress)>=4.5);assert.ok(parseFloat(color.bar)>=6);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await expect(page.locator('.book-card').last()).toHaveCSS('opacity','1');if(['aged','antique','editorial','library','magic'].includes(design))await page.screenshot({path:`test-results/v16-${design}-${name}.png`});
      await page.getByRole('button',{name:'Dunklen Modus einschalten',exact:true}).click();
      const dark=await page.locator('.continue-card').evaluate(n=>({bg:getComputedStyle(n).backgroundColor,metadata:getComputedStyle(n.querySelector('.continue-copy p')).color,progress:getComputedStyle(n.querySelector('.continue-progress>span:last-child')).color}));assert.ok(ratio(dark.bg,dark.metadata)>=4.5,JSON.stringify({design,dark}));assert.ok(ratio(dark.bg,dark.progress)>=4.5);
      await page.getByRole('button',{name:'Hellen Modus einschalten',exact:true}).click();
      if(tablet)await page.getByRole('button',{name:'Navigation ein-/ausblenden',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
    }
    await page.locator('#ambient-motion').uncheck();await expect(page.locator('html')).toHaveAttribute('data-ambient','false');await page.getByRole('button',{name:'Fertig',exact:true}).click();if(tablet)await page.getByRole('button',{name:'Navigation schließen',exact:true}).click();
    await page.locator('#file-input').setInputFiles({name:'v16-pages.epub',mimeType:'application/epub+zip',buffer:await paginationFixture()});await page.locator('.book-title',{hasText:'EPUB Lernprobe'}).click();await revealReader(page);
    // Bookmark has an explicit, visibly filled pressed state and survives reload.
    await page.getByRole('button',{name:'Lesezeichen setzen',exact:true}).click();const marked=page.getByRole('button',{name:'Lesezeichen entfernen',exact:true});await expect(marked).toHaveAttribute('aria-pressed','true');assert.notEqual(await marked.locator('svg').evaluate(n=>getComputedStyle(n).fill),'none');
    const before=await page.locator('.reader-header').boundingBox();assert.ok(before.y>=0&&before.y+before.height<=page.viewportSize().height);
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#animation-style').selectOption('page');
    await page.locator('#reader-size').evaluate(n=>{n.value='32';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('.type-preview p').first()).toHaveCSS('font-size','32px');
    await page.locator('#reader-leading').evaluate(n=>{n.value='2';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('.type-preview p').first()).toHaveCSS('line-height','64px');
    await page.locator('#reader-tracking').evaluate(n=>{n.value='0.02';n.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#reader-alignment').selectOption('justify');await expect(page.locator('.type-preview p').first()).toHaveCSS('text-align','justify');
    const preview=await page.locator('.settings-preview-column').boundingBox();await page.locator('.reader-settings-controls').evaluate(n=>n.scrollTop=n.scrollHeight);assert.deepEqual(await page.locator('.settings-preview-column').boundingBox(),preview);
    await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    const initial=await page.locator('#leaf-position').textContent();await page.getByRole('button',{name:'Nächste Seite',exact:true}).click();await page.locator('.book-turn-layer').waitFor({state:'detached'});await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();await page.locator('.book-turn-layer[data-direction=backward]').waitFor();
    assert.ok(await page.locator('.book-turn-incoming .book-snapshot-sheet').count()===1);await page.locator('.book-turn-layer').waitFor({state:'detached'});assert.equal(await page.locator('#leaf-position').textContent(),initial);await expect(page.getByRole('button',{name:'Lesezeichen entfernen',exact:true})).toHaveAttribute('aria-pressed','true');
    // Cross a section, then return to the last screen page of the previous one.
    await page.locator('#page-number').fill('2');await page.locator('#page-number').press('Tab');await expect(page.locator('#page-number')).toHaveValue('2');await page.getByRole('button',{name:'Vorherige Seite',exact:true}).click();await page.locator('.book-turn-layer').waitFor({state:'detached'});await expect(page.locator('#page-number')).toHaveValue('1');const position=await page.locator('#leaf-position').textContent(),m=position.match(/Leseseite (\d+) \/ (\d+)/);assert.equal(m[1],m[2]);
    await page.getByRole('button',{name:'Themes & Darstellung',exact:true}).click();await page.locator('#animation-setting').uncheck();await page.locator('#line-guide-setting').check();await page.locator('[data-action="guide-lines:1"]').click();await page.getByRole('button',{name:'Darstellung schließen',exact:true}).click();
    await expect(page.locator('.line-guide-band')).toBeVisible();const firstLine=Number(await page.locator('#line-guide').getAttribute('data-line')),stage=await page.locator('#reading-scroll').boundingBox();await page.mouse.click(stage.x+5,stage.y+100);assert.equal(Number(await page.locator('#line-guide').getAttribute('data-line')),firstLine+1);
    const band=await page.locator('.line-guide-band').boundingBox(),window=await page.locator('.epub-window').boundingBox();assert.ok(band.width<=window.width+14);await page.screenshot({path:`test-results/v16-line-guide-${name}.png`});
    await page.getByRole('button',{name:'Eine Zeile zurück',exact:true}).click();assert.equal(Number(await page.locator('#line-guide').getAttribute('data-line')),firstLine);
    await page.getByRole('button',{name:'Lesemenü öffnen',exact:true}).filter({visible:true}).last().click();await expect(page.locator('.reader-quick-menu')).toBeVisible();await page.getByRole('menuitem',{name:'Bedienelemente anzeigen',exact:true}).click();await expect(page.locator('.reader-header')).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
    assert.deepEqual(errors,[]);console.log(`BESTANDEN v1.6 ${name}: Hero-Kontrast in 8 Designs hell/dunkel, 5 neue Welten, Bookmark-Füllung, Live-Vorschau, Richtung der Rückwärtsanimation, Abschnittsrücksprung, zeilengenaue Taps, iPad-Kopfzeile.`);
  }catch(e){await page.screenshot({path:`test-results/v16-failure-${name}.png`}).catch(()=>{});throw e;}finally{await context.close();}
}
