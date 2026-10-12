// Loaded only when an export is requested. All fonts are bundled and work offline.
import {jsPDF} from 'jspdf';
import {appPath} from './app-paths.js';
let fontsPromise;
async function fontBytes(){
  if(!fontsPromise)fontsPromise=Promise.all(['Regular','Bold'].map(async style=>{
    const response=await fetch(appPath(`pdf/fonts/LiberationSans-${style}.ttf`));if(!response.ok)throw new Error('Die PDF-Schrift konnte nicht geladen werden.');
    const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(binary);
  })).catch(error=>{fontsPromise=null;throw error;});
  return fontsPromise;
}
export async function documentsPDF(documents){
  const characters=documents.reduce((n,d)=>n+d.blocks.reduce((n,b)=>n+b.text.length,0),0);
  if(characters>2000000)throw new Error('Für dieses große Journal bitte Markdown verwenden oder einzelne Bücher als PDF exportieren.');
  const fonts=await fontBytes(),pdf=new jsPDF({unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
  for(let index=0;index<2;index++){const name=`Folio-${index}.ttf`;pdf.addFileToVFS(name,fonts[index]);pdf.addFont(name,'Folio',index?'bold':'normal');}
  pdf.setProperties({title:documents.length===1?documents[0].book.title:'folio. Lesejournal',subject:'Notizen, Markierungen und Buchanalysen',creator:'folio.'});
  const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight(),margin=52,bottom=height-62;
  let y=72;
  const fresh=()=>{pdf.addPage();y=72;};
  const ensure=space=>{if(y+space>bottom)fresh();};
  // Keep unsupported glyphs explicit instead of silently losing user content.
  const glyphs=pdf.internal.getFont('Folio','normal').metadata.cmap?.unicode?.codeMap;
  const printable=text=>String(text).replace(/\r\n?/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[^\u0000-\uFFFF]|[^\S\n ]/gu,c=>c==='\t'?'    ':c.charCodeAt(0)>0xffff||c.length>1?`[U+${c.codePointAt(0).toString(16).toUpperCase()}]`:c);
  for(const [index,document] of documents.entries()){
    if(index)fresh();
    for(const block of document.blocks){
      const title=block.type==='title',heading=title||block.type==='h2'||block.type==='h3',meta=block.type==='meta',quote=block.type==='quote';
      const size=title?24:block.type==='h2'?17:block.type==='h3'?12:meta?9.5:11.5,lineHeight=meta?14:heading?size*1.35:17;
      pdf.setFont('Folio',heading?'bold':'normal');pdf.setFontSize(size);
      pdf.setTextColor(...(meta?[106,116,101]:heading?[50,74,53]:[39,45,39]));
      let text=printable(block.text);
      if(glyphs)text=Array.from(text).map(c=>c==='\n'||glyphs[c.codePointAt(0)]?c:`[U+${c.codePointAt(0).toString(16).toUpperCase()}]`).join('');
      const inset=quote?15:0,lines=pdf.splitTextToSize(text,width-2*margin-inset);
      // Long answers flow naturally across pages; reserve only their first
      // lines. Headings keep room for the beginning of the following answer.
      ensure(heading?Math.min(lines.length*lineHeight+48,bottom-72):Math.min(lines.length,2)*lineHeight);
      if(heading)y+=title?0:12;
      for(const line of lines){
        ensure(lineHeight);
        if(quote){pdf.setDrawColor(160,178,141);pdf.setLineWidth(2);pdf.line(margin,y-11,margin,y+5);}
        pdf.text(line,margin+inset,y);y+=lineHeight;
      }
      y+=meta?5:12;
    }
  }
  const pages=pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    pdf.setPage(page);pdf.setDrawColor(216,223,211);pdf.setLineWidth(.6);pdf.line(margin,40,width-margin,40);pdf.line(margin,height-42,width-margin,height-42);
    pdf.setFont('Folio','normal');pdf.setFontSize(9);pdf.setTextColor(103,117,99);pdf.text('folio.  /  Lesen & Verstehen',margin,29);pdf.text('Mein Lesejournal',margin,height-26);pdf.text(`${page} / ${pages}`,width-margin,height-26,{align:'right'});
  }
  return pdf.output('blob');
}
