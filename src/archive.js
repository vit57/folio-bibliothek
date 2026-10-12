// Check ZIP metadata before inflation, then bound actual decompressed bytes too.
export function inspectArchive(bytes,kind='epub') {
  const view=new DataView(bytes),size=bytes.byteLength,backup=kind==='backup',books=kind==='books';
  const limits={entries:backup?20000:10000,entry:(backup?512:books?300:24)*1024**2,total:backup?2*1024**3:600*1024**2};
  if(size>(backup?1024:300)*1024**2)throw new Error('Die Archivdatei ist zu groß.');
  let end=-1;
  for(let n=size-22;n>=Math.max(0,size-65557);n--)if(view.getUint32(n,true)===0x06054b50&&n+22+view.getUint16(n+20,true)===size){end=n;break;}
  const invalid=()=>{throw new Error('Ungültiges oder nicht unterstütztes ZIP-Archiv.');};
  if(end<0)invalid();
  const count=view.getUint16(end+10,true),length=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||count===65535||start+length!==end||view.getUint16(end+8,true)!==count)invalid();
  if(count>limits.entries)throw new Error('Das Archiv enthält zu viele Dateien.');
  let cursor=start,total=0;const names=new Set(),decode=new TextDecoder();
  for(let n=0;n<count;n++){
    if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)invalid();
    const unpacked=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),next=cursor+46+nameLength+extra+comment;
    if(next>end||unpacked===0xffffffff)invalid();
    const name=decode.decode(new Uint8Array(bytes,cursor+46,nameLength));
    if(!name||name.includes('\0')||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||names.has(name))throw new Error('Unsichere oder doppelte Dateipfade im Archiv.');
    names.add(name);total+=unpacked;
    if(unpacked>limits.entry||total>limits.total)throw new Error('Die entpackten Inhalte sind zu groß. Bitte ein kleineres Archiv verwenden.');
    cursor=next;
  }
  if(cursor!==end)invalid();
  return {entries:count,total};
}
export function readEntry(entry,max=24*1024**2,type='string') {
  if(!entry)throw new Error('Eine benötigte Archivdatei fehlt.');
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,failed=false;const stream=entry.internalStream('uint8array');
    stream.on('data',chunk=>{size+=chunk.length;if(size>max){failed=true;stream.pause();chunks.length=0;reject(new Error('Eine entpackte Datei überschreitet das Größenlimit.'));}else if(!failed)chunks.push(chunk);});
    stream.on('error',reject);stream.on('end',()=>{if(failed)return;const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}resolve(type==='string'?new TextDecoder().decode(bytes):bytes.buffer);});stream.resume();
  });
}
