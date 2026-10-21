import React from 'react';
import {createRoot} from 'react-dom/client';
import CountingWorkspace from '../components/inventory/counting/CountingWorkspace.jsx';
import {selectCountItems} from '../components/inventory/counting/countModel.js';

// Synthetic examples only. No supplier catalog, no SDK, no network persistence.
const examples = [
    {article_id:'demo-milk', article_name:'Beispielmilch', category_name:'Molkerei', unit_abbreviation:'l', last_stock:18,
        count_units:[{code:'carton',label:'Kartons',base_quantity:10},{code:'pack',label:'Packungen',base_quantity:1}]},
    {article_id:'demo-cake', article_name:'Beispieltorte', category_name:'Kuchen & Gebäck', unit_abbreviation:'Stk', last_stock:24,
        count_units:[{code:'cake',label:'Ganze Torten',base_quantity:12,whole_numbers_only:true},{code:'piece',label:'Kuchenstücke',base_quantity:1,whole_numbers_only:true}]},
    {article_id:'demo-fruit', article_name:'Beispielobst', category_name:'Obst & Gemüse', unit_abbreviation:'kg', last_stock:3.5,
        count_units:[{code:'kg',label:'Kilogramm',base_quantity:1}]},
    {article_id:'demo-paper', article_name:'Beispielpapier', category_name:'Verbrauchsmaterial', unit_abbreviation:'Rollen', last_stock:12,
        count_units:[{code:'pack',label:'Packungen',base_quantity:8},{code:'roll',label:'Einzelne Rollen',base_quantity:1,whole_numbers_only:true}]},
].map(item => ({...item, inventory_intervals:['monthly','yearly'], status:'open', values:{}, counted_quantity:null}));
let saved = null;
let revision = 0;
const receipts = new Map();
const saveDraft = async request => {
    if (receipts.has(request.id)) return receipts.get(request.id);
    if (request.revision !== revision) throw new Error('Der Vorschau-Zwischenstand wurde inzwischen geändert.');
    saved = structuredClone(request.snapshot);
    revision++;
    const acknowledgment = {request_id:request.id, revision};
    receipts.set(request.id, acknowledgment);
    return acknowledgment;
};
createRoot(document.getElementById('root')).render(<CountingWorkspace initialEntries={selectCountItems(examples)} outletName="Kuno15 · Vorschau"
    saveDraft={saveDraft} preview completeSession={async () => {if (!saved) throw new Error('Bitte zuerst Mengen erfassen.');}}/>);
