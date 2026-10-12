// CSS columns keep a single stable text tree. Highlights use source offsets,
// while the viewport shows exactly one column, irrespective of font or width.
export function textNodes(root) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  let offset=0;
  while(walker.nextNode()){const node=walker.currentNode;nodes.push({node,offset,length:node.length});offset+=node.length;}
  return nodes;
}
export function columnForOffset(root,offset,stride) {
  const nodes=textNodes(root),entry=nodes.find(n=>n.offset+n.length>offset) || nodes.at(-1);
  if(!entry?.length)return 0;
  const index=Math.max(0,Math.min(entry.length-1,offset-entry.offset)),range=document.createRange();
  range.setStart(entry.node,index);range.setEnd(entry.node,index+1);
  const rect=range.getBoundingClientRect(),box=root.getBoundingClientRect();
  return Math.max(0,Math.floor((rect.left-box.left+2)/stride));
}
export function offsetForColumn(root,column,stride) {
  if(column===0)return 0;
  const box=root.getBoundingClientRect();
  for(const {node,offset,length} of textNodes(root)) {
    if(!length)continue;
    const glyphColumn=index=>{const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+1);return Math.max(0,Math.floor((range.getBoundingClientRect().left-box.left+2)/stride));};
    if(glyphColumn(length-1)<column)continue;
    let low=0,high=length-1;
    while(low<high){const middle=Math.floor((low+high)/2);if(glyphColumn(middle)<column)low=middle+1;else high=middle;}
    return offset+low;
  }
  return root.textContent.length;
}
export function paginate(root,book,{anchor=false,last=false}={}) {
  const width=root.clientWidth,gap=64,stride=width+gap;
  root.style.transform='none';
  const count=Math.max(1,Math.ceil((root.scrollWidth+gap-2)/stride));
  let leaf=last ? count-1 : anchor&&Number.isFinite(book.locationOffset) ? columnForOffset(root,book.locationOffset,stride) : book.leaf || 0;
  leaf=Math.max(0,Math.min(count-1,leaf));
  book.leaf=leaf;book.sectionProgress=(leaf+1)/count;
  root.style.transform=`translateX(${-leaf*stride}px)`;
  book.locationOffset=offsetForColumn(root,leaf,stride);
  return {leaf,count,stride};
}
export function visibleSelectionRect(range,container) {
  const bounds=container.getBoundingClientRect();
  const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0&&r.right>bounds.left&&r.left<bounds.right&&r.bottom>bounds.top&&r.top<bounds.bottom);
  if(!rects.length)return bounds;
  return {left:Math.max(bounds.left,Math.min(...rects.map(r=>r.left))),right:Math.min(bounds.right,Math.max(...rects.map(r=>r.right))),top:Math.max(bounds.top,Math.min(...rects.map(r=>r.top))),bottom:Math.min(bounds.bottom,Math.max(...rects.map(r=>r.bottom)))};
}
export function positionSelectionTools(tools,rect) {
  tools.hidden=false;
  const {width,height}=tools.getBoundingClientRect(),margin=12,viewport=window.visualViewport;
  const bottom=(viewport?.height || innerHeight)+(viewport?.offsetTop || 0),left=viewport?.offsetLeft || 0;
  const x=Math.max(left+margin,Math.min(left+(viewport?.width || innerWidth)-width-margin,(rect.left+rect.right-width)/2));
  let y=rect.top-height-12;
  if(y<margin)y=rect.bottom+12;
  y=Math.max(margin,Math.min(bottom-height-margin,y));
  Object.assign(tools.style,{left:`${x}px`,top:`${y}px`,bottom:'auto',transform:'none'});
}
// Preserve just the outgoing sheet. No full-screen snapshot or book data leaves
// the device; canvas copies keep PDFs visible during the same animation.
export function snapshotPage(stage,direction=1,style='page') {
  const page=stage?.querySelector('.epub-sheet,.pdf-sheet');if(!page)return null;
  const box=page.getBoundingClientRect(),parent=stage.getBoundingClientRect(),clone=page.cloneNode(true);
  const computed=getComputedStyle(page);
  clone.classList.remove('epub-sheet','pdf-sheet');clone.classList.add('book-snapshot-sheet');
  for(const property of ['backgroundColor','borderRadius','padding','boxShadow','boxSizing','overflow','position','display','fontFamily','fontSize','lineHeight','color'])clone.style[property]=computed[property];
  // Immersive pages use the surrounding paper. Their moving copy needs that
  // opaque paper too, otherwise old and new text would overlap in a turn.
  if(computed.backgroundColor==='rgba(0, 0, 0, 0)')clone.style.backgroundColor=getComputedStyle(stage.closest('.reader')).getPropertyValue('--reader-paper');
  clone.style.backgroundImage=computed.backgroundImage;
  clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  const originals=page.querySelectorAll('canvas');clone.querySelectorAll('canvas').forEach((canvas,index)=>{canvas.getContext('2d').drawImage(originals[index],0,0);Object.assign(canvas.style,{display:'block',width:'100%',height:'auto'});});
  // The canvas already contains PDF text. Keep interactive text layers out of
  // animation copies so selections and source lookups always see one layer.
  clone.querySelector('.textLayer')?.remove();
  Object.assign(clone.style,{width:`${box.width}px`,height:`${box.height}px`,margin:'0',flexShrink:'0'});
  // The cloned article must keep the original column height and source offset.
  const flow=clone.querySelector('.epub-page');if(flow)flow.style.setProperty('--content-height',`${page.querySelector('.epub-window').clientHeight}px`);
  return {clone,width:box.width,height:box.height,left:box.left-parent.left,top:box.top-parent.top,direction,style};
}
export function animateTurn(stage,snapshot,direction,style='page',onFinish) {
  const page=stage?.querySelector('.epub-sheet,.pdf-sheet');
  if(!page||!snapshot){onFinish?.();return Promise.resolve();}
  const next=snapshotPage(stage,direction,style),layer=document.createElement('div');
  layer.className='book-turn-layer';layer.dataset.direction=direction>0?'forward':'backward';layer.dataset.style=style;layer.setAttribute('aria-hidden','true');layer.inert=true;
  Object.assign(layer.style,{width:`${next.width}px`,height:`${next.height}px`,left:`${next.left}px`,top:`${next.top}px`});
  const old=document.createElement('div'),incoming=document.createElement('div');old.className='book-turn-old';incoming.className='book-turn-incoming';old.append(snapshot.clone);incoming.append(next.clone);
  for(const face of [snapshot.clone,next.clone]){face.style.width=`${next.width}px`;face.style.height=`${next.height}px`;face.querySelector('.epub-page')?.style.setProperty('will-change','auto');}
  layer.append(old,incoming);stage.append(layer);page.style.opacity='0';
  const animations=[],forward=direction>0,duration=style==='page'?460:style==='slide'?280:180,easing='cubic-bezier(.22,.61,.36,1)';
  const run=(node,frames,curve=easing)=>animations.push(node.animate(frames,{duration,easing:curve,fill:'forwards'}));
  if(style==='fade'){run(old,[{opacity:1},{opacity:0}]);run(incoming,[{opacity:0},{opacity:1}]);}
  else if(style==='slide'){
    const sign=forward?-1:1;run(old,[{transform:'translate3d(0,0,0)',opacity:1},{transform:`translate3d(${sign*12}%,0,0)`,opacity:0}]);run(incoming,[{transform:`translate3d(${-sign*8}%,0,0)`,opacity:0},{transform:'translate3d(0,0,0)',opacity:1}]);
  }else{
    const leaf=forward?old:incoming,stationary=forward?incoming:old;
    stationary.style.zIndex='0';leaf.style.zIndex='2';leaf.style.transformOrigin='left center';
    const fold=document.createElement('div'),shadow=document.createElement('div');fold.className='book-turn-fold';shadow.className='book-turn-shadow';leaf.append(fold);layer.append(shadow);
    // Backward is the previous (incoming) sheet opening from the spine. It is
    // the inverse of forward, never a mirrored turn of the outgoing text.
    if(forward){run(leaf,[{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-82deg)',opacity:1,offset:.9},{transform:'rotateY(-91deg)',opacity:0}],'cubic-bezier(.28,.14,.2,1)');}
    else{run(leaf,[{transform:'rotateY(-89deg)',opacity:0},{transform:'rotateY(-80deg)',opacity:1,offset:.08},{transform:'rotateY(0deg)',opacity:1}],'cubic-bezier(.22,.61,.36,1)');}
    run(fold,[{opacity:0},{opacity:.75,offset:.48},{opacity:0}]);run(shadow,[{opacity:0,transform:'scaleX(.1)'},{opacity:.5,transform:'scaleX(.7)',offset:.45},{opacity:0,transform:'scaleX(.1)'}]);
  }
  return Promise.all(animations.map(a=>a.finished.catch(()=>{}))).finally(()=>{animations.forEach(a=>a.cancel());layer.remove();if(page.isConnected)page.style.opacity='';onFinish?.();});
}
