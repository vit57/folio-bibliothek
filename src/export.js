import {percentage,folderPath} from './core.js';
import {chapterSource,readBookPlan,understanding} from './learning.js';

export const entryNames={highlight:'Markierung',note:'Notiz',bookmark:'Lesezeichen',question:'Frage',lesson:'Erkenntnis',flashcard:'Lernkarte',task:'Aufgabe'};
const statusNames={unread:'Ungelesen',reading:'Wird gelesen',paused:'Pausiert',finished:'Gelesen'};
const date=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('de-DE'):'';
const isoDate=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toISOString().slice(0,10):'';
export function exportFilename(title,id=''){
  const clean=String(title).normalize('NFKC').replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').replace(/^\.+|\.+$/g,'').trim();
  let prefix='',bytes=0;const encoder=new TextEncoder();for(const char of clean){bytes+=encoder.encode(char).length;if(bytes>90)break;prefix+=char;}
  return (prefix||'Buch')+(id?`-${String(id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,128)}`:'');
}
export const markdownText=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]#!|])/g,'\\$1').replace(/^([ \t]*)([+>-]|\d+\.) /gm,'$1\\$2 ');
export const csvCell=value=>`"${String(value??'').replace(/^\s*([=+\-@])/,'\'$1').replace(/"/g,'""')}"`;
const csv=rows=>rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
export function entrySource(book,entry){return chapterSource({...book,page:entry.page,sourceFocusOffset:entry.start??entry.locationOffset??0});}
function sourceForKey(book,key){
  if(book.format==='PDF')return chapterSource({...book,page:Number(key.slice(4))});
  for(let page=0;page<book.total;page++)for(const segment of book.pages?.[page]?.segments||[{offset:0}]){const source=chapterSource({...book,page,sourceFocusOffset:segment.offset});if(source.key===key)return source;}
  return {key,title:key,page:0,offset:0};
}
const sessionFields={goal:'Ziel',recall:'Freier Abruf',missing:'Lücken / offene Punkte',correction:'Korrektur / Erklärung',transfer:'Übertragung auf einen neuen Fall',notes:'Freie Notizen'};
export function exportDocuments({books,annotations,folders=[],drafts=[],bookId=null,scope='book',includeDrafts=true}){
  const byBook=new Map(),byDraft=new Map();
  for(const entry of annotations){if(!byBook.has(entry.bookId))byBook.set(entry.bookId,[]);byBook.get(entry.bookId).push(entry);}
  for(const draft of drafts){if(!byDraft.has(draft.bookId))byDraft.set(draft.bookId,[]);byDraft.get(draft.bookId).push(draft);}
  return books.filter(b=>!bookId||b.id===bookId).map(book=>{
    const source=scope==='chapter'?chapterSource(book):null;
    const entries=(byBook.get(book.id)||[]).filter(a=>!source||entrySource(book,a).key===source.key).sort((a,b)=>a.page-b.page||(a.start??a.locationOffset??0)-(b.start??b.locationOffset??0)||a.created-b.created);
    const chapters=Object.entries(book.learning?.chapters||{}).filter(([key,s])=>!source||key===source.key||s.sourceKey===source.key).map(([key,s])=>({...s,key}));
    const blocks=[],add=(type,text)=>{if(text!==undefined&&text!==null&&String(text).trim())blocks.push({type,text:String(text)});};
    add('title',book.title);add('meta',`${book.author} · ${book.format==='DEMO'?'Leseprobe':book.format}${source?` · ${source.title}`:''}`);
    add('meta',`${book.reference?'Nachschlagewerk':statusNames[book.status]} · ${percentage(book)} % gelesen${book.learning?.plan?.rating?` · Bewertung ${book.learning.plan.rating}/5`:''}`);
    if(book.tags?.length)add('meta',`Tags: ${book.tags.join(', ')}`);
    if(book.year)add('meta',`Erscheinungsjahr: ${book.year}`);
    if(book.link)add('meta',`Quelle: ${book.link}`);
    if(book.collections?.length)add('meta',`Collections: ${book.collections.map(id=>folderPath(folders,id)).filter(Boolean).join(' · ')}`);
    if(book.targetPage)add('meta',`Leseziel: ${book.format==='PDF'?'Seite':'Abschnitt'} ${book.targetPage}${book.targetDate?` bis ${book.targetDate}`:''}`);
    const writePlan=(p,label)=>{
      if(!p)return;add('h2',label);
      for(const [key,title] of Object.entries({purpose:'Warum ich lese',outcome:'Was ich können möchte',liked:'Was mir gefallen hat',critique:'Kritischer Blick',insight:'Wichtigste Erkenntnis',takeaway:'Was bleibt',recommendation:'Empfehlung'}))if(p[key]){add('h3',title);add('text',p[key]);}
      for(const q of p.questions||[])if(q.question||q.answer){add('h3',`Leitfrage: ${q.question||'Offen'}`);add('text',q.answer||'Noch nicht beantwortet.');}
      for(const a of p.actions||[])if(a.change||a.when)add('text',`${a.done?'Erledigt':'Geplant'}: ${a.change}${a.when?` · Wann: ${a.when}`:''}`);
      const checks=[['explained','Kernaussagen erklärt'],['answered','Leitfragen beantwortet'],['transferred','Auf Neues übertragen'],['revisited','Erneut abgerufen']];
      add('meta',checks.map(([key,label])=>`${p[key]?'Ja':'Nein'}: ${label}`).join(' · '));
    };
    const writeSession=(s,label)=>{
      add('h2',label);add('meta',`${book.format==='PDF'?'Seite':'Abschnitt'} ${(s.page??0)+1} · Textposition ${s.sourceOffset??0}${s.updated?` · Gespeichert ${date(s.updated)}`:''}`);
      for(const [key,title] of Object.entries(sessionFields))if(s[key]){add('h3',title);add('text',s[key]);}
      add('meta',`Verständnis: ${understanding[s.understanding]?.label||'Noch nicht eingeschätzt'}${s.due?` · Wiederholung: ${date(s.due)}`:''}`);
      for(const h of s.history||[]){add('h3',`Früherer Abruf · ${date(h.updated)}`);add('text',h.recall);add('meta',understanding[h.understanding]?.label);}
    };
    if(!source)writePlan(book.learning?.plan,'Mein Buchkompass');
    for(const s of chapters)writeSession(s,s.title||sourceForKey(book,s.key).title);
    let draftCount=0;
    if(includeDrafts)for(const draft of (byDraft.get(book.id)||[]).filter(d=>!source||d.mode==='chapter'&&d.key===source.key)){
      draftCount++;const values=new Map(draft.values);
      if(draft.mode==='book')writePlan(readBookPlan(values),'Buchkompass · Entwurf (noch nicht abgeschlossen)');
      else {const ds=sourceForKey(book,draft.key);writeSession({...Object.fromEntries(Object.keys(sessionFields).map(k=>[k,values.get(k)||''])),page:ds.page,sourceOffset:ds.offset,understanding:values.get('understanding')===''?undefined:Number(values.get('understanding')),updated:draft.updated},`${ds.title} · Entwurf (noch nicht abgeschlossen)`);}
    }
    add('h2',`Fundstücke · ${entries.length}`);
    if(!entries.length)add('text','Noch keine Markierungen, Notizen, Fragen oder Lesezeichen in dieser Auswahl.');
    for(const entry of entries){
      const at=entrySource(book,entry);add('h3',`${entryNames[entry.type]} · ${at.title}`);
      add('meta',`${book.format==='PDF'?'Seite':'Abschnitt'} ${entry.page+1} · ${date(entry.created)}${entry.color?` · Farbe ${entry.color}`:''}${entry.type==='task'?` · ${entry.completed?'Erledigt':'Offen'}`:''}`);
      add('quote',entry.quote);add('text',entry.text);
      if(entry.answer){add('h3',entry.type==='flashcard'?'Antwort der Lernkarte':'Antwort / eigener Gedanke');add('text',entry.answer);}
      if(entry.lastRecall){add('h3','Letzter freier Abruf');add('text',entry.lastRecall);}
      if(entry.due)add('meta',`Nächster Abruf: ${date(entry.due)}`);
      if(entry.rects?.length)add('meta',`PDF-Bereich: ${entry.rects.map(r=>`x=${r.x.toFixed(3)}, y=${r.y.toFixed(3)}, Breite=${r.w.toFixed(3)}, Höhe=${r.h.toFixed(3)}`).join('; ')}`);
      if(entry.start!==undefined)add('meta',`Textposition: ${entry.start}–${entry.end}`);
    }
    return {book,source,entries,chapters,draftCount,blocks};
  });
}
export function documentsMarkdown(documents,limit=Infinity){
  let output='';
  for(const [index,document] of documents.entries()){
    if(index)output+='\n\n---\n\n';
    for(const block of document.blocks){
      const text=markdownText(block.text.slice(0,Number.isFinite(limit)?Math.max(0,limit-output.length):undefined));
      const rendered=block.type==='title'?`# ${text}`:block.type==='h2'?`## ${text}`:block.type==='h3'?`### ${text}`:block.type==='quote'?`> ${text.replace(/\n/g,'\n> ')}`:text;
      output+=rendered+'\n\n';if(output.length>=limit)return output.slice(0,limit)+'\n…';
    }
  }
  return output.trimEnd()+'\n';
}

export function notionTables(documents){
  return {
    'Books.csv':csv([['Name','Author','Status','Rating','Year','Link','Pin','Current Page','Target Page','Tags (Text)','What? Why? When?','Progress (%)','Leseziel Datum'],...documents.map(({book:b})=>[b.title,b.author,b.reference?'Reference Book':({unread:'Not started',reading:'In progress',paused:'Paused',finished:'Done'})[b.status],b.learning?.plan?.rating?b.learning.plan.rating*20:'',b.year||'',b.link||'',b.favorite?'Yes':'No',b.started?b.page+1:0,b.targetPage||'',b.tags?.join(', ')||'',b.learning?.plan?.purpose||'',percentage(b),b.targetDate||''])]),
    'Chapters.csv':csv([['Name','Book','Source','Text Offset','Goal','Recall','Missing','Correction','Transfer','Notes','Understanding','Next Review'],...documents.flatMap(({book,chapters})=>chapters.map(s=>[s.title,book.title,s.page+1,s.sourceOffset||0,s.goal,s.recall,s.missing,s.correction,s.transfer,s.notes,understanding[s.understanding]?.label||'',isoDate(s.due)]))]),
    'Fundstücke.csv':csv([['Name','Book','Chapter','Source','Type','Quote','Notes','Answer','Color','Done'],...documents.flatMap(({book,entries})=>entries.map(a=>[a.text||a.quote||entryNames[a.type],book.title,entrySource(book,a).title,a.page+1,entryNames[a.type],a.quote,a.text,a.answer,a.color,a.type==='task'?(a.completed?'Yes':'No'):'']))])
  };
}
