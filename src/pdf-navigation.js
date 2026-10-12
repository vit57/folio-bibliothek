// PDF views share the open document, but keep their render tasks cancellable.
// Full-size canvases stay within two pages of the reader; previews have a small
// cache and are rendered only when visible, even for books with thousands of pages.
export class PDFScrollView {
  constructor({document:pdf,root,scroll,width,zoom,page,onPage,onReady,decorate,pdfjs}) {
    Object.assign(this,{pdf,root,scroll,width,zoom,onPage,onReady,decorate,pdfjs});
    this.current=page;this.alive=true;this.tasks=new Map();this.rendering=new Map();this.ready=new Set();this.pending=[];this.running=0;this.frame=0;this.timer=0;
  }
  async start() {
    const first=await this.pdf.getPage(this.current+1);if(!this.alive)return;
    const base=first.getViewport({scale:1}),w=this.width*this.zoom;
    this.slots=Array.from({length:this.pdf.numPages},(_,n)=>{const slot=document.createElement('div');slot.className='pdf-page-slot';slot.dataset.page=n;slot.style.width=`${w}px`;slot.style.height=`${w*base.height/base.width}px`;slot.innerHTML=`<span class="pdf-page-placeholder">Seite ${n+1}</span>`;return slot;});
    this.root.replaceChildren(...this.slots);this.scroll.addEventListener('scroll',this.listen=()=>{cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.track());},{passive:true});
    await this.jump(this.current);this.track();
  }
  closest() {
    const y=this.scroll.scrollTop+Math.min(120,this.scroll.clientHeight*.2);let lo=0,hi=this.slots.length-1;
    while(lo<hi){const m=Math.ceil((lo+hi)/2);if(this.slots[m].offsetTop<=y)lo=m;else hi=m-1;}return lo;
  }
  track() {
    if(!this.alive)return;const page=this.closest();if(page!==this.current){this.current=page;this.onPage(page);}
    const near=new Set();for(let n=Math.max(0,page-2);n<=Math.min(this.slots.length-1,page+2);n++)near.add(n);
    for(const n of this.ready)if(!near.has(n)){this.ready.delete(n);this.slots[n].replaceChildren();this.slots[n].innerHTML=`<span class="pdf-page-placeholder">Seite ${n+1}</span>`;}
    for(const [n,t] of this.tasks)if(!near.has(n))t.cancel();
    this.pending=this.pending.filter(n=>near.has(n));for(const n of [...near].sort((a,b)=>Math.abs(a-page)-Math.abs(b-page)))if(!this.ready.has(n)&&!this.rendering.has(n)&&!this.pending.includes(n))this.pending.push(n);
    this.pump();clearTimeout(this.timer);this.timer=setTimeout(()=>this.alive&&this.onReady(),140);
  }
  pump(){while(this.alive&&this.running<2&&this.pending.length){const n=this.pending.shift();this.running++;this.render(n).catch(error=>{if(this.alive&&error.name!=='RenderingCancelledException'){this.slots[n].innerHTML='<span class="pdf-page-placeholder">Seite konnte nicht geladen werden.</span>';console.warn('PDF-Seite',n+1,error.message);}}).finally(()=>{this.running--;this.pump();});}}
  render(n){if(this.rendering.has(n))return this.rendering.get(n);const job=this.renderPage(n).finally(()=>this.rendering.delete(n));this.rendering.set(n,job);return job;}
  async renderPage(n) {
    const page=await this.pdf.getPage(n+1);if(!this.alive||Math.abs(n-this.current)>2)return;
    const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:this.width*this.zoom/base.width}),ratio=Math.min(devicePixelRatio||1,2),slot=this.slots[n];
    const sheet=document.createElement('div');sheet.className='pdf-sheet';sheet.dataset.page=n;sheet.style.width=`${viewport.width}px`;sheet.style.height=`${viewport.height}px`;sheet.style.setProperty('--scale-factor',viewport.scale);
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width='100%';canvas.style.height='100%';sheet.append(canvas);
    const layer=document.createElement('div');layer.className='textLayer';sheet.append(layer);
    const task=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});this.tasks.set(n,task);
    try{await task.promise;if(!this.alive||Math.abs(n-this.current)>2)return;const text=new this.pdfjs.TextLayer({textContentSource:await page.getTextContent(),container:layer,viewport});await text.render();if(!this.alive||Math.abs(n-this.current)>2)return;this.decorate(sheet,n);const difference=viewport.height-parseFloat(slot.style.height),anchor=n<this.current&&slot.offsetTop<this.scroll.scrollTop;slot.style.height=`${viewport.height}px`;slot.replaceChildren(sheet);if(anchor)this.scroll.scrollTop+=difference;this.ready.add(n);if(n===this.current)this.onReady();}finally{this.tasks.delete(n);}
  }
  async jump(page){if(!this.alive)return;this.current=Math.max(0,Math.min(this.slots.length-1,page));this.scroll.scrollTop=this.slots[this.current].offsetTop-16;this.track();if(!this.ready.has(this.current))await this.render(this.current);}
  destroy(){this.alive=false;cancelAnimationFrame(this.frame);clearTimeout(this.timer);this.scroll.removeEventListener('scroll',this.listen);for(const task of this.tasks.values())task.cancel();this.pending=[];}
}

export class PDFPreviews {
  constructor(pdf){this.pdf=pdf;this.cache=new Map();this.jobs=[];this.running=0;this.alive=true;this.tasks=new Set();this.observers=[];}
  observe(root,container){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){if(!entry.target.classList.contains('preview-loaded'))this.enqueue(entry.target);}else this.jobs=this.jobs.filter(n=>n!==entry.target);}, {root:container,rootMargin:'160px'});root.querySelectorAll('[data-pdf-preview]').forEach(n=>observer.observe(n));this.observers.push(observer);}
  enqueue(node){if(!this.jobs.includes(node))this.jobs.unshift(node);this.pump();}
  pump(){while(this.alive&&this.running<2&&this.jobs.length){const node=this.jobs.shift();if(!node.isConnected)continue;this.running++;this.render(node).catch(error=>{if(this.alive&&error.name!=='RenderingCancelledException')node.classList.add('preview-unavailable');}).finally(()=>{this.running--;this.pump();});}}
  async render(node){const n=Number(node.dataset.pdfPreview);if(this.cache.has(n)){this.show(node,this.cache.get(n));return;}const page=await this.pdf.getPage(n+1);if(!this.alive||!node.isConnected)return;const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:200/base.width}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const task=page.render({canvasContext:canvas.getContext('2d'),viewport});this.tasks.add(task);try{await task.promise;if(!this.alive)return;const url=canvas.toDataURL('image/webp',.75);this.cache.set(n,url);if(this.cache.size>60)this.cache.delete(this.cache.keys().next().value);this.show(node,url);}finally{this.tasks.delete(task);canvas.width=canvas.height=0;}}
  show(node,url){if(!node.isConnected)return;const img=document.createElement('img');img.alt='';img.src=url;node.replaceChildren(img);node.classList.add('preview-loaded');}
  disconnect(){this.observers.forEach(o=>o.disconnect());this.observers=[];this.jobs=[];}
  destroy(){this.alive=false;this.disconnect();for(const t of this.tasks)t.cancel();this.cache.clear();}
}
