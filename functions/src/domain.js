import {createHash} from 'node:crypto';
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
export function text(value,max=300){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('invalid text');return value.trim()}
export function cleanLocation(l){if(!l)return null;if(!Number.isFinite(l.lat)||!Number.isFinite(l.lng)||Math.abs(l.lat)>90||Math.abs(l.lng)>180||!Number.isFinite(l.accuracy)||l.accuracy<0)throw Error('invalid location');return {lat:l.lat,lng:l.lng,accuracy:l.accuracy}}
export function verifyEvents(events){let previous='GENESIS';for(const e of events){const {hash:stored,...body}=e;if(body.previousHash!==previous||hash(body)!==stored)return false;previous=stored}return true}
