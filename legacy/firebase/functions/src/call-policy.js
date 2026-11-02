// Shared, deterministic rules used by the callable endpoint and its tests.
export function callResponseUpdate(call, uid, response, photo, now) {
 const subject=call.subject===uid, recipient=call.recipients.includes(uid);
 if(!subject&&!recipient)throw Error('호출 응답 권한 없음');
 if(response==='safe') {
  if(!subject||call.stage!=='self'||call.status!=='pending'||(call.deadline&&now>call.deadline))throw Error('본인 확인 시간이 지났습니다. 동료의 현장 확인이 필요합니다.');
  return {status:'closed',resolution:'self_safe',closedAt:now};
 }
 if(!recipient)throw Error('호출 수신자만 처리할 수 있습니다.');
 if(['received','opened'].includes(response))return {};
 if(response==='accepted') {
  if(call.status!=='pending'||call.stage!=='peer')throw Error('다른 동료가 수락했거나 종료된 호출입니다.');
  return {status:'accepted',acceptedBy:uid,acceptedAt:now};
 }
 if(call.status!=='accepted'||call.acceptedBy!==uid)throw Error('현장 확인을 수락한 작업자만 처리할 수 있습니다.');
 if(response==='arrived')return {arrivedAt:call.arrivedAt||now};
 if(response==='verified') {
  if(!call.arrivedAt||!photo)throw Error('현장 도착과 주변 사진이 필요합니다.');
  if(photo.uploadedAt&&Date.parse(photo.uploadedAt)<Date.parse(call.arrivedAt))throw Error('현장 도착 후 촬영한 사진이 필요합니다.');
  return {status:'closed',resolution:'peer_photo',closedAt:now,verifiedBy:uid,verificationPhoto:photo,verificationOverdue:false};
 }
 throw Error('응답 종류를 확인해 주세요.');
}
export function nearbyRecipients(members, subject, zone) {
 return members.filter(m=>m.uid!==subject&&m.zone===zone&&m.available===true&&m.highRisk!==true&&m.state!=='퇴근').map(m=>m.uid);
}
