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
 return <button type="button" className="inventory-theme-toggle" data-theme={theme} aria-pressed={theme==='dark'} aria-label={label} title={label} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><span className="inventory-theme-sun" aria-hidden="true"><Sun size={18}/></span><span className="inventory-theme-moon" aria-hidden="true"><Moon size={18}/></span></button>;
}
