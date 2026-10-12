// Updates are checked on opening/resuming, never in a polling loop. Reload is
// explicit and preserves learning drafts and the current book before navigation.
import {appBase,appPath} from './app-paths.js';
export function isNewerVersion(next,current){
  if(!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(next)||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(current))return false;
  const a=next.split('.').map(Number),b=current.split('.').map(Number);
  for(let n=0;n<3;n++)if(a[n]!==b[n])return a[n]>b[n];return false;
}
export function createAppUpdates({version,onStatus,canReload,prepareReload}){
  let registration=null,checking=null,pending=null,lastCheck=0,reloading=false;
  function notice(next){pending=next;const target=document.querySelector('dialog[open] .app-version-info')||document.body,existing=document.querySelector('.app-update-notice');if(existing){target.append(existing);return;}const box=document.createElement('div');box.className='app-update-notice';box.setAttribute('role','status');const label=document.createElement('span');label.textContent=`Neue Version ${next} ist bereit.`;const button=document.createElement('button');button.type='button';button.dataset.action='install-app-update';button.textContent='App aktualisieren';box.append(label,button);target.append(box);}
  async function check(quiet=true){
    if(checking)return checking;
    checking=(async()=>{lastCheck=Date.now();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      try{if(registration)registration.update().catch(()=>{});const response=await fetch(appPath(`app-version.json?check=${Date.now()}`),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Version nicht verfügbar');const data=await response.json();if(isNewerVersion(data.version,version))notice(data.version);else if(!quiet)onStatus(`Du nutzt die aktuelle Version ${version}.`);}
      catch{if(!quiet)onStatus('Updates sind gerade nicht erreichbar. Deine Bibliothek bleibt verfügbar.');}finally{clearTimeout(timer);checking=null;}
    })();return checking;
  }
  async function reload(){
    if(reloading||!pending)return;if(!canReload()){onStatus('Bitte beende zuerst den Import oder schließe das offene Formular.');return;}
    reloading=true;try{await prepareReload();if(registration){await registration.update().catch(()=>{});const worker=registration.installing||registration.waiting;if(worker&&worker.state!=='activated')await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();},changed=()=>{if(['activated','redundant'].includes(worker.state))finish();},timer=setTimeout(finish,10000);worker.addEventListener('statechange',changed);});}location.reload();}catch{reloading=false;onStatus('Die Lesestelle konnte nicht gesichert werden. Bitte erneut versuchen.');}
  }
  async function start(){
    if('serviceWorker' in navigator)try{registration=await navigator.serviceWorker.register(appPath('sw.js'),{scope:appBase,updateViaCache:'none'});}catch{}
    await check();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastCheck>60000)check();});
  }
  return {start,check,reload};
}
