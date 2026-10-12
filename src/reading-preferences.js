// Local palettes and system fonts; book files cannot supply CSS or font URLs.
export const readingThemes = [
  {id:'original',name:'Original',paper:'#ffffff',bg:'#f2f3f1',ink:'#242823',muted:'#62685e',line:'#dce0d8'},
  {id:'quiet',name:'Quiet',paper:'#252d27',bg:'#1d2420',ink:'#e7e9df',muted:'#b2bcaf',line:'#3c483e'},
  {id:'paper',name:'Paper',paper:'#fcfaf5',bg:'#f1eee6',ink:'#39362d',muted:'#70685a',line:'#ded8c9'},
  {id:'bold',name:'Bold',paper:'#ffffff',bg:'#f0f0ed',ink:'#111111',muted:'#585851',line:'#ccccbf'},
  {id:'calm',name:'Calm',paper:'#f2e6ce',bg:'#e8dfcc',ink:'#514330',muted:'#75634a',line:'#d6c5a5'},
  {id:'focus',name:'Focus',paper:'#f6f8ef',bg:'#e6ebdf',ink:'#384932',muted:'#5e7052',line:'#cfdbc4'},
  {id:'midnight',name:'Mitternacht',paper:'#17191f',bg:'#101216',ink:'#e4e5ed',muted:'#afb1c4',line:'#363945'},
  {id:'ocean',name:'Ozean',paper:'#eaf3f6',bg:'#dce9ee',ink:'#29424d',muted:'#536b77',line:'#c2d5dd'},
  {id:'rose',name:'Rosé',paper:'#fbefec',bg:'#efe0dc',ink:'#57413e',muted:'#79605b',line:'#e2ccc6'},
  {id:'sepia',name:'Sepia',paper:'#dfc9a3',bg:'#cdb78f',ink:'#403523',muted:'#65533a',line:'#baa37a'},
  {id:'aged',name:'Altes Papier',paper:'#f0dfba',bg:'#cabb98',ink:'#46321d',muted:'#705735',line:'#c3a976'},
  {id:'antique',name:'Antike',paper:'#f9f4e7',bg:'#e4dac6',ink:'#3f3430',muted:'#756458',line:'#cdbc9b'},
  {id:'editorial',name:'Editorial',paper:'#fffefb',bg:'#e8e5dd',ink:'#171918',muted:'#626763',line:'#c6c9c5'},
  {id:'library',name:'Bibliothek',paper:'#f3e8d0',bg:'#2d2019',ink:'#3e2c20',muted:'#74573d',line:'#c7ab7c'},
  {id:'magic',name:'Magie',paper:'#211d34',bg:'#11121f',ink:'#f4ebdd',muted:'#cabae1',line:'#584769'}
];
export const readingFonts = [
  ['Georgia','Georgia','Georgia, serif'],
  ['Palatino','Palatino','Palatino, "Palatino Linotype", "Book Antiqua", serif'],
  ['Baskerville','Baskerville','Baskerville, "Baskerville Old Face", Georgia, serif'],
  ['Charter','Charter','Charter, "Bitstream Charter", Georgia, serif'],
  ['Iowan Old Style','Iowan','"Iowan Old Style", "Palatino Linotype", Palatino, serif'],
  ['Times New Roman','Times','"Times New Roman", Times, serif'],
  ['Avenir Next','Avenir','"Avenir Next", Avenir, Arial, sans-serif'],
  ['Optima','Optima','Optima, Candara, Arial, sans-serif'],
  ['Verdana','Verdana','Verdana, Geneva, sans-serif'],
  ['Arial','Arial','Arial, Helvetica, sans-serif'],
  ['system-ui','System','system-ui, sans-serif'],
  ['Liberation Sans','Liberation Sans','"Folio Liberation", Arial, sans-serif'],
  ['Courier New','Courier','"Courier New", Courier, monospace']
];
export const appDesigns=[['folio','Folio'],['glass','Liquid Glass'],['realpaper','Echtpapier'],['aged','Altes Papier'],['antique','Antike'],['editorial','Editorial'],['library','Bibliothek'],['magic','Magie']];
export function readingPalette(id){return readingThemes.find(t=>t.id===id)||readingThemes[2];}
export function readingFont(id){return readingFonts.find(f=>f[0]===id)?.[2]||readingFonts[0][2];}
export function normalizeReadingPreferences(p){
  const bounded=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  return {...p,theme:readingPalette(p.theme).id,font:readingFonts.some(f=>f[0]===p.font)?p.font:'Georgia',
    appDesign:appDesigns.some(d=>d[0]===p.appDesign)?p.appDesign:'folio',
    size:bounded(p.size,18,48,26),leading:bounded(p.leading,1.3,2.3,1.8),pageWidth:bounded(p.pageWidth,380,1200,760),
    boldText:p.boldText===true,lineGuide:p.lineGuide===true,guideLines:[1,3,5].includes(p.guideLines)?p.guideLines:1,
    guidePosition:bounded(p.guidePosition,5,95,42),guideDim:p.guideDim!==false,guideDimming:['none','low','medium','high'].includes(p.guideDimming)?p.guideDimming:'medium',themeLinked:p.themeLinked!==false,readingSurface:p.readingSurface==='framed'?'framed':'integrated',pdfMode:p.pdfMode==='scroll'?'scroll':'paged',tracking:bounded(p.tracking,0,.08,0),textAlign:['left','justify'].includes(p.textAlign)?p.textAlign:'left',ambientMotion:p.ambientMotion!==false};
}

export const designThemes={folio:'paper',glass:'ocean',realpaper:'paper',aged:'aged',antique:'antique',editorial:'editorial',library:'library',magic:'magic'};
export function designReadingPalette(design,dark){
  const palette={...readingPalette(designThemes[design])};
  if(!dark&&design==='magic')Object.assign(palette,{paper:'#f5f0fa',bg:'#ebe5f3',ink:'#302641',muted:'#6d5d80',line:'#cabbd8'});
  if(dark){const colors={folio:['#222b24','#1a211c','#e9ecdf','#b8c3b1','#414f42'],glass:['#1c2930','#142128','#e5f1f4','#adc5d0','#3c5561'],realpaper:['#292720','#201e19','#eee6ce','#c6bca4','#5d5545'],aged:['#30251a','#241b13','#f3e3c0','#cfb58b','#654c30'],antique:['#292720','#201f1b','#eee6d1','#c5b89a','#61583e'],editorial:['#222321','#181918','#f5f2e8','#c8c8be','#4d5149'],library:['#30241b','#191410','#f4e4c6','#d3b58b','#67513b'],magic:['#211d34','#11121f','#f4ebdd','#cabae1','#584769']};['paper','bg','ink','muted','line'].forEach((key,n)=>palette[key]=(colors[design]||colors.folio)[n]);}
  return palette;
}
