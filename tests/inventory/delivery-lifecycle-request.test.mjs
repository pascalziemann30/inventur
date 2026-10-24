import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isLifecycleRequest,withLifecycleDeadline} from '../../src/components/inventory/delivery/lifecycleRequest.js';

test('unanswered lifecycle operation returns an uncertain timeout so the UI can unlock and preserve the exact operation',async()=>{
 let fire,cancelled,calls=0;
 const waiting=withLifecycleDeadline(()=>{calls++;return new Promise(()=>{});},{schedule:callback=>{fire=callback;return 'timer';},cancel:id=>{cancelled=id;}});
 fire();
 await assert.rejects(waiting,error=>error.uncertain===true && /noch unklar/.test(error.message));
 assert.equal(cancelled,'timer');assert.equal(calls,1);
});
test('confirmed or failed lifecycle responses clear their deadline and preserve the actual result',async()=>{
 const result={request_id:'same-operation',revision:1};let cleared=0;
 const timers={schedule:()=>42,cancel:id=>{assert.equal(id,42);cleared++;}};
 assert.equal(await withLifecycleDeadline(async()=>result,timers),result);
 const failure=Object.assign(new Error('changed revision'),{uncertain:false});
 await assert.rejects(withLifecycleDeadline(async()=>{throw failure;},timers),error=>error===failure);
 assert.equal(cleared,2);
});
test('only a complete persisted delete or restore operation can be offered for recovery',()=>{
 const request={action:'discard',input:{id:'draft-id',revision:0,request_id:'original-request-0001'}};
 assert.equal(isLifecycleRequest(JSON.parse(JSON.stringify(request))),true);
 assert.equal(isLifecycleRequest({...request,action:'book'}),false);
 assert.equal(isLifecycleRequest({...request,input:{...request.input,revision:-1}}),false);
 assert.equal(isLifecycleRequest({...request,input:{...request.input,request_id:''}}),false);
 assert.equal(isLifecycleRequest(null),false);
});
