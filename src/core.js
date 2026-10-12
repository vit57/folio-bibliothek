export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const normalize = s => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
export const percentage = book => book.status === 'finished' ? 100 : book.started ? Math.round(((book.page || 0) + (book.sectionProgress ?? 1)) / Math.max(1, book.total) * 100) : 0;
export function descendants(folders, id) {
  const found = new Set([id]);
  let change = true;
  while (change) { change = false; for (const f of folders) if (found.has(f.parent) && !found.has(f.id)) { found.add(f.id); change = true; } }
  return found;
}
export function folderPath(folders, id) {
  const path = [], seen = new Set();
  while (id && !seen.has(id)) { seen.add(id); const f = folders.find(f => f.id === id); if (!f) break; path.unshift(f.name); id = f.parent; }
  return path.join(' / ');
}
const searchCache=new Map();let cachedCharacters=0;
function indexedText(text){
  if(searchCache.has(text)){const value=searchCache.get(text);searchCache.delete(text);searchCache.set(text,value);return value;}
  const value=normalize(text);
  if(text.length<2000000){searchCache.set(text,value);cachedCharacters+=value.length;while(cachedCharacters>8000000){const first=searchCache.keys().next().value;cachedCharacters-=searchCache.get(first).length;searchCache.delete(first);}}
  return value;
}
export function originalOffset(text,normalizedOffset){let normalized=0,source=0;for(const char of text){if(normalized>=normalizedOffset)break;normalized+=normalize(char).length;source+=char.length;}return source;}
export function searchBooks(books, query, limit = 100) {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const result = [];
  for (const book of books) {
    if (normalize(`${book.title} ${book.author} ${(book.tags||[]).join(' ')}`).includes(needle)) result.push({bookId:book.id, page:book.page || 0, title:true, excerpt:`${book.title} · ${book.author}${book.tags?.length?` · ${book.tags.join(', ')}`:''}`});
    for (const [page, text] of (book.texts || []).entries()) {
      const found=indexedText(text).indexOf(needle),at=found<0?-1:originalOffset(text,found);
      if (at >= 0) result.push({bookId:book.id, page, offset:at, excerpt:`${at > 75 ? '…' : ''}${text.slice(Math.max(0, at - 75), at + needle.length + 150)}${at + needle.length + 150 < text.length ? '…' : ''}`});
      if (result.length >= limit) return result;
    }
  }
  return result;
}
export function resolvePath(base, href) {
  const parts = `${base.substring(0, base.lastIndexOf('/') + 1)}${decodeURIComponent(href.split('#')[0])}`.split('/'), out = [];
  for (const part of parts) { if (part === '..') out.pop(); else if (part && part !== '.') out.push(part); }
  return out.join('/');
}
export function locateQuote(text,quote,preferred=0) {
  if(!quote)return null;
  const candidates=[];
  let at=text.indexOf(quote);
  while(at>=0){candidates.push({start:at,end:at+quote.length});at=text.indexOf(quote,at+1);}
  if(!candidates.length){
    // Rendered selections collapse XML indentation and add paragraph breaks.
    // Compare without whitespace, keeping offsets into the original text tree.
    let compact='';const offsets=[];
    for(let n=0;n<text.length;n++)if(!/\s/u.test(text[n])){compact+=text[n];offsets.push(n);}
    const needle=quote.replace(/\s/gu,'');if(!needle)return null;
    at=compact.indexOf(needle);
    while(at>=0){candidates.push({start:offsets[at],end:offsets[at+needle.length-1]+1});at=compact.indexOf(needle,at+1);}
  }
  return candidates.sort((a,b)=>Math.abs(a.start-preferred)-Math.abs(b.start-preferred))[0] || null;
}
export function validateBackup(data) {
  guardData(data);
  if (data?.format !== 'folio' || data.version !== 1 || !Array.isArray(data.books) || !Array.isArray(data.folders) || !Array.isArray(data.annotations)) throw new Error('Keine gültige folio-Sicherung.');
  if(data.books.length>5000||data.folders.length>10000||data.annotations.length>100000)throw new Error('Die Sicherung enthält zu viele Einträge.');
  const ids = new Set(), validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
  for (const b of data.books) {
    if (!validId(b.id) || ids.has(b.id) || typeof b.title !== 'string' || (b.author !== undefined && typeof b.author !== 'string') || !['PDF','EPUB','DEMO'].includes(b.format) || !Number.isInteger(b.total) || b.total < 1 || !Array.isArray(b.texts) || b.texts.some(t=>typeof t!=='string') || !Array.isArray(b.collections) || b.collections.some(c=>!validId(c)) || (b.format !== 'PDF' && (!Array.isArray(b.pages) || b.pages.length !== b.total || b.pages.some(p=>typeof p.html!=='string')))) throw new Error('Ungültige Buchdaten.');
    if (b.page !== undefined && (!Number.isInteger(b.page) || b.page < 0 || b.page >= b.total)) throw new Error('Ungültige Lesestelle.');
    if (b.status !== undefined && !['unread','reading','finished','paused'].includes(b.status)) throw new Error('Ungültiger Lesestatus.');
    if (b.toc && (!Array.isArray(b.toc) || b.toc.some(t=>typeof t.title!=='string' || !Number.isInteger(t.page) || t.page<0 || t.page>=b.total))) throw new Error('Ungültiges Inhaltsverzeichnis.');
    for (const key of ['color','ink']) if (b[key] && !/^#[a-f0-9]{6}$/i.test(b[key])) delete b[key];
    if(b.pages?.some(p=>(p.href!==undefined&&typeof p.href!=='string')||(p.chapter!==undefined&&typeof p.chapter!=='string')||(p.segments!==undefined&&(!Array.isArray(p.segments)||p.segments.some(s=>typeof s.title!=='string'||!Number.isInteger(s.offset)||s.offset<0||(s.anchor!==undefined&&typeof s.anchor!=='string'))))))throw new Error('Ungültige Kapitelzuordnung.');
    validateLearning(b);
    if(b.tags!==undefined&&(!Array.isArray(b.tags)||b.tags.length>20||b.tags.some(t=>typeof t!=='string'||t.length>800)))throw new Error('Ungültige Buch-Tags.');
    if(b.year!=null&&(!Number.isInteger(b.year)||b.year<1||b.year>9999))throw new Error('Ungültiges Erscheinungsjahr.');
    if(b.targetPage!=null&&(!Number.isInteger(b.targetPage)||b.targetPage<1||b.targetPage>b.total))throw new Error('Ungültiges Leseziel.');
    if(b.targetDate!==undefined&&(typeof b.targetDate!=='string'||b.targetDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(b.targetDate)))throw new Error('Ungültiger Zieltermin.');
    if(b.link!==undefined&&(typeof b.link!=='string'||b.link.length>2000||b.link!==''&&!/^https?:\/\//i.test(b.link)))throw new Error('Ungültiger Quellenlink.');
    if(b.reference!==undefined&&typeof b.reference!=='boolean')throw new Error('Ungültiger Buchtyp.');
    ids.add(b.id);
  }
  const folders = new Set();
  for (const f of data.folders) { if (!validId(f.id) || folders.has(f.id) || typeof f.name !== 'string') throw new Error('Ungültige Collections.'); folders.add(f.id); }
  for (const f of data.folders) { if (f.parent && !folders.has(f.parent)) throw new Error('Fehlender übergeordneter Ordner.'); const seen = new Set([f.id]); let parent = f.parent; while (parent) { if (seen.has(parent)) throw new Error('Kreis in den Collections.'); seen.add(parent); parent = data.folders.find(x=>x.id===parent)?.parent; } }
  const annotationIds=new Set();
  for (const a of data.annotations) {
    if(annotationIds.has(a.id))throw new Error('Doppelte Eintrags-ID.');annotationIds.add(a.id);
    if (!validId(a.id) || !ids.has(a.bookId) || !['highlight','note','bookmark','question','lesson','flashcard','task'].includes(a.type) || !Number.isInteger(a.page) || a.page < 0 || a.page >= data.books.find(b=>b.id===a.bookId).total) throw new Error('Ungültige Notizen oder Markierungen.');
    if (a.color && !/^#[a-f0-9]{6}$/i.test(a.color)) throw new Error('Ungültige Markierungsfarbe.');
    for (const key of ['quote','text','answer']) if (a[key] !== undefined && typeof a[key]!=='string') throw new Error('Ungültiger Eintragstext.');
    if (a.rects && (!Array.isArray(a.rects) || a.rects.some(r=>['x','y','w','h'].some(k=>!Number.isFinite(r[k]) || r[k]<0 || r[k]>1)))) throw new Error('Ungültiger Markierungsbereich.');
    if (a.start !== undefined && (!Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start<0 || a.end<a.start)) throw new Error('Ungültige Textmarkierung.');
  }
  if(data.drafts!==undefined){
    if(!Array.isArray(data.drafts)||data.drafts.length>10000)throw new Error('Ungültige Formularentwürfe.');
    for(const draft of data.drafts){
      if(!ids.has(draft.bookId)||!['book','chapter'].includes(draft.mode)||typeof draft.key!=='string'||draft.key.length>2000||draft.id!==`learning-draft:${draft.bookId}|${draft.mode}|${draft.mode==='chapter'?draft.key:''}`||!Number.isFinite(draft.updated)||!Array.isArray(draft.values)||draft.values.length>100||draft.values.some(pair=>!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||pair[0].length>100||typeof pair[1]!=='string'||pair[1].length>20000))throw new Error('Ungültige Formularentwürfe.');
    }
  }
  return data;
}

function guardData(value,depth=0,budget={nodes:0}){
  if(++budget.nodes>2000000||depth>24)throw new Error('Die Sicherung ist zu umfangreich oder zu tief verschachtelt.');
  if(typeof value==='string'&&value.length>32*1024**2)throw new Error('Ein Text in der Sicherung ist zu groß.');
  if(value&&typeof value==='object')for(const [key,entry] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsichere Datenstruktur in der Sicherung.');guardData(entry,depth+1,budget);}
}
function validateLearning(book){
  const learning=book.learning;if(learning===undefined)return;
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const texts=(obj,fields)=>fields.every(key=>obj[key]===undefined||(typeof obj[key]==='string'&&obj[key].length<=20000));
  const fail=()=>{throw new Error('Ungültige Lerndaten.');};
  if(!record(learning))fail();
  const plan=learning.plan;
  if(plan!==undefined){if(!record(plan)||!texts(plan,['purpose','outcome','liked','critique','insight','takeaway','recommendation']))fail();
    if(plan.questions!==undefined&&(!Array.isArray(plan.questions)||plan.questions.length>3||plan.questions.some(q=>!record(q)||!texts(q,['question','answer']))))fail();
    if(plan.actions!==undefined&&(!Array.isArray(plan.actions)||plan.actions.length>3||plan.actions.some(a=>!record(a)||!texts(a,['change','when'])||(a.done!==undefined&&typeof a.done!=='boolean'))))fail();
    if(plan.rating!==undefined&&(!Number.isInteger(plan.rating)||plan.rating<0||plan.rating>5))fail();
  }
  if(learning.chapters!==undefined){if(!record(learning.chapters))fail();for(const session of Object.values(learning.chapters)){
    if(!record(session)||!texts(session,['goal','recall','missing','correction','transfer','notes','title','sourceKey']))fail();
    if(session.page!==undefined&&(!Number.isInteger(session.page)||session.page<0||session.page>=book.total))fail();
    if(session.understanding!==undefined&&(!Number.isInteger(session.understanding)||session.understanding<0||session.understanding>4))fail();
    for(const key of ['due','updated','sourceOffset','reviews'])if(session[key]!=null&&(!Number.isFinite(session[key])||session[key]<0))fail();
    if(session.history!==undefined&&(!Array.isArray(session.history)||session.history.length>12||session.history.some(h=>!record(h)||!texts(h,['recall'])||!Number.isFinite(h.updated))))fail();
  }}
}
