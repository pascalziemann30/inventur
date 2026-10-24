import {Coffee,Milk,Carrot,CakeSlice,Package,Utensils,Soup,SprayCan,GlassWater} from 'lucide-react';
export default function CategoryIcon({name}){
 const Icon=/betrieb|ausstattung/i.test(name)?Coffee:/milch|käse|pflanzen/i.test(name)?Milk:/obst|gemüse/i.test(name)?Carrot:/gebäck|kuchen/i.test(name)?CakeSlice:/reinigung|hygiene/i.test(name)?SprayCan:/getränk/i.test(name)?GlassWater:/suppe|fertig/i.test(name)?Soup:/verpack/i.test(name)?Package:Utensils;
 return <span className="product-category-icon" aria-hidden="true"><Icon size={22}/></span>;
}
