// EPUB bundles can acquire an enclosing folder when a Files provider packages
// them. Use a virtual root: keep original bytes, links and encryption metadata.
const ignored=name=>name.split('/').some(part=>part==='__MACOSX'||part.startsWith('._')||part==='.DS_Store');
const entries=zip=>Object.values(zip.files).filter(entry=>!entry.dir&&!ignored(entry.name));
export function findEPUBPackage(zip){
  const files=entries(zip),containers=files.filter(entry=>/(?:^|\/)META-INF\/container\.xml$/i.test(entry.name));
  const atRoot=containers.filter(entry=>entry.name.toLowerCase()==='meta-inf/container.xml');
  if(atRoot.length>1||!atRoot.length&&containers.length>1)throw new Error('Die EPUB-Buchstruktur ist mehrdeutig. Bitte die Bücher einzeln importieren.');
  const container=atRoot[0]||containers[0];
  if(container)return {prefix:container.name.slice(0,-'META-INF/container.xml'.length),container:container.name,packagePath:null};
  const packages=files.filter(entry=>/\.opf$/i.test(entry.name));
  // The package's own manifest and spine are validated by the EPUB parser.
  // Never guess between multiple OPF files when container metadata is absent.
  if(packages.length===1)return {prefix:'',container:null,packagePath:packages[0].name};
  return null;
}
export function scopeEPUB(zip,info){
  const files=entries(zip).filter(entry=>entry.name.startsWith(info.prefix)),aliases=new Map();
  for(const entry of files){const key=entry.name.toLowerCase();if(!aliases.has(key))aliases.set(key,[]);aliases.get(key).push(entry);}
  return {file(path){const key=info.prefix+path,exact=zip.file(key),matches=aliases.get(key.toLowerCase())||[];
    if(matches.length>1&&(!exact||/^META-INF\//i.test(path)))throw new Error('Mehrdeutige Dateinamen in der EPUB-Buchstruktur.');
    return exact||matches[0]||null;},encryption:files.filter(entry=>/(?:^|\/)META-INF\/encryption\.xml$/i.test(entry.name))};
}
