import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryDraftService} from '../../base44/shared/inventory/deliveryDrafts.js';
import {claimDeliveryReference} from '../../base44/shared/inventory/deliveryRegistry.js';
import {deliveryExamples} from '../../src/components/inventory/delivery/reviewExamples.js';
import {memoryStore} from './helpers.mjs';

const clone=value=>structuredClone(value);
function fixture(){
    const example=deliveryExamples(),records=new Map(),config={failAck:false};let n=0;
    const actor={id:'employee',role:'user',data:{outlet_id:example.outletId}};
    let outlet={id:example.outletId,name:'Test',is_active:true,delivery_registry_revision:0,delivery_registry:[]};
    const stock=memoryStore({id:'stock',outlet_id:example.outletId,outlet_item_id:'item-001',global_item_id:'global-001',unit_abbreviation:'l',on_hand_quantity:10,revision:0,booking_journal:[]});
    const registry={get:async()=>clone(outlet),cas:async(old,patch)=>{
        await Promise.resolve();if(old.delivery_registry_revision!==outlet.delivery_registry_revision)return false;
        outlet={...outlet,...clone(patch)};return true;
    }};
    const store={verifiedAtomicWrites:true,stocks:stock,registry,stockFor:async()=> 'stock',
        get:async id=>clone(records.get(id)),find:async query=>clone([...records.values()].filter(row=>Object.entries(query).every(([key,value])=>row[key]===value))),
        create:async data=>{const row={...clone(data),id:`draft-${++n}`};records.set(row.id,row);return clone(row);},
        catalog:async()=>({...clone(example.catalog),outlet:clone(outlet),supplier:{name:'Test supplier'}}),
        cas:async(old,patch)=>{
            if(config.failAck && patch.lines?.some(row=>row.booking_receipt)){config.failAck=false;throw new Error('ack failed');}
            const current=records.get(old.id);if(current.revision!==old.revision)return false;
            records.set(old.id,{...current,...clone(patch)});return true;
        }};
    const service=createDeliveryDraftService({store,user:actor,now:()=> '2026-10-22T12:00:00Z'});
    const start=async({unknown=true,reference='TEST-BOOK-1'}={})=>{
        let draft=await service.start({outlet_id:example.outletId,supplier_id:example.supplierId,delivery_date:'2026-10-22',document_reference:reference,start_key:`start-key-${++n}-000000000`,lines:unknown?[example.lines[0],example.lines[9]]:[example.lines[0]]});
        draft=(await service.confirm({id:draft.id,revision:draft.revision,request_id:`confirm-key-${++n}-00000000`,line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]})).draft;
        return draft;
    };
    const book=draft=>service.book({id:draft.id,revision:draft.revision,line_ids:['line-1']});
    return {example,store,service,actor,start,book,stock,registry,records,config,outlet:()=>outlet};
}
test('confirmed known position books once while unknown position stays open and can later be proposed',async()=>{
    const f=fixture(),draft=await f.start(),booked=await f.book(draft);
    assert.equal(booked.status,'partially_booked');assert.equal(f.stock.snapshot().on_hand_quantity,35);
    assert.equal(booked.line_states[0].status,'booked');assert.equal(booked.line_states[1].status,'open');
    assert.equal(booked.line_states[0].booking_receipt.before_quantity,10);assert.equal(booked.line_states[0].booking_receipt.after_quantity,35);
    const proposed=await f.service.propose({id:draft.id,revision:booked.revision,request_id:'propose-request-0001',line_id:'line-10',note:'Please check'});
    assert.equal(proposed.draft.line_states[1].status,'proposal_pending');
    await f.book(draft);assert.equal(f.stock.writes(),1);
});
test('single-position delivery completes and repeated or concurrent booking never increments twice',async()=>{
    const f=fixture(),draft=await f.start({unknown:false});
    const replies=await Promise.all([f.book(draft),f.book(draft)]);
    assert(replies.every(reply=>reply.status==='completed'));assert.equal(f.stock.writes(),1);
    await f.book(draft);assert.equal(f.stock.snapshot().on_hand_quantity,35);
});
test('lost stock response resumes using the durable stock receipt',async()=>{
    const f=fixture(),draft=await f.start();f.stock.loseResponse=true;
    const result=await f.book(draft);assert.equal(result.line_states[0].status,'booked');assert.equal(f.stock.writes(),1);
});
test('missing draft acknowledgment is recoverable without another stock increment',async()=>{
    const f=fixture(),draft=await f.start();f.config.failAck=true;
    const first=await f.book(draft);assert.equal(first.status,'posting');assert.equal(f.stock.writes(),1);
    const second=await f.book(draft);assert.equal(second.status,'partially_booked');assert.equal(f.stock.writes(),1);
});
test('failure before stock commit keeps frozen plan and retries it unchanged',async()=>{
    const f=fixture(),draft=await f.start();f.stock.failBefore=true;
    const first=await f.book(draft);assert.equal(first.status,'posting');assert.equal(f.stock.writes(),0);
    await assert.rejects(f.service.save({id:draft.id,revision:first.revision,request_id:'save-frozen-000001',lines:first.lines}),{code:'DRAFT_FROZEN_FOR_BOOKING'});
    const second=await f.book(draft);assert.equal(second.status,'partially_booked');assert.equal(f.stock.writes(),1);
});
test('retry uses frozen conversion and receipt price even after the offer changes',async()=>{
    const f=fixture(),draft=await f.start();f.stock.failBefore=true;await f.book(draft);
    f.example.catalog.offers[0].base_quantity_per_purchase=100;f.example.catalog.offers[0].revision++;
    const result=await f.book(draft);assert.equal(result.line_states[0].booking_receipt.delta_quantity,25);
});
test('booked positions cannot be edited, reproposed or re-confirmed in a partial delivery',async()=>{
    const f=fixture(),draft=await f.start(),booked=await f.book(draft),base={id:draft.id,revision:booked.revision,request_id:'edit-booked-0000001'};
    await assert.rejects(f.service.save({...base,lines:booked.lines.map((line,i)=>i?line:{...line,purchase_quantity:'99'})}),{code:'BOOKED_LINE_IMMUTABLE'});
    await assert.rejects(f.service.confirm({...base,line_id:'line-1',supplier_item_id:'offer-001',acknowledged_issues:[]}),{code:'BOOKED_LINE_IMMUTABLE'});
    await assert.rejects(f.service.propose({...base,line_id:'line-1',note:''}),{code:'BOOKED_LINE_IMMUTABLE'});
    assert.equal(f.stock.writes(),1);
});
test('unconfirmed, stale, repeated product and missing-reference positions cannot book',async()=>{
    const f=fixture(),draft=await f.start({reference:''});await assert.rejects(f.book(draft),{code:'BOOKING_REFERENCE_REQUIRED'});
    assert.equal(f.stock.writes(),0);
    const g=fixture(),known=await g.start();
    await assert.rejects(g.service.book({id:known.id,revision:known.revision,line_ids:['line-10']}),{code:'UNCONFIRMED_LINE_CANNOT_BOOK'});
    g.example.catalog.offers[0].revision++;
    await assert.rejects(g.book(known),{code:'UNCONFIRMED_LINE_CANNOT_BOOK'});
});
test('repeated effective product mappings block stock booking even after manual admin linkage',async()=>{
    const f=fixture(),draft=await f.start();
    const proposed=(await f.service.propose({id:draft.id,revision:draft.revision,request_id:'propose-repeat-0001',line_id:'line-10',note:''})).draft;
    const admin=createDeliveryDraftService({store:f.store,user:{id:'admin',role:'admin'}});
    const linked=(await admin.resolve({id:draft.id,revision:proposed.revision,request_id:'link-repeat-000001',line_id:'line-10',resolution:'link',note:'Test',supplier_item_id:'offer-001',identity_confirmed:true})).draft;
    await assert.rejects(f.book(linked),{code:'REPEATED_PRODUCT_REQUIRES_REVIEW'});assert.equal(f.stock.writes(),0);
});
test('the outlet registry serializes competing drafts for one supplier reference',async()=>{
    const f=fixture();
    const claim=draftId=>claimDeliveryReference({store:f.registry,outletId:'demo-outlet',supplierId:'supplier',reference:'NOTE-1',draftId});
    const results=await Promise.allSettled([claim('one'),claim('two')]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(f.outlet().delivery_registry.length,1);
    const winner=f.outlet().delivery_registry[0].draft_id;await claim(winner);assert.equal(f.outlet().delivery_registry_revision,1);
});
test('registry lost response recovers its claim; uninitialized or full registry never falls back to unsafe writes',async()=>{
    const f=fixture(),original=f.registry.cas;let lost=true;
    f.registry.cas=async(...args)=>{const changed=await original(...args);if(lost){lost=false;throw new Error('lost claim reply');}return changed;};
    await claimDeliveryReference({store:f.registry,outletId:'demo-outlet',supplierId:'supplier',reference:'REF',draftId:'one'});
    assert.equal(f.outlet().delivery_registry.length,1);
    const invalid={get:async()=>({is_active:true}),cas:async()=>{throw new Error('must not write');}};
    await assert.rejects(claimDeliveryReference({store:invalid,outletId:'x',supplierId:'s',reference:'r',draftId:'d'}),{code:'DELIVERY_REGISTRY_NOT_INITIALIZED'});
    const full={get:async()=>({is_active:true,delivery_registry_revision:1000,delivery_registry:Array.from({length:1000},(_,i)=>({key:String(i)}))}),cas:async()=>{throw new Error('must not discard claims');}};
    await assert.rejects(claimDeliveryReference({store:full,outletId:'x',supplierId:'s',reference:'r',draftId:'d'}),{code:'DELIVERY_REGISTRY_ARCHIVE_REQUIRED'});
});

test('multi-position batch preserves its first commit while a later stock retries independently',async()=>{
    const f=fixture(),second=memoryStore({id:'stock-two',outlet_id:f.example.outletId,outlet_item_id:'item-002',global_item_id:'global-002',unit_abbreviation:'kg',on_hand_quantity:3.5,revision:0,booking_journal:[]});
    const stores={'stock':f.stock,'stock-two':second};
    f.store.stocks={verifiedAtomicWrites:true,get:id=>stores[id].get(),compareAndSwap:(old,next)=>stores[old.id].compareAndSwap(old,next)};
    f.store.stockFor=async c=>c.outlet_item_id==='item-001'?'stock':'stock-two';
    let draft=await f.service.start({outlet_id:f.example.outletId,supplier_id:f.example.supplierId,delivery_date:'2026-10-22',document_reference:'TWO-KNOWN-ONE-OPEN',start_key:'multi-start-key-0001',lines:[f.example.lines[0],f.example.lines[1],f.example.lines[9]]});
    for(const [line_id,supplier_item_id] of [['line-1','offer-001'],['line-2','offer-002']])draft=(await f.service.confirm({id:draft.id,revision:draft.revision,request_id:`multi-confirm-${line_id}`,line_id,supplier_item_id,acknowledged_issues:[]})).draft;
    const input={id:draft.id,revision:draft.revision,line_ids:['line-1','line-2']};
    second.failBefore=true;
    const interrupted=await f.service.book(input);
    assert.equal(interrupted.status,'posting');assert.equal(f.stock.snapshot().on_hand_quantity,35);assert.equal(second.snapshot().on_hand_quantity,3.5);
    const resumed=await f.service.book(input);
    assert.equal(resumed.status,'partially_booked');assert.equal(second.snapshot().on_hand_quantity,4.5);
    assert.equal(f.stock.writes(),1);assert.equal(second.writes(),1);
    assert.equal(resumed.line_states[2].status,'open');
    await f.service.book(input);assert.equal(f.stock.writes(),1);assert.equal(second.writes(),1);
});
