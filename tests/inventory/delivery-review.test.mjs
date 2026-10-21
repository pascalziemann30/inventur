import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewDeliveryLines,searchName} from '../../base44/shared/inventory/deliveryReview.js';
import {deliveryExamples} from '../../src/components/inventory/delivery/reviewExamples.js';
import {createReviewDeliveryHandler} from '../../base44/functions/reviewDelivery/handler.js';

const review=fixture=>reviewDeliveryLines(fixture);
test('nine exact supplier matches plus one unknown are diagnosed without confirming or booking anything',()=>{
    const fixture=deliveryExamples(),before=structuredClone(fixture);
    const result=review(fixture);
    assert.deepEqual(result.summary,{total:10,matched:9,unresolved:1,repeated:0});
    assert.equal(result.lines[0].base_quantity,25);
    assert.equal(result.lines[0].net_base_unit_price,1.5);
    assert.equal(result.lines[9].proposal_required,true);
    assert(result.lines.every(line=>line.bookable===false && line.requires_confirmation));
    assert.equal(result.writes_performed,false);
    assert.deepEqual(fixture,before);
});
test('supplier identity preserves leading zeroes, punctuation and case in SKUs and purchase codes',()=>{
    for(const [field,value] of [['supplier_article_number','1'],['supplier_article_number','00-1'],['purchase_unit_code','kt']]){
        const f=deliveryExamples();f.lines[0][field]=value;
        const line=review(f).lines[0];
        assert.equal(line.match,'needs_assignment');assert.equal(line.base_quantity,null);
    }
});
test('same article number at a different supplier never matches',()=>{
    const f=deliveryExamples();f.catalog.offers.forEach(offer=>offer.supplier_id='other');
    assert(review(f).lines.every(line=>line.match==='unknown'));
});
test('identical descriptions without a supplier number remain suggestions and cannot silently identify a product',()=>{
    const f=deliveryExamples();f.lines[0].supplier_article_number='';
    const line=review(f).lines[0];assert.equal(line.match,'needs_assignment');
    assert(line.issues.includes('SUPPLIER_NUMBER_MISSING'));assert.equal(line.base_quantity,null);
});
test('duplicate supplier identities are not resolved by taking the first approved offer',()=>{
    const f=deliveryExamples();f.catalog.offers.push({...f.catalog.offers[0],id:'dup',status:'draft'});
    const line=review(f).lines[0];assert.equal(line.match,'ambiguous');
    assert(line.issues.includes('DUPLICATE_SUPPLIER_IDENTITY'));assert.equal(line.base_quantity,null);
});
test('unapproved and broken product, unit, conversion and outlet links remain blocked',()=>{
    for(const mutate of [f=>f.catalog.offers[0].status='draft',f=>f.catalog.globals.shift(),
        f=>f.catalog.offers[0].base_quantity_per_purchase=0,f=>f.catalog.offers[0].unit_abbreviation='kg',
        f=>delete f.catalog.offers[0].revision,f=>f.catalog.items[0].is_active=false,
        f=>f.catalog.items[0].supplier_id='other',f=>f.catalog.items.push({...f.catalog.items[0],id:'duplicate'})]){
        const f=deliveryExamples();mutate(f);const line=review(f).lines[0];
        assert.equal(line.match,'invalid');assert.equal(line.base_quantity,null);
    }
});
test('names with different volumes or variants keep their meaningful numeric and textual tokens',()=>{
    assert.notEqual(searchName('Krug schwarz 300 ml'),searchName('Krug schwarz 600 ml'));
    assert.notEqual(searchName('Chai Dose'),searchName('Chai Nachfüllbeutel'));
    const f=deliveryExamples();f.lines[0].original_name='Beispielmilch 600 ml';
    assert(review(f).lines[0].issues.includes('DESCRIPTION_CHECK_REQUIRED'));
});
test('repeated article lines are visible even when quantities and prices differ',()=>{
    const f=deliveryExamples();f.lines[1]={...f.lines[0],id:'line-2',purchase_quantity:'3',net_purchase_price:'16'};
    const result=review(f);assert.equal(result.summary.repeated,2);
    assert.deepEqual(result.lines[0].duplicate_line_ids,['line-2']);
    assert(result.lines[1].issues.includes('POSSIBLE_REPEATED_LINE'));
});
test('blank, zero, negative or invalid quantities/prices produce explicit issues',()=>{
    for(const value of ['',null,'-1','1.1234567','1e3']){
        const f=deliveryExamples();f.lines[0].purchase_quantity=value;f.lines[0].net_purchase_price=value;
        const line=review(f).lines[0];assert(line.issues.includes('POSITIVE_PURCHASE_QUANTITY_REQUIRED'));
        assert(line.issues.includes('POSITIVE_RECEIPT_PRICE_REQUIRED'));assert.equal(line.base_quantity,null);
    }
    const f=deliveryExamples();f.lines[0].purchase_quantity=0;f.lines[0].net_purchase_price=0;
    assert.equal(review(f).lines[0].issues.length,2);
});
test('receipt price changes remain diagnostics and never replace the approved source price',()=>{
    const f=deliveryExamples();f.lines[0].net_purchase_price='20';
    const result=review(f);assert(result.lines[0].issues.includes('RECEIPT_PRICE_DIFFERS'));
    assert.equal(result.lines[0].net_base_unit_price,2);assert.equal(f.catalog.offers[0].net_purchase_price,15);
});
test('strict line shape rejects client-injected approval, role, conversion or computed quantity',()=>{
    for(const field of ['role','confirmed','base_quantity_per_purchase','base_quantity','supplier_item_id']){
        const f=deliveryExamples();f.lines[0][field]='forged';assert.throws(()=>review(f),{code:'INVALID_REVIEW_LINE'});
    }
    const f=deliveryExamples();f.lines[1].id=f.lines[0].id;assert.throws(()=>review(f),{code:'UNIQUE_REVIEW_LINE_ID_REQUIRED'});
    assert.throws(()=>review({...f,lines:[]}),{code:'DELIVERY_REVIEW_LINE_LIMIT'});
});
test('candidate lists are bounded and communicate truncation rather than claiming a unique match',()=>{
    const f=deliveryExamples();f.lines[0].supplier_article_number='';
    for(let i=0;i<8;i++)f.catalog.offers.push({...f.catalog.offers[0],id:`copy-${i}`});
    const line=review(f).lines[0];assert.equal(line.candidates.length,5);assert.equal(line.candidate_count,9);
    assert.equal(line.candidates_truncated,true);assert.equal(line.match,'needs_assignment');
});

function endpoint(){
    const f=deliveryExamples(),calls=[];
    const config={user:{id:'employee',role:'user',data:{outlet_id:f.outletId}}};
    const e={Outlet:{get:async id=>{calls.push('outlet');return {id,is_active:true};}},Supplier:{get:async id=>({id})},
        OutletItem:{filter:async query=>{assert.equal(query.outlet_id,f.outletId);return f.catalog.items;}},
        SupplierItem:{filter:async query=>{assert.equal(query.supplier_id,f.supplierId);return f.catalog.offers;}},
        GlobalItem:{get:async id=>{calls.push(id);return f.catalog.globals.find(g=>g.id===id);}}};
    const handler=createReviewDeliveryHandler({createClientFromRequest:()=>({auth:{me:async()=>config.user},asServiceRole:{entities:e}})});
    const request=(body={},env='dev')=>handler(new Request('https://test.invalid/review',{method:'POST',headers:{'X-Data-Env':env},body:JSON.stringify({outlet_id:f.outletId,supplier_id:f.supplierId,lines:f.lines,...body})}));
    return {f,e,config,calls,request};
}
test('real request identity and outlet are checked before any privileged catalog reads',async()=>{
    const t=endpoint();t.config.user=null;assert.equal((await t.request()).status,401);
    t.config.user={id:'employee',role:'user',data:{outlet_id:'another'}};
    assert.equal((await t.request()).status,403);assert.deepEqual(t.calls,[]);
    assert.equal((await t.request({role:'admin'})).status,400);
});
test('review endpoint rejects production and client-claimed role, returns only authorized test catalog diagnostics',async()=>{
    const t=endpoint();assert.equal((await t.request({},'prod')).status,503);
    assert.equal((await t.request({role:'admin'})).status,400);
    const response=await t.request();assert.equal(response.status,200);
    assert.equal((await response.json()).summary.matched,9);
});
test('catalog limit never silently truncates review to a misleading partial catalog',async()=>{
    const t=endpoint();t.e.SupplierItem.filter=async()=>Array(501).fill(t.f.catalog.offers[0]);
    const response=await t.request();assert.equal(response.status,409);
    assert.equal((await response.json()).error,'REVIEW_CATALOG_REQUIRES_PAGING');
});
test('duplicate supplier identity outside the authorized outlet is flagged without disclosing its product details',async()=>{
    const t=endpoint();t.f.catalog.offers.push({...t.f.catalog.offers[0],id:'hidden',global_item_id:'hidden-global',original_name:'Private other product'});
    const response=await t.request();const result=await response.json();
    assert.equal(result.lines[0].match,'invalid');assert(result.lines[0].issues.includes('DUPLICATE_SUPPLIER_IDENTITY'));
    assert(!JSON.stringify(result).includes('Private other product'));
});
