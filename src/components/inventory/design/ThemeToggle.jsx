import {useLayoutEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import './product.css';
const key='prdktcntrl:appearance';
export function initialAppearance(){
 try{const stored=localStorage.getItem(key);if(stored==='light'||stored==='dark')return stored;}catch{/* Appearance must work when browser storage is unavailable. */}
 return typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export default function ThemeToggle(){
 const [theme,setTheme]=useState(initialAppearance);
 useLayoutEffect(()=>{document.documentElement.dataset.inventoryTheme=theme;try{localStorage.setItem(key,theme);}catch{/* Keep the chosen appearance for this view. */}},[theme]);
 const label=theme==='dark'?'Hellmodus aktivieren':'Dunkelmodus aktivieren';
 return <button type="button" className="inventory-theme-toggle" aria-label={label} title={label} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>;
}
