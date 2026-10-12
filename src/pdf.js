import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {appPath} from './app-paths.js';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
export {pdfjs};
export async function openPDF(data){
  const task=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false,cMapUrl:appPath('pdf/cmaps/'),cMapPacked:true,standardFontDataUrl:appPath('pdf/fonts/')});
  let rejectPassword;const passwordFailure=new Promise((_,reject)=>{rejectPassword=reject;});
  task.onPassword=()=>{rejectPassword(new Error('Dieses PDF ist passwortgeschützt. Bitte eine entsperrte Datei importieren.'));task.destroy().catch(()=>{});};
  return Promise.race([task.promise,passwordFailure]);
}
