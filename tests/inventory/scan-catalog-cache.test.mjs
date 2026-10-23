import {test} from 'node:test';
import assert from 'node:assert/strict';
import {base44DeliveryScanStore} from '../../base44/shared/inventory/deliveryScanStore.js';
test('scan catalogs are shared within one authorized request only',async()=>{
    let outletCalls=0,supplierCalls=0;
    const entities={DeliveryScan:{updateMany:async()=>({success:true,has_more:false,updated:1})},Outlet:{get:async id=>{outletCalls++;return {id,is_active:true};}},Supplier:{get:async id=>{supplierCalls++;return {id,is_active:true};}},OutletItem:{filter:async()=>[]},SupplierItem:{filter:async()=>[]}};
    const user={id:'admin',role:'admin'},store=base44DeliveryScanStore(entities,user);
    const values=await Promise.all([store.catalog('outlet','supplier'),store.catalog('outlet','supplier')]);assert.equal(values[0],values[1]);assert.equal(outletCalls,1);assert.equal(supplierCalls,1);
    await store.catalog('outlet','other');assert.equal(outletCalls,2);
    await base44DeliveryScanStore(entities,user).catalog('outlet','supplier');assert.equal(outletCalls,3);
});
