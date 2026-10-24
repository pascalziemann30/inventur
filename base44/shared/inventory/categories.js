// Confirmed category aliases. This is a controlled vocabulary, not fuzzy product classification.
const key=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('de').replace(/[\/&+\-–—]+/gu,' und ').replace(/\s+/gu,' ');
const groups=[
 ['Reinigung und Hygiene',['Reinigung / Hygiene','Reinigung - Hygiene','Reinigung & Hygiene']],
 ['Milchprodukte und Pflanzendrinks',['Milch / Käse','Milch und Käse','Milch / Kaese']],
 ['Getränke und Getränkezutaten',['Getränke']],
 ['Verpackung und Verbrauchsmaterial',['Verpackung','Verpackungen','Verpackungen und Verbrauchsmaterial']],
];
const aliases=new Map(groups.flatMap(([canonical,variants])=>[canonical,...variants].map(label=>[key(label),canonical])));
const canonicalNames=new Set(groups.map(([name])=>name));
export function canonicalCategory(value){const label=String(value||'').trim();return aliases.get(key(label))||label;}
export function categoryChoices(labels){return [...new Set(labels.map(canonicalCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));}
export function categoryGroupKey(label,id){const name=canonicalCategory(label);return canonicalNames.has(name)?`category:${name}`:id||name;}
