import JSZip from 'jszip';
import {uid,escape,resolvePath} from './core.js';
import {inspectArchive,readEntry} from './archive.js';
import {findEPUBPackage,scopeEPUB} from './epub-package.js';
export const loadPDF=()=>import('./pdf.js');
export const openPDF=async data=>(await loadPDF()).openPDF(data);
const xml = value => { if(/<!ENTITY\b/i.test(value))throw new Error('EPUB mit XML-Entitäten wird nicht unterstützt.'); const doc = new DOMParser().parseFromString(value,'application/xml'); if (doc.querySelector('parsererror')) throw new Error('Ungültige EPUB-Struktur.'); return doc; };
const tag = (doc,name) => [...doc.getElementsByTagNameNS('*',name)];
const blobDataURL = blob => new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const imageTypes = {'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','gif':'image/gif','webp':'image/webp','avif':'image/avif'};
const imageCache=new WeakMap();
async function rasterImage(zip,path){
  let cache=imageCache.get(zip);if(!cache){cache=new Map();imageCache.set(zip,cache);}
  if(!cache.has(path))cache.set(path,loadRasterImage(zip,path));
  return cache.get(path);
}
async function loadRasterImage(zip, path) {
  const ext = path.split('.').pop().toLowerCase(), type = imageTypes[ext], file = zip.file(path);
  if (!type || !file) return '';
  return blobDataURL(new Blob([await readEntry(file,20*1024**2,'arraybuffer')], {type}));
}
// EPUB content is rebuilt using allowed elements. Scripts, remote content, event
// handlers, styles, forms, iframes, SVG and external resources never reach the reader.
async function sanitize(node, zip, path,depth=0) {
  if(depth>100)throw new Error('Das EPUB ist zu tief verschachtelt.');
  if (!node) return '';
  if (node.nodeType === 3) return escape(node.textContent);
  if (node.nodeType !== 1) return '';
  const name = node.localName?.toLowerCase();
  if (['script','style','iframe','object','embed','form','input','button','math','link','audio','video','head','title','meta'].includes(name)) return '';
  if (name === 'svg') {
    // EPUB cover pages commonly wrap a raster cover in an SVG image element.
    let images = '';
    for (const image of tag(node,'image')) {
      const href = image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink','href');
      if (href && !/^(?:[a-z]+:|\/\/)/i.test(href)) {
        const data = await rasterImage(zip,resolvePath(path,href));
        if (data) images += `<img src="${data}" alt="Illustration">`;
      }
    }
    return images;
  }
  if (name === 'img') {
    const src = node.getAttribute('src');
    if (!src || /^(?:[a-z]+:|\/\/)/i.test(src)) return '';
    const data = await rasterImage(zip, resolvePath(path,src));
    return data ? `<img src="${data}" alt="${escape(node.getAttribute('alt') || '')}">` : '';
  }
  const allowed = ['p','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','em','strong','b','i','u','sup','sub','br','hr','table','tr','td','th','thead','tbody','caption','pre','code','figure','figcaption','section','div','span'];
  const safeName = name === 'body' ? 'div' : allowed.includes(name) ? name : 'span';
  const children = (await Promise.all([...node.childNodes].map(n=>sanitize(n,zip,path,depth+1)))).join('');
  if (['br','hr'].includes(safeName)) return `<${safeName}>`;
  const sourceId=node.getAttribute('id');
  return `<${safeName}${sourceId?` data-source-id="${escape(sourceId)}"`:''}>${children}</${safeName}>`;
}
async function readNavigation(zip,items,root){
  const nav=items.find(n=>n.getAttribute('properties')?.split(' ').includes('nav'));
  const ncx=items.find(n=>n.getAttribute('media-type')==='application/x-dtbncx+xml');
  const item=nav || ncx;if(!item)return [];
  const path=resolvePath(root,item.getAttribute('href')),entry=zip.file(path);if(!entry)return [];
  const doc=xml(await readEntry(entry)),links=[];
  if(nav){
    const toc=tag(doc,'nav').find(n=>(n.getAttribute('epub:type') || n.getAttributeNS('http://www.idpf.org/2007/ops','type') || '').split(' ').includes('toc')) || tag(doc,'nav')[0];
    for(const a of toc?tag(toc,'a'):[])links.push({href:a.getAttribute('href'),title:a.textContent});
  }else for(const point of tag(doc,'navPoint'))links.push({href:tag(point,'content')[0]?.getAttribute('src'),title:tag(point,'text')[0]?.textContent});
  return links.filter(n=>n.href&&!/^(?:[a-z]+:|\/\/)/i.test(n.href)).map(n=>({path:resolvePath(path,n.href),anchor:decodeURIComponent(n.href.split('#')[1] || ''),title:n.title?.replace(/\s+/g,' ').trim().slice(0,160) || 'Kapitel'}));
}
function chapterSegments(root,navigation,heading){
  const segments=[],elements=[...root.querySelectorAll('[data-source-id]')];
  for(const entry of navigation){
    const node=entry.anchor?elements.find(n=>n.getAttribute('data-source-id')===entry.anchor):root;
    if(!node)continue;
    let offset=0;if(node!==root){const range=document.createRange();range.selectNodeContents(root);range.setEndBefore(node);offset=range.toString().length;}
    if(!root.textContent.slice(0,offset).trim())offset=0;
    if(!segments.some(n=>n.offset===offset))segments.push({title:entry.title,offset,anchor:entry.anchor});
  }
  segments.sort((a,b)=>a.offset-b.offset);
  if(!segments.length||segments[0].offset>0)segments.unshift({title:heading,offset:0,anchor:''});
  return segments;
}
export async function importEPUB(file, progress) {
  const bytes=await file.arrayBuffer();inspectArchive(bytes);
  const archive=await JSZip.loadAsync(bytes),info=findEPUBPackage(archive);
  if(!info)throw new Error('Die Buchstruktur dieses EPUBs konnte nicht erkannt werden.');
  const zip=scopeEPUB(archive,info);
  for(const encryption of zip.encryption){
    const methods = tag(xml(await readEntry(encryption)), 'EncryptionMethod');
    const fontObfuscation = ['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'];
    if (!methods.length || methods.some(n=>!fontObfuscation.includes(n.getAttribute('Algorithm')))) throw new Error('Dieses EPUB enthält verschlüsselte Inhalte. Bitte eine DRM-freie Ausgabe importieren.');
  }
  const container = zip.file('META-INF/container.xml');
  const href=container?tag(xml(await readEntry(container)),'rootfile')[0]?.getAttribute('full-path'):info.packagePath;
  if(!href||/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href))throw new Error('EPUB-Buchstruktur fehlt oder verweist auf eine externe Datei.');
  let root=resolvePath('',href);if(info.prefix&&root.startsWith(info.prefix)&&!zip.file(root))root=root.slice(info.prefix.length);
  if(!zip.file(root))throw new Error('Das Inhaltsverzeichnis dieses EPUBs konnte nicht gefunden werden.');
  const opf=xml(await readEntry(zip.file(root)));
  if(opf.documentElement.localName!=='package'||!tag(opf,'manifest').length||!tag(opf,'spine').length)throw new Error('Die Buchstruktur dieses EPUBs ist nicht lesbar.');
  const title = tag(opf,'title')[0]?.textContent || file.name.replace(/\.epub(?:\.zip)?$/i,''), author = tag(opf,'creator').map(n=>n.textContent).join(', ') || 'Unbekannter Autor';
  const items = tag(opf,'item'), byId = new Map(items.map(n=>[n.getAttribute('id'),n]));
  const coverId = tag(opf,'meta').find(n=>n.getAttribute('name')==='cover')?.getAttribute('content');
  const coverItem = items.find(n=>n.getAttribute('properties')?.split(' ').includes('cover-image')) || byId.get(coverId);
  const cover = coverItem ? await rasterImage(zip,resolvePath(root,coverItem.getAttribute('href'))) : '';
  const navigation=await readNavigation(zip,items,root);
  const pages = [], toc = [], spine = tag(opf,'itemref').filter(n=>n.getAttribute('linear')!=='no');
  for (const [index, ref] of spine.entries()) {
    const item = byId.get(ref.getAttribute('idref')); if (!item) continue;
    const path = resolvePath(root,item.getAttribute('href')), entry = zip.file(path); if (!entry) throw new Error(`EPUB-Kapitel fehlt: ${path}`);
    const source = await readEntry(entry);
    if(/<!ENTITY\b/i.test(source))throw new Error('EPUB mit XML-Entitäten wird nicht unterstützt.');
    // XHTML has XML self-closing semantics (notably <title/>). HTML parsing
    // otherwise consumes the chapter as title text and loses the body.
    let doc = new DOMParser().parseFromString(source,'application/xhtml+xml');
    if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(source.replace(/<title\s*\/>/gi,'<title></title>'),'text/html');
    const body = tag(doc,'body')[0] || doc.body;
    if(body?.querySelectorAll('*').length>100000)throw new Error('Ein EPUB-Abschnitt enthält zu viele Elemente.');
    const headingNode = body?.querySelector('h1,h2,h3');
    const rawHeading = headingNode?.textContent.trim() || tag(doc,'title')[0]?.textContent.trim();
    const heading = rawHeading && !/<\/?(?:body|head|link|meta|p|div)\b/i.test(rawHeading) ? rawHeading.replace(/\s+/g,' ').slice(0,160) : `Kapitel ${index+1}`;
    const safe = await sanitize(body,zip,path);
    const fragment = document.createElement('div'); fragment.innerHTML = safe;
    const wrapper = fragment.firstElementChild;
    const content=wrapper || fragment;
    const segments=chapterSegments(content,navigation.filter(n=>n.path===path),heading);
    for(const node of content.querySelectorAll('[data-source-id]'))node.removeAttribute('data-source-id');
    const html = wrapper?.innerHTML || fragment.innerHTML;
    if (toc.some(c=>c.href===path)) continue;
    if (fragment.textContent.trim() || fragment.querySelector('img')) {
      for(const segment of segments)toc.push({title:segment.title,page:pages.length,href:path,offset:segment.offset});
      pages.push({html,chapter:segments[0].title,href:path,segments,chapterNavigation:navigation.some(n=>n.path===path)});
    }
    progress?.(index+1,spine.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (!pages.length) throw new Error('Im EPUB wurden keine lesbaren Inhalte gefunden.');
  const texts = pages.map(p=>{const d=document.createElement('div'); d.innerHTML=p.html; return d.textContent;});
  return {id:uid(),title,author,format:'EPUB',cover,pages,texts,toc:toc.filter(c=>c.page<pages.length),total:pages.length,parserVersion:3};
}
export async function importPDF(file, progress) {
  const pdf = await openPDF(await file.arrayBuffer());
  try {
    const metadata = await pdf.getMetadata().catch(()=>null), texts = [];
    let cover = '';
    for (let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i), content = await page.getTextContent();
      texts.push(content.items.map(x=>x.str + (x.hasEOL ? '\n' : ' ')).join(''));
      if (i===1) { const viewport=page.getViewport({scale:260/page.getViewport({scale:1}).width}), canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height; await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; cover=canvas.toDataURL('image/jpeg',.85); }
      progress?.(i,pdf.numPages); page.cleanup();
    }
    return {id:uid(),title:metadata?.info?.Title?.trim() || file.name.replace(/\.pdf$/i,''),author:metadata?.info?.Author || 'Unbekannter Autor',format:'PDF',cover,texts,total:pdf.numPages,scan:texts.every(t=>!t.trim())};
  } finally { await pdf.destroy(); }
}
export async function parseBook(file, progress) {
  if (file.size > 300 * 1024 * 1024) throw new Error('Bitte eine Datei unter 300 MB verwenden.');
  const format=await detectBookFormat(file);
  const book = await (format==='PDF' ? importPDF(file,progress) : importEPUB(file,progress));
  return {...book,filename:file.name,collections:[],status:'unread',page:0,started:false,favorite:false,added:Date.now(),updated:Date.now()};
}

// Downloads sometimes add .zip to EPUB names. Trust the signature and EPUB
// container, while keeping the same archive, DRM and HTML safety checks.
async function detectBookFormat(file){
  const head=new Uint8Array(await file.slice(0,1024).arrayBuffer());
  if(new TextDecoder().decode(head).includes('%PDF-'))return 'PDF';
  if(head[0]===0x50&&head[1]===0x4b&&head[2]===3&&head[3]===4)return 'EPUB';
  throw new Error('Keine lesbare Buchdatei erkannt. Bitte ein PDF, ein DRM-freies EPUB oder ein ZIP mit Buchdateien wählen.');
}
export async function prepareBookFiles(file){
  if(file.size>300*1024**2)throw new Error('Bitte eine Datei unter 300 MB verwenden.');
  const format=await detectBookFormat(file);
  if(format==='PDF')return [file];
  const bytes=await file.arrayBuffer();inspectArchive(bytes,'books');
  const zip=await JSZip.loadAsync(bytes);
  if(findEPUBPackage(zip))return [file];
  const entries=Object.values(zip.files).filter(n=>!n.dir&&!n.name.startsWith('__MACOSX/')&&/\.(?:pdf|epub|epub\.zip)$/i.test(n.name));
  if(!entries.length)throw new Error(/\.epub(?:\.zip)?$/i.test(file.name)?'Die Buchstruktur dieses EPUBs konnte nicht erkannt werden.':'In dieser Datei wurde kein lesbares EPUB oder PDF gefunden.');
  if(entries.length>20)throw new Error('Bitte höchstens 20 Bücher pro ZIP importieren.');
  const files=[];let total=0;
  for(const entry of entries){const data=await readEntry(entry,300*1024**2,'arraybuffer');total+=data.byteLength;if(total>300*1024**2)throw new Error('Die Buchdateien im ZIP sind zusammen zu groß.');files.push(new File([data],entry.name.split('/').at(-1),{type:/\.pdf$/i.test(entry.name)?'application/pdf':'application/epub+zip'}));}
  return files;
}
