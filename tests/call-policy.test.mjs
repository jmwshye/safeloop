import test from 'node:test';
import assert from 'node:assert/strict';
import {callResponseUpdate,nearbyRecipients} from '../functions/src/call-policy.js';
const base={subject:'a',recipients:['b','c'],stage:'peer',status:'pending'};
test('self confirmation is only allowed during the self deadline stage',()=>{
 assert.equal(callResponseUpdate({...base,stage:'self'},'a','safe',null,'now').resolution,'self_safe');
 assert.throws(()=>callResponseUpdate(base,'a','safe',null,'now'));
 assert.throws(()=>callResponseUpdate({...base,stage:'self'},'b','safe',null,'now'));
 assert.throws(()=>callResponseUpdate({...base,stage:'self',deadline:'2026-10-26T00:00:15Z'},'a','safe',null,'2026-10-26T00:00:16Z'));
});
test('accepting and arriving never completes safety verification',()=>{
 const accepted={...base,...callResponseUpdate(base,'b','accepted',null,'now')};
 assert.equal(accepted.status,'accepted');
 assert.throws(()=>callResponseUpdate(accepted,'c','accepted',null,'now'));
 assert.throws(()=>callResponseUpdate(accepted,'c','arrived',null,'now'));
 const arrived={...accepted,...callResponseUpdate(accepted,'b','arrived',null,'now')};
 assert.equal(arrived.status,'accepted');
 assert.throws(()=>callResponseUpdate(arrived,'b','verified',null,'now'));
 assert.throws(()=>callResponseUpdate(accepted,'b','verified',{path:'photo'},'now'));
 assert.equal(callResponseUpdate(arrived,'b','verified',{path:'photo'},'now').resolution,'peer_photo');
 assert.throws(()=>callResponseUpdate({...arrived,arrivedAt:'2026-10-26T00:00:15Z'},'b','verified',{path:'photo',uploadedAt:'2026-10-26T00:00:14Z'},'now'));
 assert.throws(()=>callResponseUpdate({...arrived,status:'closed'},'b','verified',{path:'photo'},'now'));
});
test('unassigned users cannot respond, and nearby workers exclude unavailable people',()=>{
 assert.throws(()=>callResponseUpdate(base,'outsider','opened',null,'now'));
 const members=[{uid:'a',zone:'1',available:true},{uid:'b',zone:'1',available:true},{uid:'c',zone:'2',available:true},{uid:'d',zone:'1',available:true,highRisk:true},{uid:'e',zone:'1',available:false}];
 assert.deepEqual(nearbyRecipients(members,'a','1'),['b']);
});
