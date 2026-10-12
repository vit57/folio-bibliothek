import JSZip from 'jszip';
export async function epubFixture(){
  const zip=new JSZip();zip.file('mimetype','application/epub+zip');
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>EPUB Lernprobe</dc:title><dc:creator>Testautor</dc:creator></metadata><manifest><item id="one" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>');
  zip.file('OPS/chapter1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ein Anfang</title></head><body><h1>Aufmerksamkeit</h1><p>Bewusstes Lesen verbindet neue Gedanken mit vorhandenen Erfahrungen. Diese EPUB Lernprobe ist ein Test der Bibliothek.</p><p>Ein kleiner Gedanke kann eine große Frage öffnen.</p><script>window.EPUB_EXECUTED=true</script><img src="https://example.com/tracker.png" onerror="window.EPUB_EXECUTED=true"/><iframe src="https://example.com"/></body></html>');
  zip.file('OPS/chapter2.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Vertiefung</h1><p>Wiederholung mit Abstand hilft beim Erinnern. Das Stichwort Sternenkarte steht ausschließlich im zweiten Kapitel.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export function pdfFixture(){
  const objects=[];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>');
  const page1='BT /F1 22 Tf 45 620 Td (PDF Lernprobe) Tj 0 -55 Td /F1 17 Tf (Aufmerksamkeit verbindet Lesen und Verstehen.) Tj 0 -30 Td (Ein Gedanke bleibt durch Wiederholung.) Tj ET';
  objects.push(`<< /Length ${page1.length} >>\nstream\n${page1}\nendstream`);
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>');
  const page2='BT /F1 22 Tf 45 620 Td (Zweites Kapitel) Tj 0 -55 Td /F1 17 Tf (Die Mondbibliothek ist eine eigene Textfundstelle.) Tj ET';
  objects.push(`<< /Length ${page2.length} >>\nstream\n${page2}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let output='%PDF-1.4\n',offsets=[0];for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const start=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))output+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(output);
}

export async function paginationFixture(){
  const zip=await JSZip.loadAsync(await epubFixture());
  const paragraph='Lesen verbindet Beobachtung, Erfahrung und eine neue Frage. Ein Gedanke braucht Zeit, um klar zu werden. ';
  zip.file('OPS/chapter1.xhtml','<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title/><link href=\"styles.css\" rel=\"stylesheet\"/></head><body><h1>Ein langer Gedanke</h1><p>'+paragraph.repeat(180)+' ABSATZ_ENDE.</p><p>NEUER_ABSATZ.</p></body></html>');
  const {createCanvas}=await import('@napi-rs/canvas');const canvas=createCanvas(300,1300);const ctx=canvas.getContext('2d');ctx.fillStyle='#708664';ctx.fillRect(0,0,300,1300);ctx.fillStyle='#ece8d2';ctx.fillRect(50,100,200,1100);
  zip.file('OPS/portrait.png',canvas.toBuffer('image/png'));
  zip.file('OPS/chapter2.xhtml','<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title/></head><body><h1>Eine Illustration</h1><p><img src=\"portrait.png\" alt=\"Hochformat-Test\"/></p><p>BILD_ENDE. Text unter dem Hochformat.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

export async function chaptersFixture(){
  const zip=await JSZip.loadAsync(await epubFixture());
  zip.file('OPS/book.opf','<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Verknüpfte Kapitel</dc:title></metadata><manifest><item id="one" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>');
  zip.file('OPS/nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml#a">Erstes echtes Kapitel</a></li><li><a href="chapter1.xhtml#b">Zweites echtes Kapitel</a></li></ol></nav></body></html>');
  zip.file('OPS/chapter1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><h1 id="a">Kapitel A</h1><p>'+('Ein Gedanke wird durch eigene Beispiele verständlich. '.repeat(120))+'</p><h1 id="b">Kapitel B</h1><p>Ein neuer Zusammenhang braucht eine andere Erklärung.</p></body></html>');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

export async function bundleFixture({title='EPUB im Buchordner',prefix='7 Strategies.epub/',caseVariant=false,missingContainer=false,encrypted=false}={}){
  const source=await JSZip.loadAsync(await epubFixture()),zip=new JSZip();
  source.file('OPS/book.opf',(await source.file('OPS/book.opf').async('string')).replace('EPUB Lernprobe',title));
  // A tiny raster cover makes relative asset lookup part of the check.
  source.file('OPS/cover.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=','base64'));
  source.file('OPS/book.opf',(await source.file('OPS/book.opf').async('string')).replace('<manifest>','<manifest><item id="cover" href="cover.png" properties="cover-image" media-type="image/png"/>'));
  if(encrypted)source.file('META-INF/encryption.xml','<encryption><EncryptedData><EncryptionMethod Algorithm="urn:test:drm"/></EncryptedData></encryption>');
  for(const entry of Object.values(source.files))if(!entry.dir){if(missingContainer&&entry.name==='META-INF/container.xml')continue;const name=caseVariant?entry.name.replace('META-INF/container.xml','meta-inf/Container.XML').replace('META-INF/encryption.xml','meta-inf/Encryption.XML'):entry.name;zip.file(prefix+name,await entry.async('uint8array'));}
  zip.file('__MACOSX/._Metadata','noise');return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
