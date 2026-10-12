// A Files provider may not support repeated/ranged reads consistently. Keep one
// complete read for detection, parsing and storage; never rely on Blob.slice().
import {readBookPackage} from './book-package.js';
const reads=new WeakMap();
const details=new WeakMap();
const selectedEntries=new WeakMap();
export function registerBookEntry(file,entry){if(file&&entry)selectedEntries.set(file,entry);}
export function bookFileDetails(file){return {name:String(file.name||'').slice(0,500),type:String(file.type||'').slice(0,100),reportedBytes:Number(file.size)||0,...details.get(file)};}
const limit=300*1024**2;
const unreadable=()=>new Error('Die Datei konnte nicht vollständig gelesen werden. Bitte sie in „Dateien“ zuerst öffnen bzw. herunterladen und anschließend erneut wählen.');
function fileReaderBytes(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||unreadable());reader.onabort=()=>reject(new DOMException('Lesen abgebrochen','AbortError'));reader.readAsArrayBuffer(file);});}
export function readBookBytes(file){
 if(file.size>limit)return Promise.reject(new Error('Bitte eine Datei unter 300 MB verwenden.'));
 if(!reads.has(file)){
  const read=(async()=>{
   const entry=selectedEntries.get(file),info={method:'arrayBuffer',receivedBytes:0,signature:'',readErrors:[],entryKind:entry?.isDirectory?'directory':entry?.isFile?'file':'unavailable',entryErrors:[]};details.set(file,info);
   let bytes,failed=false;try{bytes=await file.arrayBuffer();}catch(error){failed=true;info.readErrors.push(error?.name||'Error');}
   if(!(bytes instanceof ArrayBuffer)||!bytes.byteLength){if(typeof FileReader!=='undefined')try{info.method='FileReader';bytes=await fileReaderBytes(file);failed=false;}catch(error){failed=true;info.readErrors.push(error?.name||'Error');}}
   if((!(bytes instanceof ArrayBuffer)||!bytes.byteLength)&&entry?.isDirectory){try{info.method='packageEntries';bytes=await readBookPackage(entry,readBookBytes,info);failed=false;}catch(error){info.entryErrors.push(error?.name||'Error');info.entryMessage=error?.message||'';}}
   if(bytes instanceof ArrayBuffer){info.receivedBytes=bytes.byteLength;info.signature=[...new Uint8Array(bytes,0,Math.min(8,bytes.byteLength))].map(n=>n.toString(16).padStart(2,'0')).join('');}
   if(!(bytes instanceof ArrayBuffer)||!bytes.byteLength){if(failed&&info.readErrors.includes('NotFoundError'))throw new Error('Die Dateiauswahl hat keinen erreichbaren Buchinhalt übergeben (0 gelesene Bytes). Auch der direkte Zugriff auf den Buchordner war nicht verfügbar. Bitte dieselbe Datei in Safari oder per Drag-and-drop aus „Dateien“ versuchen.');if(failed)throw unreadable();throw new Error('Die Dateiauswahl hat eine leere Datei übergeben. Bitte das Buch in „Dateien“ vollständig herunterladen oder eine einzelne EPUB-Datei wählen.');}
   if(bytes.byteLength>limit)throw new Error('Bitte eine Datei unter 300 MB verwenden.');
   // A package provider's size may describe the directory before it is zipped.
   // Validate the actual ZIP/PDF structure instead of comparing that metadata.
   return bytes;
  })();reads.set(file,read);read.catch(()=>reads.delete(file));
 }
 return reads.get(file);
}
