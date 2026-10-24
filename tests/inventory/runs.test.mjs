import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventoryRunService} from '../../base44/shared/inventory/runs.js';
import {createInventoryRunsHandler} from '../../base44/functions/inventoryRuns/handler.js';
import {memoryStore,user} from './helpers.mjs';

let sequence=0;
const requestId=()=>`request-${String(++sequence).padStart(20,'0')}`;
const expectCode=code=>error=>error.code === code;
const snapshotEntries=()=>[
    {article_id:'milk',article_name:'Milk',stock_id:'stock-milk',global_item_id:'global-milk',unit_abbreviation:'l',last_stock:10,stock_revision:0,net_base_unit_price:1.5,count_units:[{code:'pack',label:'Pack',base_quantity:1}]},
    {article_id:'cake',article_name:'Cake',stock_id:'stock-cake',global_item_id:'global-cake',unit_abbreviation:'Stk',last_stock:24,stock_revision:0,net_base_unit_price:2.25,count_units:[{code:'cake',label:'Cake',base_quantity:12,whole_numbers_only:true},{code:'piece',label:'Piece',base_quantity:1,whole_numbers_only:true}]},
];
function fixture(actualUser=user) {
    let runSeq=0;
    const records=new Map();
    const stocks=new Map(snapshotEntries().map(entry=>[entry.stock_id,memoryStore({id:entry.stock_id,outlet_id:'outlet',outlet_item_id:entry.article_id,global_item_id:entry.global_item_id,unit_abbreviation:entry.unit_abbreviation,on_hand_quantity:entry.last_stock,revision:0,booking_journal:[]})]));
    const store={verifiedAtomicWrites:true,records,stocks:{verifiedAtomicWrites:true,get:id=>stocks.get(id).get(),compareAndSwap:(stock,next)=>stocks.get(stock.id).compareAndSwap(stock,next)},
        getRun:async id=>structuredClone(records.get(id)),
        createRun:async data=>{const run={...structuredClone(data),id:`run-${++runSeq}`};records.set(run.id,run);return structuredClone(run);},
        findRuns:async query=>[...records.values()].filter(run=>Object.entries(query).every(([name,value])=>run[name] === value)).map(run=>structuredClone(run)),
        async casRun(run,patch) {
            await Promise.resolve();
            if (store.failBefore && store.failBefore(run,patch)) {store.failBefore=null;throw new Error('lost before run write');}
            if (records.get(run.id).revision !== run.revision) return false;
            records.set(run.id,{...records.get(run.id),...structuredClone(patch)});
            if (store.loseResponse) {store.loseResponse=false;throw new Error('lost run response');}
            return true;
        },
        snapshot:async (outlet,period)=>{store.selectedPeriod=period;return {outlet_name:'Test outlet',entries:snapshotEntries()};},
        assertEntry:async ()=>{},
    };
    const service=createInventoryRunService({store,user:actualUser,now:()=> '2026-10-21T12:00:00Z'});
    const start=()=>service.start({outlet_id:'outlet',period_type:'monthly',session_date:'2026-10-21',start_key:'start-00000000000000001'});
    return {store,stocks,service,start};
}
const inputs=(milk='2,5',cake='1',pieces='3')=>[
    {article_id:'milk',status:'counted',values:{pack:milk}},
    {article_id:'cake',status:'counted',values:{cake,piece:pieces}},
];
async function saved(f,entries=inputs()) {
    const run=await f.start();
    return (await f.service.save({id:run.id,request_id:requestId(),revision:run.revision,entries})).run;
}

test('new run snapshots selected interval and reveals expected quantity only after confirmation',async()=>{
    const f=fixture();const run=await f.start();
    assert.equal(f.store.selectedPeriod,'monthly');assert.equal(run.period_type,'monthly');
    assert.equal(Object.hasOwn(run.entries[0],'last_stock'),false);
    const result=await f.service.save({id:run.id,request_id:requestId(),revision:0,entries:inputs()});
    assert.equal(result.run.entries[0].counted_quantity,2.5);
    assert.equal(result.run.entries[1].counted_quantity,15);
    assert.equal(result.run.entries[0].last_stock,10);
    const stored=f.store.records.get(run.id);
    assert.equal(stored.entries[1].net_base_unit_price,2.25);
});
test('start retry returns same run and rejects changed content',async()=>{
    const f=fixture();const first=await f.start();assert.equal((await f.start()).id,first.id);
    await assert.rejects(f.service.start({outlet_id:'outlet',period_type:'yearly',session_date:'2026-10-21',start_key:'start-00000000000000001'}),expectCode('START_CONTENT_CHANGED'));
    await assert.rejects(f.service.start({outlet_id:'outlet',period_type:'monthly',session_date:'2026-02-30',start_key:requestId()}),expectCode('INVALID_START_INPUT'));
});
test('duplicate start race is detected before any finalization',async()=>{
    const f=fixture();const original=f.store.createRun;
    f.store.createRun=async data=>{await original(data);return original(data);};
    await assert.rejects(f.start(),expectCode('DUPLICATE_START_REQUIRES_REVIEW'));
    const run=[...f.store.records.values()][0];
    await assert.rejects(f.service.finalize({id:run.id,revision:0}),expectCode('DUPLICATE_START_REQUIRES_REVIEW'));
    assert.equal(f.stocks.get('stock-milk').writes(),0);
});
test('actual assigned outlet is required for start, read, save, list and finalization',async()=>{
    const f=fixture();const run=await saved(f);
    const foreign=createInventoryRunService({store:f.store,user:{id:'other',role:'user',data:{outlet_id:'foreign'}}});
    for (const call of [()=>foreign.get(run.id),()=>foreign.list('outlet'),()=>foreign.start({outlet_id:'outlet'}),
        ()=>foreign.save({id:run.id,request_id:requestId(),revision:1,entries:inputs()}),()=>foreign.finalize({id:run.id,revision:1})]) {
        await assert.rejects(call(),expectCode('OUTLET_FORBIDDEN'));
    }
    assert.equal(f.stocks.get('stock-milk').writes(),0);
});
test('invalid or forged counts, metadata and duplicate entries never become a confirmed quantity',async()=>{
    const f=fixture();const run=await f.start();
    for (const entries of [inputs('', '1','3'),inputs('-2'),inputs('2','0.5'),[inputs()[0],inputs()[0]],
        [{...inputs()[0],counted_quantity:900},inputs()[1]], [{...inputs()[0],values:{invented:'2'}},inputs()[1]]]) {
        await assert.rejects(f.service.save({id:run.id,request_id:requestId(),revision:0,entries}));
    }
    assert.equal(f.store.records.get(run.id).revision,0);
});
test('concurrent same save is acknowledged once; another device cannot overwrite it silently',async()=>{
    const f=fixture();const run=await f.start();const id=requestId();
    const request={id:run.id,request_id:id,revision:0,entries:inputs()};
    const results=await Promise.all([f.service.save(request),f.service.save(request)]);
    assert.deepEqual(results[0],results[1]);assert.equal(f.store.records.get(run.id).request_receipts.length,1);
    await assert.rejects(f.service.save({...request,entries:inputs('9')}),expectCode('REQUEST_CONTENT_CHANGED'));
    await assert.rejects(f.service.save({...request,request_id:requestId(),entries:inputs('9')}),expectCode('RUN_CHANGED_RELOAD'));
});
test('lost draft response recovers persisted acknowledgment and exact retries stay safe after completion',async()=>{
    const f=fixture();const run=await f.start();const request={id:run.id,request_id:requestId(),revision:0,entries:inputs()};
    f.store.loseResponse=true;
    const ack=await f.service.save(request);assert.equal(ack.revision,1);
    await f.service.finalize({id:run.id,revision:1});
    const replay=await f.service.save(request);assert.equal(replay.revision,1);assert.equal(replay.run.status,'completed');
    assert.equal(f.stocks.get('stock-milk').writes(),1);
});
test('blank counts block completion; explicit zero books while skipped stock is preserved',async()=>{
    const f=fixture();const run=await f.start();
    await assert.rejects(f.service.finalize({id:run.id,revision:0}),expectCode('OPEN_COUNTS_REMAIN'));
    const ack=await f.service.save({id:run.id,request_id:requestId(),revision:0,entries:[inputs('0')[0],{article_id:'cake',status:'skipped',values:{}}]});
    assert.equal((await f.service.finalize({id:run.id,revision:ack.revision})).status,'completed');
    assert.equal(f.stocks.get('stock-milk').snapshot().on_hand_quantity,0);
    assert.equal(f.stocks.get('stock-cake').snapshot().on_hand_quantity,24);
    assert.equal(f.stocks.get('stock-cake').writes(),0);
});
test('parallel finalization and replay never book a position twice',async()=>{
    const f=fixture();const run=await saved(f);
    const results=await Promise.all(Array.from({length:4},()=>f.service.finalize({id:run.id,revision:run.revision})));
    assert.ok(results.every(result=>result.status === 'completed'));
    assert.equal(f.stocks.get('stock-milk').writes(),1);assert.equal(f.stocks.get('stock-cake').writes(),1);
    assert.equal(f.stocks.get('stock-cake').snapshot().on_hand_quantity,15);
});
test('failed session acknowledgment resumes from stock receipt without a second stock write',async()=>{
    const f=fixture();const run=await saved(f);
    f.store.failBefore=(_run,patch)=>patch.entries?.some(entry=>entry.article_id === 'milk' && entry.booked);
    const first=await f.service.finalize({id:run.id,revision:run.revision});
    assert.equal(first.status,'posting');assert.equal(first.entries[0].booked,false);assert.equal(first.entries[1].booked,true);
    assert.equal((await f.service.finalize({id:run.id,revision:run.revision})).status,'completed');
    assert.equal(f.stocks.get('stock-milk').writes(),1);assert.equal(f.stocks.get('stock-cake').writes(),1);
});
test('delivery conflict preserves delivery and completed lines; explicit fenced recount safely finishes',async()=>{
    const f=fixture();let run=await saved(f);
    const milk=f.stocks.get('stock-milk');await milk.compareAndSwap(milk.snapshot(),{revision:1,on_hand_quantity:12});
    run=await f.service.finalize({id:run.id,revision:run.revision});
    assert.equal(run.status,'posting');assert.equal(run.entries[0].booking_error,'STOCK_CHANGED_DURING_COUNT');
    assert.equal(run.entries[1].booked,true);assert.equal(milk.snapshot().on_hand_quantity,12);
    const reopened=await f.service.reopen({id:run.id,article_id:'milk',request_id:requestId(),revision:run.revision});
    assert.equal(reopened.run.status,'resolving');assert.equal(milk.snapshot().on_hand_quantity,12);
    assert.equal(milk.snapshot().booking_journal[0].kind,'inventory_fence');
    assert.equal(Object.hasOwn(reopened.run.entries[0],'last_stock'),false);
    const ack=await f.service.save({id:run.id,request_id:requestId(),revision:reopened.revision,entries:inputs('3')});
    const complete=await f.service.finalize({id:run.id,revision:ack.revision});
    assert.equal(complete.status,'completed');assert.equal(milk.snapshot().on_hand_quantity,3);
    assert.equal(f.stocks.get('stock-cake').writes(),1);
});
test('partial session cannot change a booked or another still frozen count',async()=>{
    const f=fixture();let run=await saved(f);
    const milk=f.stocks.get('stock-milk');await milk.compareAndSwap(milk.snapshot(),{revision:1,on_hand_quantity:12});
    run=await f.service.finalize({id:run.id,revision:run.revision});
    const reopened=await f.service.reopen({id:run.id,article_id:'milk',request_id:requestId(),revision:run.revision});
    await assert.rejects(f.service.save({id:run.id,request_id:requestId(),revision:reopened.revision,entries:inputs('3','4')}),expectCode('COUNT_ALREADY_FROZEN'));
    await assert.rejects(f.service.reopen({id:run.id,article_id:'cake',request_id:requestId(),revision:reopened.revision}),expectCode('ENTRY_NOT_RECOUNTABLE'));
});
test('fence survives a failed run write; retry uses same fence and does not change quantity',async()=>{
    const f=fixture();let run=await saved(f);
    const milk=f.stocks.get('stock-milk');await milk.compareAndSwap(milk.snapshot(),{revision:1,on_hand_quantity:12});
    run=await f.service.finalize({id:run.id,revision:run.revision});
    const request={id:run.id,article_id:'milk',request_id:requestId(),revision:run.revision};
    f.store.failBefore=(_run,patch)=>patch.status === 'resolving';
    await assert.rejects(f.service.reopen(request));
    const revision=milk.snapshot().revision;
    const result=await f.service.reopen(request);
    assert.equal(result.run.status,'resolving');assert.equal(milk.snapshot().revision,revision);
    assert.equal(milk.snapshot().on_hand_quantity,12);
});
test('fencing prevents an old in-flight finalizer from applying a superseded count',async()=>{
    const f=fixture();let run=await saved(f);
    const compare=f.store.stocks.compareAndSwap;
    let release,entered;
    const blocked=new Promise(resolve=>{entered=resolve;});
    const held=new Promise(resolve=>{release=resolve;});
    f.store.stocks.compareAndSwap=async (stock,next)=>{
        if (next.booking_journal.at(-1).operation_id === `inventory:${run.id}:milk:0`) {entered();await held;}
        return compare(stock,next);
    };
    const oldFinalizer=f.service.finalize({id:run.id,revision:run.revision});
    await blocked;
    run=await f.service.get(run.id);
    const reopen=await f.service.reopen({id:run.id,article_id:'milk',request_id:requestId(),revision:run.revision});
    const ack=await f.service.save({id:run.id,request_id:requestId(),revision:reopen.revision,entries:inputs('6')});
    const completed=await f.service.finalize({id:run.id,revision:ack.revision});
    release();await oldFinalizer;
    assert.equal(completed.status,'completed');assert.equal(f.stocks.get('stock-milk').snapshot().on_hand_quantity,6);
    assert.equal(f.stocks.get('stock-milk').snapshot().booking_journal.filter(receipt=>receipt.kind === 'inventory').length,1);
});
test('a committed count whose acknowledgment is missing cannot be reopened as unbooked',async()=>{
    const f=fixture();let run=await saved(f);
    f.store.failBefore=(_run,patch)=>patch.entries?.some(entry=>entry.article_id === 'milk' && entry.booked);
    run=await f.service.finalize({id:run.id,revision:run.revision});
    await assert.rejects(f.service.reopen({id:run.id,article_id:'milk',request_id:requestId(),revision:run.revision}),expectCode('ENTRY_ALREADY_BOOKED_RETRY_FINALIZE'));
});
test('HTTP route rejects production, anonymous calls and claimed permissions before store access',async()=>{
    let accesses=0;
    let actualUser={id:'admin',role:'admin'};
    const handler=createInventoryRunsHandler({createClientFromRequest:()=>({auth:{me:async()=>actualUser},asServiceRole:{entities:{}}}),isEnabled:()=>true,
        storeFor:()=>{accesses++;throw new Error('Unexpected access');}});
    const call=(body,environment='dev')=>handler(new Request('https://test.invalid/inventory',{method:'POST',headers:{'X-Data-Env':environment},body:JSON.stringify(body)}));
    assert.equal((await call({action:'list',outlet_id:'outlet'},'prod')).status,503);
    assert.equal((await call({action:'list',outlet_id:'outlet',role:'admin'})).status,400);
    actualUser=null;assert.equal((await call({action:'list',outlet_id:'outlet'})).status,401);
    assert.equal(accesses,0);
});

test('expired grant allows authorized dev reads, while all mutation actions remain disabled',async()=>{
    const f=fixture();const run=await saved(f);
    const handler=createInventoryRunsHandler({createClientFromRequest:()=>({auth:{me:async()=>user},asServiceRole:{entities:{}}}),isEnabled:()=>false,storeFor:()=>f.store});
    const call=body=>handler(new Request('https://test.invalid/inventory',{method:'POST',headers:{'X-Data-Env':'dev'},body:JSON.stringify(body)}));
    const read=await call({action:'get',id:run.id});assert.equal(read.status,200);assert.equal((await read.json()).read_only,true);
    assert.equal((await call({action:'list',outlet_id:'outlet'})).status,200);
    for (const action of ['save','finalize','reopen','start']) assert.equal((await call({action})).status,503);
    assert.equal(f.stocks.get('stock-milk').writes(),0);
});

test('admin can reversibly remove only an unbooked draft, preserving counts and idempotent acknowledgments',async()=>{
 const f=fixture({id:'admin',role:'admin'}),run=await saved(f);
 const input={id:run.id,revision:run.revision,request_id:requestId()};
 f.store.loseResponse=true;
 const removed=await f.service.lifecycle('discard',input);
 assert(removed.run.discarded_at);assert.equal(removed.run.read_only,true);
 assert.equal((await f.service.lifecycle('discard',input)).revision,removed.revision);
 assert.equal((await f.service.list('outlet')).length,0);
 assert.equal((await f.service.list('outlet',true)).length,1);
 await assert.rejects(f.service.save({id:run.id,revision:removed.revision,request_id:requestId(),entries:inputs()}),expectCode('RUN_DISCARDED'));
 await assert.rejects(f.service.finalize({id:run.id,revision:removed.revision}),expectCode('RUN_DISCARDED'));
 const restored=await f.service.lifecycle('restore',{id:run.id,revision:removed.revision,request_id:requestId()});
 assert.equal(restored.run.discarded_at,'');assert.deepEqual(restored.run.entries,run.entries);
 assert.equal((await f.service.list('outlet')).length,1);
 for(const stock of f.stocks.values())assert.equal(stock.writes(),0);
});
test('employee and foreign password-admin cannot delete or read removed inventories, nor enumerate trash',async()=>{
 const f=fixture(),run=await f.start();
 await assert.rejects(f.service.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),expectCode('ADMIN_REQUIRED'));
 await assert.rejects(f.service.list('outlet',true),expectCode('ADMIN_REQUIRED'));
 const admin=createInventoryRunService({store:f.store,user:{id:'admin',role:'admin'}});
 const foreign=createInventoryRunService({store:f.store,user:{id:'admin-other',role:'admin',access_kind:'password_admin',outlet_id:'other'}});
 await assert.rejects(foreign.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),expectCode('OUTLET_FORBIDDEN'));
 await admin.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()});
 await assert.rejects(f.service.get(run.id),expectCode('RUN_DISCARDED'));
 await assert.rejects(f.start(),expectCode('RUN_DISCARDED'));
});
test('frozen, resolving, completed, booked or locked inventory runs cannot be discarded',async()=>{
 const f=fixture({id:'admin',role:'admin'}),run=await f.start();
 for(const status of ['posting','resolving','completed']){
  f.store.records.get(run.id).status=status;
  await assert.rejects(f.service.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),expectCode('BOOKED_RUN_CANNOT_DISCARD'));
 }
 const row=f.store.records.get(run.id);row.status='draft';row.entries[0].booked=true;
 await assert.rejects(f.service.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),expectCode('BOOKED_RUN_CANNOT_DISCARD'));
 row.entries[0].booked=false;row.entries[0].locked=true;
 await assert.rejects(f.service.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),expectCode('BOOKED_RUN_CANNOT_DISCARD'));
 assert.equal(row.revision,0);
});
test('racing inventory save and discard cannot both update the same revision',async()=>{
 const f=fixture({id:'admin',role:'admin'}),run=await f.start();
 const result=await Promise.allSettled([f.service.lifecycle('discard',{id:run.id,revision:0,request_id:requestId()}),f.service.save({id:run.id,revision:0,request_id:requestId(),entries:inputs()})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.store.records.get(run.id).revision,1);
});
