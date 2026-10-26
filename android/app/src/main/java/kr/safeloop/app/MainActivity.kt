package kr.safeloop.app

import android.Manifest
import android.app.Activity
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity:ComponentActivity(){
 private var cameraResult:((Bitmap?)->Unit)?=null
 private val camera=registerForActivityResult(ActivityResultContracts.TakePicturePreview()){cameraResult?.invoke(it)}
 private val permissions=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){}
 private var pendingIntent by mutableStateOf<Intent?>(null)
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);pendingIntent=intent
  setContent { MaterialTheme(colorScheme=lightColorScheme(primary=Color(0xFF176B49),background=Color(0xFFF3F5EE))){
   if(FirebaseApp.getApps(this).isEmpty()) Surface(Modifier.fillMaxSize()){Column(Modifier.padding(30.dp)){Text("안전고리",fontSize=30.sp);Text("Firebase 설정이 필요합니다. app/google-services.json을 추가한 뒤 다시 빌드하세요.");Text("웹 시연은 별도로 실행할 수 있습니다.")}}
   else SafeLoop()
  }}
 }
 override fun onNewIntent(intent:Intent){super.onNewIntent(intent);setIntent(intent);pendingIntent=intent}
 private fun capture(callback:(Bitmap?)->Unit){cameraResult=callback;if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){permissions.launch(arrayOf(Manifest.permission.CAMERA));return};camera.launch(null)}
 @Composable private fun SafeLoop(){
  val repo=remember{Repository(this)};val scope=rememberCoroutineScope();var signedIn by remember{mutableStateOf(repo.auth.currentUser!=null)}
  var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var name by remember{mutableStateOf("")};var code by remember{mutableStateOf("")};var zone by remember{mutableStateOf("2층 · 설비 작업")};var site by remember{mutableStateOf(repo.siteId)}
  var page by remember{mutableStateOf("오늘")};var status by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var wage by remember{mutableStateOf("180000")};var highRisk by remember{mutableStateOf(false)};var carried by remember{mutableStateOf(true)}
  var values by remember{mutableStateOf(listOf("","",""))};var target by remember{mutableStateOf("")};var observed by remember{mutableStateOf("착용")};var photoPath by remember{mutableStateOf<String?>(null)};var riskTitle by remember{mutableStateOf("")};var anonymous by remember{mutableStateOf(true)};var callId by remember{mutableStateOf<String?>(null)};var peerCall by remember{mutableStateOf(false)};var pendingSelf by remember{mutableStateOf(false)}
  var risks by remember{mutableStateOf(listOf<Pair<String,Map<String,Any>>>())};var events by remember{mutableStateOf(listOf<Map<String,Any?>>())};var members by remember{mutableStateOf(listOf<Pair<String,Map<String,Any>>>())}
  fun run(block:suspend()->Unit){if(busy)return;busy=true;scope.launch{try{block()}catch(e:Exception){status=e.localizedMessage?:"연결을 확인해 주세요."}finally{busy=false}}}
  fun send(action:String,data:Map<String,Any?> = emptyMap()){run{repo.command(action,data);status="기록을 저장했습니다."}}
  fun dial(){if(site.isNotEmpty())repo.queue("emergency",mapOf("callId" to callId));startActivity(Intent(Intent.ACTION_DIAL,Uri.parse("tel:119")))}
  LaunchedEffect(signedIn){if(signedIn){runCatching{repo.command("registerToken",mapOf("token" to FirebaseMessaging.getInstance().token.await()))};if(Build.VERSION.SDK_INT>=33)permissions.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))}}
  LaunchedEffect(pendingIntent){val i=pendingIntent?:return@LaunchedEffect;callId=i.getStringExtra("callId");peerCall=i.getBooleanExtra("peerAlert",false);pendingSelf=i.getBooleanExtra("alert",false);if(callId!=null&&peerCall)runCatching{repo.command("call_response",mapOf("callId" to callId,"response" to "opened","siteId" to (i.getStringExtra("siteId")?:site)))}}
  DisposableEffect(site,signedIn){val regs=if(signedIn&&site.isNotEmpty())listOf(repo.db.collection("sites/$site/members").addSnapshotListener{snap,e->if(e!=null)status=e.message?:"";members=snap?.documents?.map{it.id to (it.data?:emptyMap())}?:emptyList()},repo.db.collection("sites/$site/risks").addSnapshotListener{snap,e->if(e!=null)status=e.message?:"";risks=snap?.documents?.map{it.id to (it.data?:emptyMap())}?:emptyList()})else emptyList();onDispose{regs.forEach{it.remove()}}}
  Scaffold(containerColor=Color(0xFFF3F5EE),bottomBar={Column{Button(onClick={dial()},modifier=Modifier.fillMaxWidth().height(60.dp).padding(horizontal=16.dp),colors=ButtonDefaults.buttonColors(containerColor=Color(0xFFBF382F))){Text("119 전화하기",fontSize=20.sp)};if(signedIn&&site.isNotEmpty())Row(Modifier.fillMaxWidth()){listOf("오늘","동료","위험","내 기록").forEach{p->TextButton(onClick={page=p;photoPath=null},modifier=Modifier.weight(1f).height(60.dp)){Text(p,fontSize=16.sp)}}}}}){padding->
   Column(Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(22.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
    Text("안전고리 SafeLoop",fontSize=27.sp,color=Color(0xFF176B49));Text("내 근로와 안전 기록의 첫 번째 주인은 나입니다.",fontSize=15.sp)
    if(status.isNotEmpty())Card{Text(status,Modifier.padding(14.dp),fontSize=16.sp)}
    if(!signedIn){Field("이름",name){name=it};Field("이메일",email){email=it};OutlinedTextField(password,{password=it},label={Text("비밀번호")},visualTransformation=PasswordVisualTransformation(),modifier=Modifier.fillMaxWidth());BigButton("로그인",!busy){run{repo.signIn(email,password);signedIn=true}};BigButton("회원가입",!busy){run{repo.signUp(email,password,name);signedIn=true}}}
    else if(site.isEmpty()){Field("현장 코드",code){code=it};Field("이름",name){name=it};Field("작업 구역",zone){zone=it};BigButton("현장 참여",!busy){run{val result=repo.command("join",mapOf("code" to code,"name" to name,"zone" to zone));site=result["siteId"] as String;repo.siteId=site}}}
    else {
     if(callId!=null||pendingSelf){Card(colors=CardDefaults.cardColors(containerColor=Color(0xFFFFF0CF))){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){Text(if(peerCall)"동료의 안전이 미확인입니다." else "강한 충격이 감지되었습니다.",fontSize=24.sp);Text("사고로 단정하지 않습니다. 본인의 안전을 먼저 확보하세요.");BigButton(if(peerCall)"현장 확인 수락" else "괜찮아요",!busy&&callId!=null){send("call_response",mapOf("callId" to callId,"response" to if(peerCall)"accepted" else "safe"));if(!peerCall){callId=null;pendingSelf=false}};if(peerCall)BigButton("현장 도착 기록",!busy){send("call_response",mapOf("callId" to callId,"response" to "arrived"))};Text("응답 제한은 서버에서 진행됩니다. 통신 실패 시 직접 동료·책임자에게 연락하세요.")}}}
     when(page){
      "오늘"->{Text("폰은 주머니에 넣어 두세요.",fontSize=25.sp);Text("입력은 작업 전후와 휴식 때만 해요.");Field("작업 구역",zone){zone=it};Field("예상 일당 (실제 지급액 아님)",wage){wage=it}
       BigButton("출근 기록 저장",!busy){run{if(ContextCompat.checkSelfPermission(this@MainActivity,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION));status="위치 권한을 선택한 후 출근을 다시 눌러 주세요.";return@run};val lm=getSystemService(LOCATION_SERVICE) as LocationManager;val location=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);val loc=location?.takeIf{System.currentTimeMillis()-it.time<120000}?.let{mapOf("lat" to it.latitude,"lng" to it.longitude,"accuracy" to it.accuracy.toDouble())};repo.command("attendance",mapOf("wage" to wage.toInt(),"zone" to zone,"location" to loc));status="출근 저장 완료. 점검 여부와 독립된 기록입니다."}}
       Text("작업 전 확인 3가지",fontSize=21.sp);listOf("추락 위험 구역·동선","바닥·개구부·안전난간","안전모·턱끈·안전대").forEachIndexed{i,t->Text(t,fontSize=17.sp);Row{listOf("확인","개선 필요","모름").forEach{v->FilterChip(values[i]==v,{values=values.mapIndexed{j,old->if(j==i)v else old}},label={Text(v)})}}};BigButton("본인 확인 저장",!busy&&values.none{it.isEmpty()}){send("self_check",mapOf("values" to values,"claim" to if(values[2]=="확인")"착용" else "미착용"))}
       Row{Text("기기를 몸에 휴대",Modifier.weight(1f));Switch(carried,{v->carried=v;send("device",mapOf("enabled" to v))})};if(!carried)Text("기기 미휴대 · 안전 확인 불가",color=Color(0xFFAB7B24))
       BigButton(if(highRisk)"고위험 작업 종료" else "고위험 작업 시작",!busy&&carried){run{if(!highRisk){repo.command("high_risk",mapOf("enabled" to true));ContextCompat.startForegroundService(this@MainActivity,Intent(this@MainActivity,SafetyService::class.java))}else{stopService(Intent(this@MainActivity,SafetyService::class.java));repo.command("high_risk",mapOf("enabled" to false))};highRisk=!highRisk;status="센서 임계값은 시험 가정입니다. 실기기 정확도 검증이 필요합니다."}}
       BigButton("휴식 복귀 · 괜찮아요",!busy){send("checkin")};BigButton("퇴근 기록 저장",!busy){run{repo.command("checkout");stopService(Intent(this@MainActivity,SafetyService::class.java));highRisk=false;status="퇴근 기록 완료. 안전점검 미완료로 기록을 제한하지 않습니다."}}
      }
      "동료"->{Text("동료 교차 확인",fontSize=24.sp);Text("고친 뒤 촬영하세요. 얼굴은 필수가 아닙니다.");members.filter{it.first!=repo.auth.currentUser?.uid}.forEach{(id,m)->FilterChip(target==id,{target=id;photoPath=null},label={Text("${m["name"]} · ${m["state"]}")})};Row{listOf("착용","미착용").forEach{v->FilterChip(observed==v,{observed=v;photoPath=null},label={Text(v)})}};if(observed=="착용")BigButton(if(photoPath==null)"동료 보호구 촬영 (선택)" else "사진 준비 완료",!busy){capture{bitmap->if(bitmap!=null)run{photoPath=repo.upload(bitmap);status="기기 카메라 촬영 사진 업로드 완료"}}};BigButton(if(photoPath==null)"버튼 확인 저장 (2등급)" else "사진 확인 저장 (3등급)",!busy&&target.isNotEmpty()){send("peer_check",mapOf("target" to target,"observed" to observed,"photoPath" to photoPath))}}
      "위험"->{Text("위험 신고 · 조치",fontSize=24.sp);Field("위험 제목",riskTitle){riskTitle=it};Field("위치",zone){zone=it};Row{Text("사업주에게 이름 숨기기",Modifier.weight(1f));Switch(anonymous,{anonymous=it})};BigButton("위험 요소 촬영",!busy){capture{bitmap->if(bitmap!=null)run{photoPath=repo.upload(bitmap);status="조치 전 사진 준비 완료"}}};BigButton("위험 신고 저장",!busy&&photoPath!=null&&riskTitle.isNotBlank()){run{repo.command("risk",mapOf("title" to riskTitle,"zone" to zone,"category" to "기타","anonymous" to anonymous,"photoPath" to photoPath));photoPath=null;riskTitle="";status="신고 저장 완료"}};risks.forEach{(id,risk)->Card{Column(Modifier.padding(14.dp)){Text(risk["title"].toString(),fontSize=20.sp);Text("${risk["zone"]} · ${risk["status"]}");if(risk["status"]=="resolved")BigButton("다른 동료로서 재확인",!busy){send("verify",mapOf("riskId" to id))};if(risk["status"]=="open")BigButton("조치 후 사진 촬영 · 완료 신고",!busy){capture{bitmap->if(bitmap!=null)run{val path=repo.upload(bitmap);repo.command("resolve",mapOf("riskId" to id,"photoPath" to path));status="조치 완료 신고. 다른 동료의 재확인을 기다립니다."}}}}}}}
      "내 기록"->{Text("내 근로와 안전 기록",fontSize=24.sp);BigButton("기록 불러오기",!busy){run{@Suppress("UNCHECKED_CAST") val result=FirebaseFunctionsProvider.report(repo.siteId);events=(result["events"] as? List<Map<String,Any?>>)?:emptyList();status="해시 체인: ${result["verified"]}"}};events.reversed().forEach{e->Card{Column(Modifier.padding(14.dp)){Text(e["type"].toString(),fontSize=18.sp);Text(e["serverTime"].toString(),fontSize=13.sp);Text(if(e["source"]=="system_estimate")"시스템 추정" else "사용자 진술");Text("ID: ${e["id"]}",fontSize=10.sp)}}};listOf("work" to "근로 기록","incident" to "사고 경위","monthly" to "월간 집계 (관리자)").forEach{(kind,label)->BigButton("$label PDF 생성",!busy){run{val result=FirebaseFunctionsProvider.pdf(site,kind);val path=result["path"] as String;val file=java.io.File(cacheDir,"report-${System.currentTimeMillis()}.pdf");com.google.firebase.storage.FirebaseStorage.getInstance().reference.child(path).getFile(file).await();val uri=androidx.core.content.FileProvider.getUriForFile(this@MainActivity,"kr.safeloop.app.files",file);startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"내 보고서 내보내기"));status="PDF 저장 완료"}}}}
     }
    }
    if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
   }
  }
 }
 @Composable private fun Field(label:String,value:String,onChange:(String)->Unit){OutlinedTextField(value,onChange,label={Text(label)},modifier=Modifier.fillMaxWidth(),singleLine=true)}
 @Composable private fun BigButton(text:String,enabled:Boolean=true,onClick:()->Unit){Button(onClick,enabled=enabled,modifier=Modifier.fillMaxWidth().heightIn(min=60.dp)){Text(text,fontSize=18.sp)}}
}
private object FirebaseFunctionsProvider {
 suspend fun report(siteId:String):Map<String,Any?> { @Suppress("UNCHECKED_CAST") return com.google.firebase.functions.FirebaseFunctions.getInstance("asia-northeast3").getHttpsCallable("reportData").call(mapOf("siteId" to siteId)).await().data as Map<String,Any?> }
 suspend fun pdf(siteId:String,kind:String):Map<String,Any?> { @Suppress("UNCHECKED_CAST") return com.google.firebase.functions.FirebaseFunctions.getInstance("asia-northeast3").getHttpsCallable("reportPdf").call(mapOf("siteId" to siteId,"kind" to kind)).await().data as Map<String,Any?> }
}

