import {BookingError} from '../../shared/inventory/quantities.js';
import {base44StockStore} from '../../shared/inventory/base44Store.js';
import {bookStockOperation} from '../../shared/inventory/stock.js';

const definitions=[
    {code:'milk',name:'TEST · Milch',unit:'l',unitName:'Liter',type:'volume',stock:10,price:1.5,intervals:['weekly','monthly','yearly'],units:[{code:'carton',label:'Kartons',base_quantity:10},{code:'pack',label:'Packungen',base_quantity:1}]},
    {code:'cake',name:'TEST · Torte',unit:'Stk',unitName:'Stück',type:'count',stock:24,price:2.25,intervals:['monthly','yearly'],units:[{code:'cake',label:'Ganze Torten',base_quantity:12,whole_numbers_only:true},{code:'piece',label:'Kuchenstücke',base_quantity:1,whole_numbers_only:true}]},
    {code:'fruit',name:'TEST · Obst',unit:'kg',unitName:'Kilogramm',type:'weight',stock:3.5,price:2,intervals:['monthly','yearly'],units:[{code:'kg',label:'Kilogramm',base_quantity:1}]},
    {code:'paper',name:'TEST · Papier',unit:'Rollen',unitName:'Rollen',type:'count',stock:12,price:0.5,intervals:['monthly','yearly'],units:[{code:'pack',label:'Packungen',base_quantity:8},{code:'roll',label:'Einzelne Rollen',base_quantity:1,whole_numbers_only:true}]},
];

export function createInventoryTestSetupHandler({createClientFromRequest,isEnabled,uuid=()=>crypto.randomUUID()}) {
    return async req=>{
        let stage='authorize';
        try {
            if (req.method !== 'POST') return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
            const client=createClientFromRequest(req);
            let user;
            try {user=await client.auth.me();} catch {throw new BookingError('AUTHENTICATION_REQUIRED',401);}
            if (!user?.id) throw new BookingError('AUTHENTICATION_REQUIRED',401);
            if (user.role !== 'admin') throw new BookingError('ADMIN_REQUIRED',403);
            if (req.headers.get('X-Data-Env') !== 'dev' || !isEnabled(req)) throw new BookingError('INVENTORY_TEST_ROLLOUT_DISABLED',503);
            const body=await req.json();
            if (!body || !['prepare','inspect','delivery'].includes(body.action) || Object.keys(body).some(key=>!['action','outlet_id','request_id'].includes(key))) throw new BookingError('INVALID_REQUEST',400);
            const entities=client.asServiceRole.entities;
            if (body.action === 'prepare') {
                stage='prepare';
                const tag=uuid();
                const outlet=await entities.Outlet.create({name:`INVENTUR-TEST · ${tag.slice(0,8)}`,code:`INVENTORY-TEST-${tag}`,type:'NORMAL',is_active:true});
                const supplier=await entities.Supplier.create({name:`TEST-Lieferant · ${tag.slice(0,8)}`,is_active:true,notes:'Synthetische Beispieldaten, keine echten Lieferantendaten.'});
                const category=await entities.Category.create({name:`Inventur-Test · ${tag.slice(0,8)}`});
                for (const definition of definitions) {
                    const unit=await entities.Unit.create({name:definition.unitName,abbreviation:definition.unit,type:definition.type});
                    const global=await entities.GlobalItem.create({canonical_name:definition.name,unit_id:unit.id,unit_abbreviation:definition.unit,category_id:category.id,category_name:category.name});
                    const item=await entities.OutletItem.create({outlet_id:outlet.id,outlet_name:outlet.name,global_item_id:global.id,display_name:definition.name,
                        supplier_id:supplier.id,supplier_name:supplier.name,net_purchase_price:definition.price,is_active:true,
                        inventory_intervals:definition.intervals,count_units:definition.units,notes:'Ausschließlich synthetischer Testartikel.'});
                    await entities.OutletStock.create({outlet_id:outlet.id,outlet_name:outlet.name,outlet_item_id:item.id,global_item_id:global.id,
                        display_name:definition.name,on_hand_quantity:definition.stock,unit_abbreviation:definition.unit,revision:0,booking_journal:[]});
                }
                return Response.json({outlet_id:outlet.id,outlet_name:outlet.name,article_count:definitions.length,scope:'dev only; synthetic inventory test catalog'});
            }
            const outlet=await entities.Outlet.get(body.outlet_id);
            if (!outlet?.code?.startsWith('INVENTORY-TEST-')) throw new BookingError('NOT_AN_INVENTORY_TEST_OUTLET',403);
            const items=await entities.OutletItem.filter({outlet_id:outlet.id},'id',501);
            const stocks=await entities.OutletStock.filter({outlet_id:outlet.id},'id',501);
            if (body.action === 'inspect') return Response.json({outlet_id:outlet.id,stocks:stocks.map(stock=>({article:items.find(item=>item.id === stock.outlet_item_id)?.display_name,quantity:stock.on_hand_quantity,unit:stock.unit_abbreviation,revision:stock.revision,journal_entries:stock.booking_journal?.length}))});
            stage='test_delivery';
            if (typeof body.request_id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.request_id)) throw new BookingError('REQUEST_ID_REQUIRED',400);
            const milk=items.filter(item=>item.display_name === 'TEST · Milch');
            const matched=stocks.filter(stock=>stock.outlet_item_id === milk[0]?.id && stock.unit_abbreviation === 'l');
            if (milk.length !== 1 || matched.length !== 1) throw new BookingError('UNIQUE_STOCK_REQUIRED',409);
            const stock=matched[0];
            return Response.json(await bookStockOperation({store:base44StockStore(entities,true),user,stockId:stock.id,
                operation:{id:`test-delivery:${outlet.id}:${body.request_id}`,kind:'delivery',outlet_id:outlet.id,outlet_item_id:milk[0].id,
                    global_item_id:milk[0].global_item_id,unit_abbreviation:'l',quantity:2,
                    source:{document_id:`test-delivery:${outlet.id}`,line_id:body.request_id}}}));
        } catch (error) {
            if (error instanceof BookingError) return Response.json({error:error.code},{status:error.status});
            return Response.json({error:'INVENTORY_TEST_SETUP_FAILED',stage,...(Number.isInteger(error.status) ? {platform_status:error.status} : {})},{status:500});
        }
    };
}
