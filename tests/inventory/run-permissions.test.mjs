import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRunPermissions} from '../../src/components/inventory/counting/checkRunPermissions.js';

const denied=status=>async()=>{throw Object.assign(new Error('denied'),{status});};
const run={id:'run',outlet_id:'outlet',revision:8,status:'completed',session_date:'2026-10-21',period_type:'monthly'};
test('404 on delete is a valid denial only with an unchanged authorized record afterward',async()=>{
    const result=await checkRunPermissions({run,loadRun:async()=>run,makeId:()=> 'fixed-synthetic-id',entity:{get:denied(404),create:denied(403),update:denied(403),delete:denied(404)}});
    assert.equal(result.passed,true);assert.equal(result.permission_checks.length,5);
});
test('validation failure or disappeared record cannot masquerade as a permission denial',async()=>{
    let reads=0;
    const result=await checkRunPermissions({run,loadRun:async()=>{if(++reads === 2)throw new Error('gone');return run;},makeId:()=> 'fixed-synthetic-id',entity:{get:denied(404),create:denied(422),update:denied(403),delete:denied(404)}});
    assert.equal(result.passed,false);assert.equal(result.permission_checks[1].passed,false);assert.equal(result.permission_checks.at(-1).passed,false);
});
