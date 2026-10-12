import JSZip from 'jszip';

// Safari can expose an EPUB directory as a zero-byte "book.epub.zip" File.
// Read only the selected entry's children, then use the normal EPUB importer.
// No parent directory listing, network request or book-specific conversion.
const maxBytes=300*1024**2,maxEntryBytes=24*1024**2,maxEntries=10000,maxDepth=64;
const segment=name=>typeof name==='string'&&name.length>0&&name!=='.'&&name!=='..'&&!/[\x00-\x1f/\\]/.test(name);
const callback=invoke=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new DOMException('Der Dateizugriff antwortet nicht.','TimeoutError')),30000);
  const done=fn=>value=>{clearTimeout(timer);fn(value);};
  try{invoke(done(resolve),done(reject));}catch(error){clearTimeout(timer);reject(error);}
});
const entries=reader=>callback((resolve,reject)=>reader.readEntries(resolve,reject));

async function openDirectory(entry,info){
  try{const reader=entry.createReader();return {entry,first:await entries(reader),reader};}
  catch(error){
    // WebKit names a package "name.epub.zip", but its selected on-disk entry
    // is still "name.epub". Resolve exactly that name in the isolated root.
    // Never search the parent or try arbitrary neighbouring files.
    if(error?.name!=='NotFoundError'||!/^\/[^/]+\.epub\.zip$/i.test(entry.fullPath||'')||!segment(entry.name)||entry.fullPath!==`/${entry.name}`||!entry.filesystem?.root?.getDirectory)throw error;
    info.entryErrors.push(error.name);
    const actual=await callback((resolve,reject)=>entry.filesystem.root.getDirectory(entry.name.slice(0,-4),{create:false},resolve,reject));
    if(!actual?.isDirectory||actual.name!==entry.name.slice(0,-4))throw new Error('Der ausgewählte Buchordner konnte nicht geöffnet werden.');
    info.packageNameResolved=true;
    const reader=actual.createReader();return {entry:actual,first:await entries(reader),reader};
  }
}

export async function readBookPackage(entry,readBytes,info={entryErrors:[]}){
  if(!entry?.isDirectory||!segment(entry.name)||! /\.epub(?:\.zip)?$/i.test(entry.name))throw new Error('Bitte einen EPUB-Buchordner oder eine einzelne Buchdatei wählen.');
  const zip=new JSZip(),paths=new Set(),items=[];let count=0,total=0;
  const opened=await openDirectory(entry,info);
  // Retain one reader per directory; providers may return multiple batches.
  async function walk(directory,prefix='',depth=0,opened=null){
    if(depth>maxDepth)throw new Error('Der Buchordner ist zu tief verschachtelt.');
    const reader=opened?.reader||directory.createReader();let first=opened?.first;
    for(;;){const batch=first??await entries(reader);first=null;if(!Array.isArray(batch))throw new Error('Der Buchordner konnte nicht gelesen werden.');if(!batch.length)break;
      for(const child of batch){
        if(++count>maxEntries)throw new Error('Der Buchordner enthält zu viele Einträge.');
        if(!segment(child.name))throw new Error('Der Buchordner enthält einen ungültigen Dateipfad.');
        const path=prefix+child.name;if(paths.has(path))throw new Error('Der Buchordner enthält doppelte Dateipfade.');paths.add(path);
        if(child.name==='__MACOSX'||child.name==='.DS_Store'||child.name.startsWith('._'))continue;
        if(child.isDirectory){await walk(child,path+'/',depth+1);continue;}
        if(!child.isFile||typeof child.file!=='function')throw new Error('Ein Eintrag im Buchordner ist nicht lesbar.');
        const file=await callback((resolve,reject)=>child.file(resolve,reject));
        if(file.size>maxEntryBytes||total+file.size>maxBytes)throw new Error('Der Buchordner ist zu groß.');
        // Empty ancillary files are valid. A failed native read still rejects.
        const bytes=file.size===0?await file.arrayBuffer():await readBytes(file);
        if(!(bytes instanceof ArrayBuffer)||bytes.byteLength>maxEntryBytes||total+bytes.byteLength>maxBytes)throw new Error('Der Buchordner ist zu groß oder nicht vollständig lesbar.');
        total+=bytes.byteLength;items.push({path,bytes});
      }
    }
  }
  await walk(opened.entry,'',0,opened);
  if(!items.length)throw new Error('Der ausgewählte Buchordner enthält keine lesbaren Dateien.');
  // EPUB's mimetype is first and uncompressed; all original entry bytes remain
  // unchanged. Structure, DRM and HTML checks happen in the existing importer.
  items.sort((a,b)=>a.path==='mimetype'?-1:b.path==='mimetype'?1:0);
  for(const {path,bytes} of items)zip.file(path,bytes,{createFolders:false,compression:path==='mimetype'?'STORE':'DEFLATE'});
  info.packageEntries=items.length;info.packageBytes=total;
  const bytes=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
  if(bytes.byteLength>maxBytes)throw new Error('Bitte ein Buch unter 300 MB verwenden.');
  return bytes;
}
