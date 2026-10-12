import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportDocuments,documentsMarkdown,notionTables,exportFilename,csvCell} from '../src/export.js';
import {chapterSource} from '../src/learning.js';
import {validateBackup} from '../src/core.js';

const book={id:'book-a',title:'Bücher & Fragen',author:'Autor',format:'EPUB',total:1,page:0,started:true,status:'reading',collections:[],pages:[{href:'chapter.xhtml',html:'<p>Text</p>',chapter:'Erstes Kapitel',segments:[{offset:0,title:'Erstes Kapitel'},{offset:100,anchor:'second',title:'Zweites Kapitel'}]}],texts:['Text'],locationOffset:0};
const first=chapterSource(book),second=chapterSource({...book,sourceFocusOffset:120});
const annotations=['highlight','note','question','bookmark','lesson','flashcard','task'].map((type,index)=>({id:`entry-${index}`,bookId:book.id,page:0,type,text:type,quote:'äöü <script>alert(1)</script>',answer:'Eigene Antwort',start:20,end:30,created:10}));
annotations.push({id:'other',bookId:book.id,page:0,type:'note',text:'Nur zweites Kapitel',start:150,end:160,created:10});
const learning={plan:{purpose:'Lesen lernen',outcome:'Verstehen',rating:4,actions:[{change:'Üben',when:'Morgen',done:true}],questions:[{question:'Warum?',answer:'Darum'}],takeaway:'Eigener Text'},chapters:{[first.key]:{title:first.title,page:0,sourceKey:first.key,recall:'Erste Erklärung',history:[{updated:10,recall:'Alte Erklärung'}]},[second.key]:{title:second.title,page:0,sourceKey:second.key,sourceOffset:100,recall:'Zweite Erklärung'}}};
const drafts=[{bookId:book.id,mode:'chapter',key:first.key,updated:10,values:[['goal','Entwurfsziel'],['recall','Noch nicht abgeschlossen'],['understanding','']]}];
const data={books:[{...book,learning}],annotations,drafts};
test('Markdown enthält alle Fundstücktypen, Buchkompass, Abrufverlauf und deutlich markierte Entwürfe',()=>{
 const docs=exportDocuments(data),md=documentsMarkdown(docs);
 assert.equal(docs[0].entries.length,8);assert.equal(docs[0].chapters.length,2);
 for(const value of ['Lesezeichen','Lernkarte','Aufgabe','Lesen lernen','Alte Erklärung','Entwurf','Noch nicht abgeschlossen','Eigene Antwort'])assert.ok(md.includes(value),value);
 assert.ok(!md.includes('<script>'));assert.ok(md.includes('&lt;script&gt;'));
 assert.equal(exportDocuments({...data,includeDrafts:false})[0].draftCount,0);
});
test('Kapitelexport nutzt Textanker statt nur Abschnittsnummer und vermischt keine Kapitel',()=>{
 const docs=exportDocuments({...data,bookId:book.id,scope:'chapter'}),md=documentsMarkdown(docs);
 assert.equal(docs[0].entries.length,7);assert.equal(docs[0].chapters.length,1);assert.ok(!md.includes('Nur zweites Kapitel'));assert.ok(!md.includes('Zweite Erklärung'));assert.ok(!md.includes('Mein Buchkompass'));
 const next=exportDocuments({...data,books:[{...book,learning,sourceFocusOffset:120}],scope:'chapter'});
 assert.equal(next[0].entries.length,1);assert.equal(next[0].draftCount,0);
});
test('PDF-Auswahl bleibt auf der tatsächlichen Seite und behält Bereichskoordinaten',()=>{
 const pdf={...book,format:'PDF',total:2,page:1,learning:undefined},entry={id:'pdf',bookId:book.id,page:1,type:'highlight',rects:[{x:.1,y:.2,w:.3,h:.1}],created:10};
 const docs=exportDocuments({books:[pdf],annotations:[...annotations,entry],scope:'chapter'});
 assert.equal(docs[0].entries.length,1);assert.ok(documentsMarkdown(docs).includes('x=0.100'));
});
test('Notion-CSV passt zum Books-Schema, skaliert Bewertung und entschärft Formeln',()=>{
 const tables=notionTables(exportDocuments({...data,books:[{...book,learning,title:'=HYPERLINK("evil")',reference:true,tags:['Wissen'],year:2026}]}));
 assert.match(tables['Books.csv'],/"Name","Author","Status","Rating","Year","Link","Pin","Current Page","Target Page"/);
 assert.match(tables['Books.csv'],/Reference Book","80","2026/);assert.ok(tables['Books.csv'].includes("'=HYPERLINK"));assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
});
test('Exportdateien können keine Verzeichnisse erzeugen; gleichlautende Bücher behalten separate Dateien',()=>{
 assert.ok(!exportFilename('../../evil/Book',book.id).includes('/'));
 assert.notEqual(exportFilename('Gleich','same-prefix-first'),exportFilename('Gleich','same-prefix-second'));
 assert.ok(Buffer.byteLength(exportFilename('📖'.repeat(100),'a'.repeat(128))+'.md')<255);
});
test('Neue Buchfelder werden bei fremden Sicherungen geprüft',()=>{
 const backup={format:'folio',version:1,books:[book],folders:[],annotations:[]};
 for(const change of [{tags:['ok',{}]},{reference:'yes'},{targetPage:20},{link:'javascript:evil'},{year:'2026'}])assert.throws(()=>validateBackup({...backup,books:[{...book,...change}]}));
 assert.doesNotThrow(()=>validateBackup({...backup,books:[{...book,tags:['Wissen'],reference:true,year:2026,targetPage:1,targetDate:'2026-10-10',link:'https://example.com'}]}));
});
test('Die Vorschau bleibt kurz, während der heruntergeladene Markdown-Export alle Texte enthält',()=>{
 const docs=exportDocuments({...data,annotations:[{...annotations[0],text:'Langer Gedanke '.repeat(5000)+' ENDE-DER-NOTIZ'}]});
 const preview=documentsMarkdown(docs,6000),full=documentsMarkdown(docs);
 assert.ok(preview.length<=6002);assert.ok(!preview.includes('ENDE-DER-NOTIZ'));assert.ok(full.includes('ENDE-DER-NOTIZ'));
});

test('Ein fehlender oder nicht darstellbarer alter Termin verhindert den Export nicht',()=>{
 const docs=exportDocuments({...data,books:[{...book,learning:{chapters:{[first.key]:{title:first.title,page:0,due:Number.MAX_VALUE,updated:Number.MAX_VALUE}}}}]});
 assert.doesNotThrow(()=>notionTables(docs));assert.ok(!documentsMarkdown(docs).includes('Invalid Date'));
});
