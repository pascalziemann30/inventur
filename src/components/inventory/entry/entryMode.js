// This marker selects transport only. The server checks the signed cookie on every request.
const modeKey='inventory_entry_transport';
export const employeeMode=()=>globalThis.sessionStorage?.getItem(modeKey)==='employee';
export const selectEmployeeMode=()=>globalThis.sessionStorage.setItem(modeKey,'employee');
export const selectAdminMode=()=>globalThis.sessionStorage.removeItem(modeKey);
export function takeLaunch(location,history){
 const fragment=new URLSearchParams(location.hash.slice(1));
 const launch=fragment.get('inventory_launch');
 if(fragment.has('inventory_launch')){
  fragment.delete('inventory_launch');
  history.replaceState(null,'',`${location.pathname}${location.search}${fragment.size?`#${fragment}`:''}`);
 }
 return launch;
}
export function entryTransport({admin,employee,isEmployee=employeeMode}){
 const allowed=new Set(['locationEntry','inventoryRuns','deliveryDrafts','reviewDelivery','scanDelivery']);
 return {
  functions:{invoke:(name,input)=>{
   if(!isEmployee())return admin.functions.invoke(name,input);
   if(!allowed.has(name))throw new Error('Dieser Vorgang gehört zum Administratorbereich.');
   return employee.functions.invoke(name,input);
  }},
  auth:{me:()=>{if(isEmployee())throw new Error('Bitte den bestätigten Standortzugang verwenden.');return admin.auth.me();}},
  entities:new Proxy({}, {get:(_target,name)=>{if(isEmployee())throw new Error('Direkter Datenzugriff ist im Mitarbeitereinstieg gesperrt.');return admin.entities[name];}}),
 };
}
