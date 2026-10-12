// Geometry is collected only after pagination, then reused for each tap.
// Fragmented highlights and PDF spans are merged into actual visible lines.
export function visibleReadingLines(root,viewport,clip=null){
  if(!root||!viewport)return [];
  const view=viewport.getBoundingClientRect(),mask=clip?.getBoundingClientRect(),bounds=mask?{top:Math.max(view.top,mask.top),bottom:Math.min(view.bottom,mask.bottom),left:Math.max(view.left,mask.left),right:Math.min(view.right,mask.right)}:view,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),rects=[];
  while(walker.nextNode()){
    const node=walker.currentNode;if(!node.textContent.trim())continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const r of range.getClientRects())if(r.width>1&&r.height>2&&r.left<bounds.right&&r.right>bounds.left&&r.top>=bounds.top-1&&r.bottom<=bounds.bottom+1)rects.push({top:r.top,bottom:r.bottom,left:Math.max(bounds.left,r.left),right:Math.min(bounds.right,r.right)});
  }
  rects.sort((a,b)=>a.top-b.top||a.left-b.left);
  const lines=[];
  for(const r of rects){const last=lines.at(-1),center=(r.top+r.bottom)/2;if(last&&Math.abs((last.top+last.bottom)/2-center)<Math.min(last.bottom-last.top,r.bottom-r.top)*.45){last.top=Math.min(last.top,r.top);last.bottom=Math.max(last.bottom,r.bottom);last.left=Math.min(last.left,r.left);last.right=Math.max(last.right,r.right);}else lines.push({...r});}
  return lines;
}
export function nearestReadingLine(lines,y){let best=0,distance=Infinity;for(let n=0;n<lines.length;n++){const d=Math.abs((lines[n].top+lines[n].bottom)/2-y);if(d<distance){best=n;distance=d;}}return best;}
