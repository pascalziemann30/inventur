// Entirely synthetic and shared by the manual UI exercise and automated checks.
const names = ['Beispielmilch 1 l','Beispielobst','Beispielkaffee','Beispieltee','Beispielreis',
    'Beispielnudeln','Beispielzucker','Beispielmehl','Beispielreiniger'];
export function deliveryExamples(scenario = 'everyday') {
    const catalog = {offers:[],items:[],globals:[]};
    names.forEach((name,index) => {
        const id=String(index+1).padStart(3,'0');
        catalog.globals.push({id:`global-${id}`,canonical_name:name,unit_abbreviation:index===0 || index===8 ? 'l':'kg'});
        catalog.items.push({id:`item-${id}`,global_item_id:`global-${id}`,outlet_id:'demo-outlet',supplier_id:'demo-supplier',display_name:name,is_active:true});
        catalog.offers.push({id:`offer-${id}`,global_item_id:`global-${id}`,supplier_id:'demo-supplier',supplier_article_number:id,
            original_name:name,purchase_unit_code:index===0?'KT':'PK',purchase_unit_label:index===0?'Karton mit 10 × 1 l':'Packung',
            base_quantity_per_purchase:index===0?10:1,unit_abbreviation:index===0 || index===8?'l':'kg',
            net_purchase_price:index===0?15:5,revision:0,status:'approved'});
    });
    const lines = catalog.offers.map((offer,index) => ({id:`line-${index+1}`,original_name:offer.original_name,
        supplier_article_number:offer.supplier_article_number,purchase_unit_code:offer.purchase_unit_code,
        purchase_quantity:index===0?'2,5':'1',net_purchase_price:String(offer.net_purchase_price)}));
    lines.push({id:'line-10',original_name:'Neue Beispielzutat',supplier_article_number:'NEU-010',purchase_unit_code:'BT',purchase_quantity:'2',net_purchase_price:'7,50'});
    if (scenario === 'conflicts') {
        catalog.offers[1].base_quantity_per_purchase=0;
        catalog.offers.push({...catalog.offers[2],id:'offer-duplicate'});
        lines[3].purchase_unit_code='UNBEKANNT';
        lines[4].supplier_article_number='';
        lines[5]={...lines[0],id:'line-6'};
        lines[6].net_purchase_price='';
        lines[7].net_purchase_price='6,50';
        lines[8].original_name='Beispielreiniger 600 ml';
    }
    return {catalog,lines,outletId:'demo-outlet',supplierId:'demo-supplier'};
}
