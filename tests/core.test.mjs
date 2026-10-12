import test from 'node:test';
import assert from 'node:assert/strict';
import {descendants,folderPath,searchBooks,percentage,resolvePath,validateBackup,locateQuote} from '../src/core.js';

test('Verschachtelte Collections finden alle Unterordner, auch bei ungeordneter Eingabe',()=>{
  const folders=[{id:'c',parent:'b',name:'Unterthema'},{id:'a',parent:null,name:'Wissen'},{id:'b',parent:'a',name:'Natur'},{id:'d',parent:null,name:'Andere'}];
  assert.deepEqual([...descendants(folders,'a')].sort(),['a','b','c']);
  assert.equal(folderPath(folders,'c'),'Wissen / Natur / Unterthema');
});
test('Volltextsuche findet Bücher und Textstellen unabhängig von Akzenten und Großschreibung',()=>{
  const books=[{id:'a',title:'Über das Lesen',author:'Folio',texts:['Eine Frage.','Verständnis wächst durch Aufmerksamkeit.']},{id:'b',title:'Natur',author:'Folio',texts:['Vögel beobachten.']}];
  assert.equal(searchBooks(books,'verstandnis')[0].page,1);
  assert.equal(searchBooks(books,'VOGEL')[0].bookId,'b');
  assert.equal(searchBooks(books,'über')[0].title,true);
  assert.deepEqual(searchBooks(books,'  '),[]);
});
test('Fortschritt trennt ungelesen, Lesestelle und abgeschlossen',()=>{
  assert.equal(percentage({status:'unread',started:false,page:0,total:5}),0);
  assert.equal(percentage({status:'reading',started:true,page:1,total:5}),40);
  assert.equal(percentage({status:'finished',page:1,total:5}),100);
});
test('EPUB-Dateipfade werden relativ zum Paket bzw. Kapitel aufgelöst',()=>{
  assert.equal(resolvePath('OEBPS/package.opf','Text/ch1.xhtml'),'OEBPS/Text/ch1.xhtml');
  assert.equal(resolvePath('OEBPS/Text/ch1.xhtml','../Images/test%20cover.png'),'OEBPS/Images/test cover.png');
});
test('Beschädigte Sicherungen, doppelte IDs und Collection-Kreise werden abgewiesen',()=>{
  const valid={format:'folio',version:1,books:[{id:'a',title:'A',format:'DEMO',total:1,pages:[{html:'<p>Text</p>'}],texts:['Text'],collections:[]}],folders:[],annotations:[]};
  assert.equal(validateBackup(valid),valid);
  assert.throws(()=>validateBackup({}),/gültige/);
  assert.throws(()=>validateBackup({...valid,books:[...valid.books,...valid.books]}),/Buchdaten/);
  assert.throws(()=>validateBackup({...valid,folders:[{id:'a',name:'A',parent:'b'},{id:'b',name:'B',parent:'a'}]}),/Kreis/);
  assert.throws(()=>validateBackup({...valid,annotations:[{id:'n',bookId:'a',type:'note',page:2}]}),/Notizen/);
});


test('Sicherungen erlauben keine HTML-Attribute in IDs oder Markierungsfarben',()=>{
  const valid={format:'folio',version:1,books:[{id:'book',title:'Buch',format:'PDF',total:1,texts:['Text'],collections:[]}],folders:[],annotations:[]};
  assert.throws(()=>validateBackup({...valid,books:[{...valid.books[0],id:'x\" onclick=\"run()'}]}),/Buchdaten/);
  assert.throws(()=>validateBackup({...valid,annotations:[{id:'note',bookId:'book',type:'highlight',page:0,color:'#fff\" onclick=\"run()'}]}),/Markierungsfarbe/);
});


// Book/chapter learning schedules and the mixed recall queue are pure data.
import {nextReview,dueLearning,mixedReview,readBookPlan,readChapterSession} from '../src/learning.js';
test('Verständnisstufen planen morgen, 7 oder 30 Tage und pausierte Bücher bleiben aus',()=>{
  const now=new Date(2026,9,10,12).getTime();
  assert.equal(new Date(nextReview(1,now)).getDate(),11);
  assert.equal(new Date(nextReview(3,now)).getDate(),17);
  assert.equal(new Date(nextReview(4,now)).getMonth(),10);
  const books=[{id:'a',status:'reading',learning:{chapters:{a:{due:now-1,title:'A'}}}},{id:'b',status:'paused',learning:{chapters:{b:{due:now-1,title:'B'}}}}];
  assert.equal(dueLearning(books,[],now).length,1);
});
test('Gemischter Abruf begrenzt und mischt ohne Duplikate oder Veränderung des Bestands',()=>{
  const pool=Array.from({length:8},(_,id)=>({id})),result=mixedReview(pool,5,()=>.1);
  assert.equal(result.length,5);assert.equal(new Set(result.map(x=>x.id)).size,5);assert.equal(pool[0].id,0);
});
test('Lernsitzung und Buchkompass behalten eigene Texte und Antworten',()=>{
  const plan=readBookPlan(new Map([['purpose',' Entscheidung treffen '],['question-0','Warum?'],['answer-0','Weil …'],['done-0','on']]));
  assert.equal(plan.purpose,'Entscheidung treffen');assert.equal(plan.questions[0].answer,'Weil …');assert.equal(plan.actions[0].done,true);
  const session=readChapterSession(new Map([['recall','Eigene Erklärung'],['understanding','3']]),{page:0,pages:[{chapter:'Kapitel A'}]},{} ,100000);
  assert.equal(session.recall,'Eigene Erklärung');assert.equal(session.understanding,3);assert.ok(session.due>100000);
});


test('Zitatmarkierungen werden trotz XHTML-Einrückung und Absatzwechseln wieder verankert',()=>{
  const text='Ein Gedanke\n  wird klar.Nächster Absatz.';
  const found=locateQuote(text,'Ein Gedanke wird klar.\nNächster Absatz.');
  assert.equal(found.start,0);assert.equal(found.end,text.length);
  assert.equal(locateQuote('Wort und Wort','Wort',8).start,9);
  assert.equal(locateQuote(text,'Nicht im Buch'),null);
});


import {resolvedAppearance,migrateAppearance} from '../src/appearance.js';
test('App-Darstellung respektiert helle, dunkle und automatische Wahl',()=>{
  assert.equal(resolvedAppearance({appTheme:'system'},true),'dark');
  assert.equal(resolvedAppearance({appTheme:'light'},true),'light');
  assert.equal(resolvedAppearance({appTheme:'dark'},false),'dark');
});
test('Darstellungsmigration vergrößert alte Standardgrößen und erhält persönliche Daten',()=>{
  const p=migrateAppearance({size:21,theme:'quiet',view:'table',animationStyle:'curl'});
  assert.equal(p.size,26);assert.equal(p.animationStyle,'page');assert.equal(p.view,'table');assert.equal(p.theme,'quiet');
  assert.equal(migrateAppearance({size:34,uiScale:1.4,typographyVersion:2}).size,34);
});

test('Neue Leseeinstellungen begrenzen fremde Werte und erhalten persönliche Auswahl',()=>{
  const p=migrateAppearance({typographyVersion:2,motionVersion:3,font:'Liberation Sans',theme:'midnight',appDesign:'glass',lineGuide:true,guideLines:3,guidePosition:92,boldText:true,animation:false});
  assert.equal(p.font,'Liberation Sans');assert.equal(p.theme,'midnight');assert.equal(p.appDesign,'glass');assert.equal(p.guideLines,3);assert.equal(p.guidePosition,92);assert.equal(p.animation,false);
  const bad=migrateAppearance({font:'url(https://other.invalid/font)',theme:'unknown',appDesign:'unknown',size:900,pageWidth:-1,guidePosition:Infinity,guideLines:200,boldText:'true',lineGuide:'false'});
  assert.equal(bad.font,'Georgia');assert.equal(bad.theme,'paper');assert.equal(bad.appDesign,'folio');assert.equal(bad.size,48);assert.equal(bad.pageWidth,380);assert.equal(bad.guidePosition,42);assert.equal(bad.guideLines,1);assert.equal(bad.lineGuide,false);assert.equal(bad.boldText,false);
});

import JSZip from 'jszip';
import {inspectArchive,readEntry} from '../src/archive.js';
import {chapterKey,chapterName,migrateLearning} from '../src/learning.js';
test('ZIP-Prüfung stoppt Pfadtraversierung, beschädigte Metadaten und übergroße entpackte Dateien',async()=>{
  const zip=new JSZip();zip.file('Text/a.xhtml','Text');
  const bytes=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
  assert.equal(inspectArchive(bytes).entries,2);
  const corrupted=bytes.slice(0),view=new DataView(corrupted);let at=0;
  while(view.getUint32(at,true)!==0x02014b50)at++;
  view.setUint32(at+24,25*1024**2,true);assert.throws(()=>inspectArchive(corrupted),/groß/);
  const traversal=new JSZip();traversal.file('../secret','x');
  const bad=await traversal.generateAsync({type:'arraybuffer'});assert.throws(()=>inspectArchive(bad),/Dateipfade/);
  assert.throws(()=>inspectArchive(new ArrayBuffer(5)),/ZIP/);
  await assert.rejects(readEntry(zip.file('Text/a.xhtml'),2),/Größenlimit/);
  assert.equal(await readEntry(zip.file('Text/a.xhtml'),4),'Text');
});
test('Kapitel mit gleichem Titel behalten getrennte Einträge und EPUB-Anker eigene Schlüssel',()=>{
  const book={format:'EPUB',page:0,locationOffset:250,pages:[{href:'chapter.xhtml',chapter:'Einleitung',segments:[{title:'Erstes Kapitel',offset:0,anchor:'a'},{title:'Zweites Kapitel',offset:200,anchor:'b'}]}]};
  assert.equal(chapterName(book),'Zweites Kapitel');assert.equal(chapterKey(book),'chapter-chapter.xhtml#b');
  book.locationOffset=10;assert.equal(chapterKey(book),'chapter-chapter.xhtml');
  const demo=migrateLearning({format:'DEMO',page:1,pages:[{chapter:'Gleich'},{chapter:'Gleich'}],learning:{chapters:{'chapter-Gleich':{page:1,recall:'Mein Gedanke'}}}});
  assert.equal(demo.learning.chapters['chapter-index-1'].recall,'Mein Gedanke');assert.equal(chapterKey(demo),'chapter-index-1');
});
test('Suche behält Originaloffsets bei zerlegten Akzenten und Cache wird bei neuem Text korrekt verwendet',()=>{
  const book={id:'a',title:'A',texts:['Cafe\u0301 und Idee']};assert.equal(searchBooks([book],'idee')[0].offset,10);
  book.texts[0]='Neue Idee';assert.equal(searchBooks([book],'idee')[0].offset,5);
});
test('Sicherungen weisen ungültige Lerndaten, Prototype-Schlüssel und doppelte Notizen zurück',()=>{
  const valid={format:'folio',version:1,books:[{id:'book',title:'Buch',format:'PDF',total:1,texts:['Text'],collections:[]}],folders:[],annotations:[]};
  assert.throws(()=>validateBackup({...valid,books:[{...valid.books[0],learning:{chapters:{x:{understanding:9}}}}]}),/Lerndaten/);
  assert.throws(()=>validateBackup({...valid,settings:JSON.parse('{"__proto__":{"x":true}}')}),/Unsichere/);
  const note={id:'n',bookId:'book',type:'note',page:0};assert.throws(()=>validateBackup({...valid,annotations:[note,note]}),/Doppelte/);
  assert.throws(()=>validateBackup({...valid,drafts:[{bookId:'book',values:'bad'}]}),/Formularentwürfe/);
});


import {prepareBookFiles} from '../src/formats.js';
import {readBookBytes} from '../src/file-bytes.js';
import {epubFixture,pdfFixture} from './fixtures.mjs';
test('Buchimport erkennt .epub.zip nach Inhalt und entpackt Buchdateien aus ZIPs',async()=>{
  const epub=await epubFixture(),renamed=new File([epub],'Buch.epub.zip',{type:'application/zip'});
  assert.equal((await prepareBookFiles(renamed))[0],renamed);
  const pdf=new File([pdfFixture()],'Buch.download',{type:'application/octet-stream'});assert.equal((await prepareBookFiles(pdf))[0],pdf);
  const zip=new JSZip();zip.file('Buecher/Buch.epub',epub);zip.file('Buecher/Quelle.pdf',pdfFixture());zip.file('__MACOSX/._Buch.epub','ignore');
  const files=await prepareBookFiles(new File([await zip.generateAsync({type:'arraybuffer'})],'Buecher.zip'));
  assert.deepEqual(files.map(f=>f.name),['Buch.epub','Quelle.pdf']);assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()),new Uint8Array(epub));
});
test('Dateipaket wird einmal vollständig gelesen, auch mit unbrauchbaren Teilreads und abweichender Größenmetadaten',async()=>{
 const sourceBytes=await epubFixture(),bytes=sourceBytes.buffer.slice(sourceBytes.byteOffset,sourceBytes.byteOffset+sourceBytes.byteLength);let count=0;
 const provider={name:'Buch.epub.zip',size:7*1024**2,type:'application/zip',slice(){throw new Error('Teilread nicht verfügbar');},async arrayBuffer(){count++;if(count>1)throw new Error('Dateizugriff abgelaufen');return bytes;}};
 assert.equal((await prepareBookFiles(provider))[0],provider);assert.equal(await readBookBytes(provider),bytes);assert.equal(count,1);
 const pdf=pdfFixture();const source={name:'Quelle.pdf',size:pdf.byteLength,async arrayBuffer(){return pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength);},slice(){throw new Error('Kein Teilread');}};assert.equal((await prepareBookFiles(source))[0],source);
});
test('Leere oder nicht lesbare Dateiauswahl wird erklärt und lässt einen erneuten Zugriff zu',async()=>{
 let empty=true;const sourceBytes=await epubFixture(),bytes=sourceBytes.buffer.slice(sourceBytes.byteOffset,sourceBytes.byteOffset+sourceBytes.byteLength),file={size:0,name:'Cloud.epub',arrayBuffer:async()=>empty?new ArrayBuffer(0):bytes};
 await assert.rejects(prepareBookFiles(file),/leere Datei/);empty=false;assert.equal((await prepareBookFiles(file))[0],file);
 await assert.rejects(readBookBytes({size:20,arrayBuffer:async()=>{throw new Error('nicht lesbar');}}),/vollständig gelesen/);
});
test('ZIP-Buch mit anfänglichem Stream-Marker wird nach echter Archivstruktur erkannt',async()=>{
 const source=await epubFixture(),buffer=new ArrayBuffer(source.byteLength+4),data=new Uint8Array(buffer);data.set([0x50,0x4b,7,8]);data.set(source,4);const view=new DataView(buffer),end=buffer.byteLength-22,start=view.getUint32(end+16,true)+4;view.setUint32(end+16,start,true);
 let cursor=start;for(let n=0;n<view.getUint16(end+10,true);n++){view.setUint32(cursor+42,view.getUint32(cursor+42,true)+4,true);cursor+=46+view.getUint16(cursor+28,true)+view.getUint16(cursor+30,true)+view.getUint16(cursor+32,true);}
 const file=new File([buffer],'Stream.epub.zip',{type:'application/zip'});assert.equal((await prepareBookFiles(file))[0],file);
 const invalid=new File(['ZIP-Dateiname allein reicht nicht'],'Stream.epub.zip');await assert.rejects(prepareBookFiles(invalid),/ZIP-Archiv/);
});
test('Buch-ZIPs behalten Grenzen und Pfadprüfung; ungültige Dateien werden erklärt',async()=>{
  await assert.rejects(prepareBookFiles(new File(['keine Buchdatei'],'Buch.epub.zip')),/ZIP-Archiv/);
  const zip=new JSZip();zip.file('readme.txt','Text');await assert.rejects(prepareBookFiles(new File([await zip.generateAsync({type:'arraybuffer'})],'datei.zip')),/kein lesbares/);
  const many=new JSZip();for(let n=0;n<21;n++)many.file(`Buch${n}.epub`,await epubFixture());await assert.rejects(prepareBookFiles(new File([await many.generateAsync({type:'arraybuffer'})],'viele.zip')),/20 Bücher/);
  const malicious=new JSZip();malicious.file('../Buch.epub',await epubFixture());await assert.rejects(prepareBookFiles(new File([await malicious.generateAsync({type:'arraybuffer'})],'pfade.zip')),/Unsichere/);
});

import {isNewerVersion} from '../src/app-updates.js';
test('Versionsprüfung erkennt nur neuere gültige App-Stände',()=>{
  assert.equal(isNewerVersion('1.10.0','1.9.0'),true);assert.equal(isNewerVersion('1.9.0','1.10.0'),false);assert.equal(isNewerVersion('2.0.0','1.9.0'),true);assert.equal(isNewerVersion('1.9.0','1.9.0'),false);assert.equal(isNewerVersion('<img onerror=run()>','1.9.0'),false);assert.equal(isNewerVersion('1.9.1-beta','1.9.0'),false);
});

import {findEPUBPackage,scopeEPUB} from '../src/epub-package.js';
test('EPUB-Bündel mit äußerem Ordner werden unverändert erkannt und relativ gelesen',async()=>{
  const original=await JSZip.loadAsync(await epubFixture()),zip=new JSZip();
  for(const entry of Object.values(original.files))if(!entry.dir)zip.file('7 Strategies.epub/'+entry.name,await entry.async('uint8array'));
  zip.file('__MACOSX/7 Strategies.epub/._container.xml','ignore');
  const bytes=await zip.generateAsync({type:'arraybuffer'}),file=new File([bytes],'7 Strategies.epub.zip');assert.equal((await prepareBookFiles(file))[0],file);
  const loaded=await JSZip.loadAsync(bytes),info=findEPUBPackage(loaded);assert.equal(info.prefix,'7 Strategies.epub/');assert.match(await readEntry(scopeEPUB(loaded,info).file('OPS/book.opf')),/EPUB Lernprobe/);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),new Uint8Array(bytes));
});
test('EPUB-Metadaten erkennen sichere Schreibvarianten und OPF, ohne zwischen Büchern zu raten',async()=>{
  const zip=new JSZip();zip.file('Buch.epub/meta-inf/Container.XML','metadata');zip.file('Buch.epub/OPS/BOOK.OPF','package');zip.file('Buch.epub/meta-inf/Encryption.XML','protected');const info=findEPUBPackage(zip),book=scopeEPUB(zip,info);
  assert.equal(book.file('META-INF/container.xml').name,'Buch.epub/meta-inf/Container.XML');assert.equal(book.file('OPS/book.opf').name,'Buch.epub/OPS/BOOK.OPF');assert.equal(book.encryption.length,1);
  const recovered=new JSZip();recovered.file('Outer/OPS/content.opf','package');assert.equal(findEPUBPackage(recovered).packagePath,'Outer/OPS/content.opf');
  zip.file('Other.epub/META-INF/container.xml','metadata');assert.throws(()=>findEPUBPackage(zip),/mehrdeutig/);
});
