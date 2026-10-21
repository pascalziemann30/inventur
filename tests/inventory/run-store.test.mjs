import test from 'node:test';
import assert from 'node:assert/strict';
import {base44RunStore} from '../../base44/shared/inventory/runStore.js';
import {createInventoryTestSetupHandler} from '../../base44/functions/inventoryTestSetup/handler.js';

function catalog() {
    const item={id:'item',outlet_id:'outlet',global_item_id:'global',display_name:'Synthetic item',supplier_id:'supplier',is_active:true,net_purchase_price:1.25,inventory_intervals:['monthly','yearly'],count_units:[{code:'pack',label:'Pack',base_quantity:10}]};
    const global={id:'global',unit_id:'unit',unit_abbreviation:'l',category_id:'category'};
    const stock={id:'stock',outlet_id:'outlet',outlet_item_id:'item',global_item_id:'global',unit_abbreviation:'l',on_hand_quantity:10,revision:0,booking_journal:[]};
    const data={Outlet:[{id:'outlet',name:'Test outlet',type:'NORMAL',is_active:true}],OutletItem:[item],GlobalItem:[global],OutletStock:[stock],Supplier:[{id:'supplier'}],Unit:[{id:'unit',abbreviation:'l'}],Category:[{id:'category',name:'Category'}],InventoryRun:[]};
    const entities=Object.fromEntries(Object.entries(data).map(([name,records])=>[name,{get:async id=>structuredClone(records.find(record=>record.id === id)),list:async()=>structuredClone(records),filter:async()=>structuredClone(records),updateMany:async()=>({success:true,updated:1,has_more:false})}]));
    return {data,entities,store:base44RunStore(entities)};
}
test('server snapshot requires valid catalog/stock links, approved base price and configured units',async()=>{
    const f=catalog();
    const snapshot=await f.store.snapshot('outlet','monthly');
    assert.equal(snapshot.entries.length,1);assert.equal(snapshot.entries[0].last_stock,10);
    assert.equal(snapshot.entries[0].net_base_unit_price,1.25);
    assert.equal((await f.store.snapshot('outlet','weekly')).entries.length,0);
    f.data.OutletStock.push({...f.data.OutletStock[0],id:'duplicate'});
    await assert.rejects(f.store.snapshot('outlet','monthly'),error=>error.code === 'UNIQUE_STOCK_REQUIRED');
    f.data.OutletStock.pop();f.data.Unit[0].abbreviation='kg';
    await assert.rejects(f.store.snapshot('outlet','monthly'),error=>error.code === 'ARTICLE_REFERENCE_INCOMPLETE');
});
test('snapshot never silently defaults missing price/stock; changed conversions stop finalization',async()=>{
    const f=catalog();const snapshot=await f.store.snapshot('outlet','monthly');
    f.data.OutletItem[0].count_units[0].base_quantity=12;
    await assert.rejects(f.store.assertEntry(snapshot.entries[0],'outlet'),error=>error.code === 'ARTICLE_CONFIGURATION_CHANGED');
    delete f.data.OutletItem[0].net_purchase_price;
    await assert.rejects(f.store.snapshot('outlet','monthly'));
});
test('unverified session CAS response never reports a saved draft',async()=>{
    const f=catalog();f.entities.InventoryRun.updateMany=async()=>({success:true,updated:1});
    await assert.rejects(f.store.casRun({id:'run',outlet_id:'outlet',revision:0},{revision:1}),error=>error.code === 'UNVERIFIED_RUN_UPDATE_RESULT');
});
test('test fixture refuses production, employees and ordinary outlets before creating or booking',async()=>{
    let actual={id:'admin',role:'admin'};
    let writes=0;
    const entities=new Proxy({Outlet:{get:async()=>({code:'KUNO15'})}},{get(target,name){if(name in target)return target[name];writes++;throw new Error('Unexpected entity access');}});
    const handler=createInventoryTestSetupHandler({createClientFromRequest:()=>({auth:{me:async()=>actual},asServiceRole:{entities}}),isEnabled:()=>true});
    const call=(action,environment='dev')=>handler(new Request('https://test.invalid/fixture',{method:'POST',headers:{'X-Data-Env':environment},body:JSON.stringify({action,outlet_id:'outlet',request_id:'request-00000000000000001'})}));
    assert.equal((await call('prepare','prod')).status,503);
    actual={id:'employee',role:'user'};assert.equal((await call('prepare')).status,403);
    actual={id:'admin',role:'admin'};assert.equal((await call('delivery')).status,403);assert.equal(writes,0);
});
test('fixture creates only synthetic dev catalog with initialized stock and no contact data',async()=>{
    const created=[];let sequence=0;
    const entities=new Proxy({},{get(_target,name){
        assert.ok(['Outlet','Supplier','Category','Unit','GlobalItem','OutletItem','OutletStock'].includes(name));
        return {create:async data=>{created.push({entity:name,data});return {...data,id:`id-${++sequence}`};}};
    }});
    const handler=createInventoryTestSetupHandler({createClientFromRequest:()=>({auth:{me:async()=>({id:'admin',role:'admin'})},asServiceRole:{entities}}),isEnabled:()=>true,uuid:()=> 'fixed-synthetic-fixture'});
    const response=await handler(new Request('https://test.invalid/fixture',{method:'POST',headers:{'X-Data-Env':'dev'},body:JSON.stringify({action:'prepare'})}));
    assert.equal(response.status,200);assert.equal((await response.json()).article_count,4);
    const stocks=created.filter(record=>record.entity === 'OutletStock');assert.equal(stocks.length,4);
    assert.ok(stocks.every(record=>record.data.revision === 0 && record.data.booking_journal.length === 0));
    const supplier=created.find(record=>record.entity === 'Supplier').data;
    assert.equal(Object.hasOwn(supplier,'email'),false);assert.equal(Object.hasOwn(supplier,'phone'),false);
});
