// A Files provider may not support repeated/ranged reads consistently. Keep one
// complete read for detection, parsing and storage; never rely on Blob.slice().
const reads=new WeakMap();
const limit=300*1024**2;
const unreadable=()=>new Error('Die Datei konnte nicht vollständig gelesen werden. Bitte sie in „Dateien“ zuerst öffnen bzw. herunterladen und anschließend erneut wählen.');
function fileReaderBytes(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(unreadable());reader.onabort=()=>reject(unreadable());reader.readAsArrayBuffer(file);});}
export function readBookBytes(file){
 if(file.size>limit)return Promise.reject(new Error('Bitte eine Datei unter 300 MB verwenden.'));
 if(!reads.has(file)){
  const read=(async()=>{
   let bytes,failed=false;try{bytes=await file.arrayBuffer();}catch{failed=true;}
   if(!(bytes instanceof ArrayBuffer)||!bytes.byteLength){if(typeof FileReader!=='undefined')try{bytes=await fileReaderBytes(file);failed=false;}catch{failed=true;}}
   if(!(bytes instanceof ArrayBuffer)||!bytes.byteLength){if(failed)throw unreadable();throw new Error('Die Dateiauswahl hat eine leere Datei übergeben. Bitte das Buch in „Dateien“ vollständig herunterladen oder eine einzelne EPUB-Datei wählen.');}
   if(bytes.byteLength>limit)throw new Error('Bitte eine Datei unter 300 MB verwenden.');
   // A package provider's size may describe the directory before it is zipped.
   // Validate the actual ZIP/PDF structure instead of comparing that metadata.
   return bytes;
  })();reads.set(file,read);read.catch(()=>reads.delete(file));
 }
 return reads.get(file);
}
