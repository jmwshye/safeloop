package kr.safeloop.app

import android.app.*
import android.content.*
import android.hardware.*
import android.os.*
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import kotlin.math.sqrt

/** Experimental motion detector. Never classifies an accident; no continuous GPS. */
class SafetyService:Service(),SensorEventListener {
 private lateinit var sensors:SensorManager
 private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
 private var impactAt=0L
 private var cooldownUntil=0L
 private var postSamples=0
 private var stillSamples=0
 override fun onBind(intent:Intent?)=null
 override fun onCreate(){
  super.onCreate()
  val nm=getSystemService(NotificationManager::class.java)
  nm.createNotificationChannel(NotificationChannel("monitor","안전 감시 상태",NotificationManager.IMPORTANCE_LOW))
  nm.createNotificationChannel(NotificationChannel("alerts","안전 확인 요청",NotificationManager.IMPORTANCE_HIGH))
  val open=PendingIntent.getActivity(this,1,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val stop=PendingIntent.getService(this,2,Intent(this,SafetyService::class.java).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE)
  val notification=NotificationCompat.Builder(this,"monitor").setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("안전고리 · 고위험 작업 감시 중").setContentText("폰을 몸에 휴대하세요. 사고 확정 기능이 아닙니다.").setOngoing(true).setContentIntent(open).addAction(0,"감시 종료",stop).build()
  if(Build.VERSION.SDK_INT>=34)startForeground(101,notification,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(101,notification)
  sensors=getSystemService(SENSOR_SERVICE) as SensorManager
  val sensor=sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
  if(sensor==null){nm.notify(102,NotificationCompat.Builder(this,"alerts").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle("센서 감시 불가").setContentText("선형가속도 센서가 없습니다. 동료 확인을 이용하세요.").setContentIntent(open).build());stopSelf();return}
  sensors.registerListener(this,sensor,SensorManager.SENSOR_DELAY_GAME)
 }
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
  if(intent?.action=="STOP"){scope.launch {runCatching {Repository(this@SafetyService).command("high_risk",mapOf("enabled" to false))}};stopSelf()}
  return START_NOT_STICKY
 }
 override fun onSensorChanged(e:SensorEvent){
  val now=SystemClock.elapsedRealtime();if(now<cooldownUntil)return
  val magnitude=sqrt(e.values.sumOf { (it*it).toDouble() })
  if(impactAt==0L&&magnitude>=29.43){impactAt=now;postSamples=0;stillSamples=0;return}
  if(impactAt!=0L){postSamples++;if(magnitude<1.5)stillSamples++
   if(now-impactAt>=7000){val suspect=postSamples>0&&stillSamples.toDouble()/postSamples>.7;impactAt=0L
    if(suspect){cooldownUntil=now+60000;scope.launch {
     val repo=Repository(this@SafetyService)
     val call=runCatching {repo.command("signal",mapOf("deviceTime" to java.time.Instant.now().toString()))}.getOrNull()
     val openIntent=Intent(this@SafetyService,MainActivity::class.java).putExtra("alert",true).putExtra("callId",call?.get("callId") as? String)
     val open=PendingIntent.getActivity(this@SafetyService,3,openIntent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
     val nm=getSystemService(NotificationManager::class.java)
     nm.notify(103,NotificationCompat.Builder(this@SafetyService,"alerts").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle("강한 충격이 감지되었습니다.").setContentText(if(call==null)"통신 실패 · 동료에게 직접 도움을 요청하세요. 119" else "15초 안에 안전 상태를 확인해 주세요.").setContentIntent(open).setAutoCancel(true).build())
    }}
   }
  }
 }
 override fun onAccuracyChanged(sensor:Sensor?,accuracy:Int){}
 override fun onDestroy(){if(::sensors.isInitialized)sensors.unregisterListener(this);scope.cancel();super.onDestroy()}
}
