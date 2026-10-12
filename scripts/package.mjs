import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.FOLIO_BASE_PATH || '/';
if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw new Error('Ungültiger App-Basispfad.');
async function copy(source,target){await mkdir(target,{recursive:true});for(const file of await readdir(source,{withFileTypes:true})){if(file.isDirectory())await copy(`${source}/${file.name}`,`${target}/${file.name}`);else{
    const bytes=await readFile(`${source}/${file.name}`),duplicate=file.name.match(/^(.*) [2-9](\.[^.]*)?$/);
    // Some local package mirrors contain Finder conflict copies. Only omit a
    // copy when its canonical file exists and every byte is identical.
    if(duplicate){const original=await readFile(`${source}/${duplicate[1]}${duplicate[2]||''}`).catch(()=>null);if(original&&bytes.equals(original))continue;}
    await writeFile(`${target}/${file.name}`,bytes);
  }}}
await copy('node_modules/pdfjs-dist/cmaps','dist/pdf/cmaps');
await copy('node_modules/pdfjs-dist/standard_fonts','dist/pdf/fonts');
// App icons are committed assets; a clean CI build needs no native renderer.
for(const file of ['icon.svg','manifest.webmanifest','icon-192.png','icon-512.png','paper-fibers.svg','paper-fibers-light.svg','world-parchment.svg','world-wood.svg','world-celestial.svg','world-marble.svg'])await writeFile(`dist/${file}`,await readFile(`public/${file}`));
await mkdir('dist/licenses',{recursive:true});
for(const [pkg,file] of [['pdfjs-dist','LICENSE'],['jszip','LICENSE.markdown'],['lucide','LICENSE'],['jspdf','LICENSE']])await writeFile(`dist/licenses/${pkg}-${file}`,await readFile(`node_modules/${pkg}/${file}`));
await writeFile('dist/licenses/NOTICE.md',await readFile('NOTICE.md'));
async function files(path){let result=[];for(const file of await readdir(path,{withFileTypes:true})){if(file.isDirectory())result.push(...await files(`${path}/${file.name}`));else if(file.name!=='sw.js')result.push(`${path}/${file.name}`);}return result;}
const version=JSON.parse(await readFile('package.json','utf8')).version;await writeFile('dist/app-version.json',JSON.stringify({version}));
const paths=await files('dist'),hash=createHash('sha256');
for(const path of paths.filter(p=>p.endsWith('.css'))){const css=await readFile(path,'utf8');await writeFile(path,css.replace(/url\((['"]?)\/(?!\/)([^)'"]+)\1\)/g,(match,quote,url)=>url.startsWith(base.slice(1))&&base!=='/'?match:`url(${quote}${base}${url}${quote})`));}
for(const path of paths)hash.update(await readFile(path));
const urls=[base,...paths.filter(p=>!p.includes('/licenses/')).map(p=>base+p.slice(5))];
// App, PDF worker, character maps and fonts are installed together so newly
// imported books also render when the device has no network connection.
await writeFile('dist/sw.js',`const BASE=${JSON.stringify(base)},PREFIX=BASE==='/'?'folio-':'folio:'+BASE+':',CACHE=PREFIX+'${hash.digest('hex').slice(0,12)}';
const ASSETS=${JSON.stringify(urls)};
const currentMatch=path=>caches.open(CACHE).then(cache=>cache.match(path));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).slice(0,-2).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>response.ok?response:currentMatch(BASE+'index.html')).catch(()=>currentMatch(BASE+'index.html')));return;
  }
  if(url.pathname===BASE+'app-version.json'){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>currentMatch(BASE+'app-version.json')));return;}
  // Retained hashed assets let an older open tab finish without broken chunks.
  if(url.pathname.startsWith(BASE+'assets/')&&!ASSETS.includes(url.pathname)){event.respondWith(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith(PREFIX)).reverse().map(n=>caches.open(n).then(c=>c.match(url.pathname))))).then(hits=>hits.find(Boolean)||fetch(event.request)));return;}
  // Unknown URLs and query variations must not grow the offline cache.
  if(!ASSETS.includes(url.pathname))return;
  event.respondWith(currentMatch(url.pathname).then(hit=>hit||fetch(event.request)));
});
`);
console.log('Mac/iPad-Paket fertig: dist/ · PDF-Schriften und Service Worker enthalten.');
