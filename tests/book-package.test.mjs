import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {readBookPackage} from '../src/book-package.js';
import {registerBookEntry,readBookBytes,bookFileDetails} from '../src/file-bytes.js';
import {epubFixture} from './fixtures.mjs';

function directory(name,children,batchSize=2){return {name,children,fullPath:'/'+name,isDirectory:true,isFile:false,createReader(){let at=0;return {readEntries(ok){const batch=children.slice(at,at+batchSize);at+=batchSize;queueMicrotask(()=>ok(batch));}};}};}
function file(name,bytes){return {name,isDirectory:false,isFile:true,file(ok){queueMicrotask(()=>ok(new File([bytes],name)));}};}
async function fixtureEntry(){const source=await JSZip.loadAsync(await epubFixture()),root=directory('Buch.epub',[]),folders=new Map([['',root]]);for(const item of Object.values(source.files)){if(item.dir)continue;const parts=item.name.split('/');let prefix='';for(const name of parts.slice(0,-1)){const path=prefix+name+'/';if(!folders.has(path)){const child=directory(name,[]);folders.get(prefix).children.push(child);folders.set(path,child);}prefix=path;}folders.get(prefix).children.push(file(parts.at(-1),await item.async('uint8array')));}return {source,entry:root};}

test('zero-byte Safari package is rebuilt from all selected entry batches with unchanged payloads',async()=>{
 const {source,entry}=await fixtureEntry(),selected=new File([],'Buch.epub.zip',{type:'application/zip'});selected.arrayBuffer=()=>Promise.reject(new DOMException('Nicht gefunden','NotFoundError'));
 registerBookEntry(selected,entry);const bytes=await readBookBytes(selected),zip=await JSZip.loadAsync(bytes);
 for(const item of Object.values(source.files))if(!item.dir)assert.deepEqual(await zip.file(item.name).async('uint8array'),await item.async('uint8array'));
 assert.equal(new DataView(bytes).getUint16(8,true),0);assert.equal(new TextDecoder().decode(new Uint8Array(bytes,30,8)),'mimetype');
 assert.equal(bookFileDetails(selected).method,'packageEntries');assert.ok(bookFileDetails(selected).receivedBytes>0);assert.equal(bookFileDetails(selected).entryKind,'directory');
 assert.equal(await readBookBytes(selected),bytes);
});
test('Safari virtual .zip alias resolves only the exact selected package name',async()=>{
 const {entry}=await fixtureEntry();let called=0;
 const virtual={name:'Buch.epub.zip',fullPath:'/Buch.epub.zip',isDirectory:true,createReader:()=>({readEntries(ok,bad){bad(new DOMException('Not found','NotFoundError'));}}),filesystem:{root:{getDirectory(name,flags,ok){called++;assert.equal(name,'Buch.epub');assert.deepEqual(flags,{create:false});ok(entry);}}}};
 const info={entryErrors:[]};await readBookPackage(virtual,readBookBytes,info);assert.equal(called,1);assert.equal(info.packageNameResolved,true);assert.deepEqual(info.entryErrors,['NotFoundError']);
});
test('package rejects unsafe paths, duplicates, unrelated directory and oversized entries',async()=>{
 for(const children of [[file('../escape','x')],[file('same','a'),file('same','b')],[{name:'large',isFile:true,file(ok){ok({size:24*1024**2+1});}}]])await assert.rejects(()=>readBookPackage(directory('Buch.epub',children),readBookBytes));
 await assert.rejects(()=>readBookPackage(directory('Andere Dateien',[]),readBookBytes));
});
test('failed package access preserves diagnostics and does not report successful import',async()=>{
 const selected=new File([],'Buch.epub.zip',{type:'application/zip'});selected.arrayBuffer=()=>Promise.reject(new DOMException('Not found','NotFoundError'));
 registerBookEntry(selected,{name:'Buch.epub',isDirectory:true,createReader:()=>({readEntries(ok,bad){bad(new DOMException('No access','SecurityError'));}})});
 await assert.rejects(()=>readBookBytes(selected),/keinen erreichbaren Buchinhalt/);assert.deepEqual(bookFileDetails(selected).entryErrors,['SecurityError']);assert.equal(bookFileDetails(selected).receivedBytes,0);
});
