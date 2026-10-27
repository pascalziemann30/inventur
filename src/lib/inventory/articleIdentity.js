// Frontend copy of base44/shared/inventory/articleIdentity.js — keep identical to the backend original.
// A suggestion is never an identity decision. Keep all size/variant/number tokens.
const tokens=value=>new Set(String(value||'').normalize('NFKC').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/u).filter(Boolean));
export function similarArticles(value,articles,excludeId=null){
 const wanted=tokens(value);if(wanted.size<2||String(value).trim().length<5)return [];
 return articles.filter(r=>r.id!==excludeId).map(r=>{
  const candidate=tokens(r.name);let overlap=0;for(const word of wanted)if(candidate.has(word))overlap++;
  return {...r,similarity:overlap/Math.max(wanted.size,candidate.size)};
 }).filter(r=>r.similarity>=0.6).sort((a,b)=>b.similarity-a.similarity).slice(0,8);
}