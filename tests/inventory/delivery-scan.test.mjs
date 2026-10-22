import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryScanService,parseScanRead,compareScanReads,validateScanFile,scanPrompt} from '../../base44/shared/inventory/deliveryScan.js';
import {createScanDeliveryHandler} from '../../base44/functions/scanDelivery/handler.js';
import {deliveryExamples} from '../../src/components/inventory/delivery/reviewExamples.js';
import {reviewDeliveryLines} from '../../base44/shared/inventory/deliveryReview.js';
const clone=value=>structuredClone(value);
const raw=()=>({document_kind:'delivery',supplier_name:'Test supplier',document_reference:'TEST-SCAN-1',delivery_date:'2026-10-22',price_basis:'net',quality:'readable',pages:1,warnings:[],lines:[{original_name:'Beispielmilch 1 l',supplier_article_number:'001',purchase_unit_code:'KT',purchase_quantity:'2,5',net_purchase_price:'15',page:1,source_text:'001 Beispielmilch 1 l 2,5 KT 15,00'}]});
const file=()=>new File([new Uint8Array([137,80,78,71,13,10,26,10,0,1])],'synthetic.png',{type:'image/png'});
function fixture(){
    const catalog=deliveryExamples(),rows=new Map(),calls=[],user={id:'person',role:'user',data:{outlet_id:catalog.outletId}};let n=0,loseAck=false;
    const store={get:async id=>clone(rows.get(id)),catalog:async()=>({...clone(catalog.catalog),outlet:{name:'Test outlet'},supplier:{name:'Test supplier'}}),find:async query=>clone([...rows.values()].filter(row=>Object.entries(query).every(([key,value])=>row[key]===value))),create:async data=>{const row={...clone(data),id:`scan-${++n}-0000000000000000`};rows.set(row.id,row);return clone(row);},cas:async(old,patch)=>{const current=rows.get(old.id);if(current.revision!==old.revision)return false;if(loseAck && patch.status==='committed'){loseAck=false;throw new Error('ack failed');}rows.set(old.id,{...current,...clone(patch)});return true;}};
    const core={UploadPrivateFile:async()=>{calls.push('private');return {file_uri:'private/synthetic.png'};},CreateFileSignedUrl:async()=>({signed_url:'https://example.com/private-temporary-test'}),InvokeLLM:async input=>{calls.push(input);return raw();}};
    const created=new Map(),drafts={start:async input=>{calls.push({draft:input});if(!created.has(input.start_key))created.set(input.start_key,{id:'draft-one'});return created.get(input.start_key);}};
    const service=createDeliveryScanService({store,core,user,drafts,now:()=> '2026-10-22T12:00:00Z',uuid:()=> 'attempt-one'});
    const upload=()=>service.upload({file:file(),outlet_id:catalog.outletId,supplier_id:catalog.supplierId});
    const analyze=async()=>{const scan=await upload();return service.analyze({id:scan.id,revision:scan.revision});};
    const review=scan=>({document_reference:'TEST-SCAN-1',delivery_date:'2026-10-22',document_checked:true,prices_net_checked:true,lines:scan.reads[0].lines.map(line=>({...Object.fromEntries(['id','original_name','supplier_article_number','purchase_unit_code','purchase_quantity','net_purchase_price'].map(key=>[key,line[key]])),checked:true}))});
    return {service,store,core,user,catalog,rows,calls,created,upload,analyze,review,loseAck:()=>{loseAck=true;}};
}
test('photo file validation checks bytes, MIME, size and computes a stable hash',async()=>{
    const one=await validateScanFile(file()),two=await validateScanFile(file());assert.equal(one.hash,two.hash);assert.equal(one.hash.length,64);
    await assert.rejects(validateScanFile(new File(['not an image'],'x.png',{type:'image/png'})),{code:'SCAN_FILE_TYPE'});
    await assert.rejects(validateScanFile({size:11*1024*1024,arrayBuffer:async()=>{throw Error('must not read');}}),{code:'SCAN_FILE_SIZE'});
});
test('scan parsing keeps repeated positions, literal quantities and missing prices without defaults',()=>{
    const data=raw();data.lines.push({...data.lines[0],purchase_quantity:'',net_purchase_price:''});
    const result=parseScanRead(data);assert.equal(result.lines.length,2);assert.notEqual(result.lines[0].id,result.lines[1].id);assert.equal(result.lines[1].purchase_quantity,'');assert.equal(result.lines[1].net_purchase_price,'');
    data.lines[0].purchase_quantity=2.5;assert.throws(()=>parseScanRead(data),{code:'SCAN_OUTPUT_INVALID'});
});
test('two blind reads flag changed quantity, SKU, headers and missing rows rather than voting a value',()=>{
    const first=raw(),second=raw();second.lines[0].purchase_quantity='25';second.lines[0].supplier_article_number='O01';second.document_reference='different';
    const result=compareScanReads(parseScanRead(first),parseScanRead(second));assert.deepEqual(result.lines[0].disagreements,['supplier_article_number','purchase_quantity']);assert(result.warnings.includes('HEADER_DIFF:document_reference'));
    second.lines.push({...second.lines[0]});assert(compareScanReads(parseScanRead(first),parseScanRead(second)).warnings.includes('LINE_COUNT_DIFF'));
});
test('private upload is reused by file hash and performs no reading or stock/master write',async()=>{
    const f=fixture(),first=await f.upload(),second=await f.upload();assert.equal(first.id,second.id);assert.deepEqual(f.calls,['private']);assert.equal(f.created.size,0);
});
test('two reading calls see only the original attachment, no catalog, earlier output, or internet context',async()=>{
    const f=fixture(),scan=await f.analyze();assert.equal(scan.status,'review');assert.equal(scan.reads.length,2);
    const calls=f.calls.filter(row=>row.prompt);assert.equal(calls.length,2);assert(calls.every(call=>call.prompt.includes(scanPrompt) && call.add_context_from_internet===false && call.file_urls.length===1));assert.equal(f.created.size,0);
    assert.equal(scan.review.lines[0].match,'matched');assert.equal(scan.review.lines[0].bookable,false);
});
test('unreadable documents stop before a delivery draft can exist',async()=>{
    const f=fixture();f.core.InvokeLLM=async()=>({...raw(),quality:'unreadable'});
    await assert.rejects(f.analyze(),{code:'SCAN_RETAKE_REQUIRED'});assert.equal([...f.rows.values()][0].status,'failed');assert.equal(f.created.size,0);
});
test('every extracted row and complete document need explicit human review; dropping repeated rows is rejected',async()=>{
    const f=fixture(),scan=await f.analyze(),review=f.review(scan),input={id:scan.id,revision:scan.revision,review};
    await assert.rejects(f.service.commit({...input,review:{...review,document_checked:false}}),{code:'SCAN_HUMAN_REVIEW_REQUIRED'});
    await assert.rejects(f.service.commit({...input,review:{...review,lines:[]}}),{code:'SCAN_HUMAN_REVIEW_REQUIRED'});
    await assert.rejects(f.service.commit({...input,review:{...review,lines:review.lines.map(line=>({...line,checked:false}))}}),{code:'SCAN_HUMAN_REVIEW_REQUIRED'});
    assert.equal(f.created.size,0);
});
test('human-checked import creates only a stable unconfirmed draft and repeat never creates another',async()=>{
    const f=fixture(),scan=await f.analyze(),input={id:scan.id,revision:scan.revision,review:f.review(scan)};
    assert.equal((await f.service.commit(input)).draft_id,'draft-one');await f.service.commit(input);assert.equal(f.created.size,1);
    const saved=[...f.rows.values()][0];assert.equal(saved.frozen_review.checked_by,'person');assert.equal(saved.status,'committed');
    const start=f.calls.find(row=>row.draft).draft;assert.equal(start.scan_evidence.scan_id,scan.id);assert.equal(start.scan_evidence.reviewed_by,'person');assert(!('confirmation' in start.lines[0]));assert(!('outlet_item_id' in start.lines[0]));
});
test('lost scan acknowledgment resumes the identical frozen import and ignores changed retry contents',async()=>{
    const f=fixture(),scan=await f.analyze(),input={id:scan.id,revision:scan.revision,review:f.review(scan)};f.loseAck();
    await assert.rejects(f.service.commit(input));assert.equal([...f.rows.values()][0].status,'committing');
    await f.service.commit({...input,review:{...input.review,document_reference:'changed'}});assert.equal(f.created.size,1);
    assert(f.calls.filter(row=>row.draft).every(row=>row.draft.document_reference==='TEST-SCAN-1'));
});
test('another outlet or another owner cannot read, sign or resume a scan',async()=>{
    const f=fixture(),scan=await f.upload();f.user.id='other';await assert.rejects(f.service.get(scan.id),{code:'SCAN_OWNER_REQUIRED'});f.user.id='person';f.user.data.outlet_id='foreign';await assert.rejects(f.service.get(scan.id),{code:'OUTLET_FORBIDDEN'});
});
test('similar spellings and abbreviations produce suggestions, never exact identity or automatic approval',()=>{
    const e=deliveryExamples();e.catalog.offers[0].original_name='Haferdrink Barista 1 Liter';
    const result=reviewDeliveryLines({...e,lines:[{...e.lines[0],original_name:'Haferdrnk Baris 1 Liter',supplier_article_number:''}]});
    assert.equal(result.lines[0].match,'needs_assignment');assert.equal(result.lines[0].bookable,false);assert.equal(result.lines[0].candidates[0].supplier_item_id,'offer-001');
});
test('scan handler enforces actual authentication, dev-only gate and rejects arbitrary source URLs',async()=>{
    let called=false;const handler=createScanDeliveryHandler({createClientFromRequest:()=>({auth:{me:async()=>({id:'person'})}}),isEnabled:()=>false,serviceFor:()=>{called=true;return {};}});
    const request=(body,env='dev')=>new Request('https://example.com/function',{method:'POST',headers:{'Content-Type':'application/json','X-Data-Env':env},body:JSON.stringify(body)});
    assert.equal((await handler(request({action:'analyze',id:'x',revision:0}))).status,503);
    assert.equal((await handler(request({action:'get',id:'x'},'prod'))).status,503);
    assert.equal((await handler(request({action:'get',id:'x',source_url:'https://evil.example'}))).status,400);assert.equal(called,false);
});

test('real admin role may inspect another owner original but cannot overwrite their scan review',async()=>{
    const f=fixture(),scan=await f.upload();f.user.id='admin';f.user.role='admin';
    const inspected=await f.service.get(scan.id);assert.equal(inspected.can_edit,false);assert.equal(inspected.id,scan.id);
    await assert.rejects(f.service.analyze({id:scan.id,revision:scan.revision}),{code:'SCAN_OWNER_REQUIRED'});
    await assert.rejects(f.service.commit({id:scan.id,revision:scan.revision,review:{}}),{code:'SCAN_OWNER_REQUIRED'});
});

test('confirmed excluded fees and transport are retained as evidence but never handed to the stock draft',async()=>{
    const f=fixture();f.core.InvokeLLM=async()=>{const result=raw();result.lines.push({...result.lines[0],original_name:'Liefergebühr',supplier_article_number:'FEE',purchase_quantity:'',net_purchase_price:'',line_kind:'delivery_fee'});return result;};
    const scan=await f.analyze(),review=f.review(scan);review.lines[1].disposition='exclude_delivery_fee';
    await f.service.commit({id:scan.id,revision:scan.revision,review});
    const saved=[...f.rows.values()][0];assert.equal(saved.frozen_review.lines.length,1);assert.equal(saved.frozen_review.excluded_lines.length,1);assert.equal(saved.frozen_review.reviewed_lines.length,2);
    assert.equal(f.calls.find(row=>row.draft).draft.lines.length,1);assert.equal(saved.frozen_review.policy.overall_discounts,'ignore_for_inventory');
});
test('exclusion must itself be human checked and cannot silently drop an extracted row',async()=>{
    const f=fixture(),scan=await f.analyze(),review=f.review(scan);review.lines[0].disposition='exclude_transport';review.lines[0].checked=false;
    await assert.rejects(f.service.commit({id:scan.id,revision:scan.revision,review}),{code:'SCAN_HUMAN_REVIEW_REQUIRED'});
    review.lines[0].checked=true;await assert.rejects(f.service.commit({id:scan.id,revision:scan.revision,review}),{code:'SCAN_NO_GOODS'});
    assert.equal(f.created.size,0);
});
test('missing declared page needs a specific no-additional-goods confirmation with durable actor and coverage',async()=>{
    const f=fixture();f.core.InvokeLLM=async()=>({...raw(),declared_pages:2,page_numbers:[1]});
    const scan=await f.analyze(),review=f.review(scan);assert.deepEqual(scan.coverage.missing_pages,[2]);
    await assert.rejects(f.service.commit({id:scan.id,revision:scan.revision,review}),{code:'SCAN_MISSING_PAGES_REVIEW_REQUIRED'});
    review.missing_pages_no_goods_checked=true;await f.service.commit({id:scan.id,revision:scan.revision,review});
    const frozen=[...f.rows.values()][0].frozen_review;assert.equal(frozen.checked_by,'person');assert.equal(frozen.coverage_review.missing_pages_no_goods_checked,true);assert.deepEqual(frozen.coverage_review.missing_pages,[2]);
});
test('adding a page invalidates prior reads and sends both originals to each new blind read',async()=>{
    const f=fixture(),scan=await f.analyze();
    const second=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,2])],'page-two.png',{type:'image/png'});
    const appended=await f.service.append({id:scan.id,revision:scan.revision,file:second});assert.equal(appended.status,'uploaded');assert.deepEqual(appended.reads,[]);assert.equal(appended.source_files.length,2);
    await f.service.analyze({id:scan.id,revision:appended.revision});
    assert(f.calls.filter(row=>row.prompt).slice(-2).every(call=>call.file_urls.length===2));
    await assert.rejects(f.service.append({id:scan.id,revision:scan.revision,file:second}),{code:'SCAN_CHANGED_RELOAD'});
});
test('identical appended bytes recover the same source set without another private upload',async()=>{
    const f=fixture(),scan=await f.upload();await f.service.append({id:scan.id,revision:scan.revision,file:file()});
    assert.equal(f.calls.filter(row=>row==='private').length,1);
});
test('different complete receipts in one scan are rejected before review or draft creation',async()=>{
    const f=fixture();f.core.InvokeLLM=async()=>({...raw(),multiple_documents:true});
    await assert.rejects(f.analyze(),{code:'SCAN_MULTIPLE_DOCUMENTS'});assert.equal(f.created.size,0);
});
test('model metadata preserves distinct packaging fields and dated notes without selecting oldest date',()=>{
    const result=parseScanRead({...raw(),other_dates:['2026-09-30'],lines:[{...raw().lines[0],colli_quantity:'3',colli_unit:'KT',content_quantity:'3',content_unit:'BT',line_total:'161,73',line_kind:'goods'}]});
    assert.equal(result.delivery_date,'2026-10-22');assert.equal(result.lines[0].colli_unit,'KT');assert.equal(result.lines[0].content_unit,'BT');assert.deepEqual(result.other_dates,['2026-09-30']);
});

test('platform-default empty file arrays keep the primary original readable and analyzable',async()=>{
 const f=fixture(),scan=await f.upload(),record=f.rows.get(scan.id);record.files=[];
 const restored=await f.service.get(scan.id);assert.equal(restored.source_files.length,1);
 const analyzed=await f.service.analyze({id:scan.id,revision:scan.revision});assert.equal(analyzed.status,'review');
 assert(f.calls.filter(row=>row.prompt).every(call=>call.file_urls.length===1));
});
