# 설치 및 연결

## 1. 웹 시연

프로젝트 루트 `safeloop`에서 Node.js 22 이상으로 `npm install`, `npm run build`, `npm run preview -- --port 5174`를 실행합니다. 환경변수가 비어 있으면 모의 데이터로 실행합니다. `start.bat`와 `start.cmd`는 이미 포함된 `dist`를 Node 기본 HTTP 서버로 즉시 엽니다. npm 설치나 빌드를 반복하지 않습니다. 화면이 열리지 않으면 실행 창에 표시된 localhost 주소를 직접 열고 `start.log`를 확인하세요. 링크를 편집기에서 여는 대신 파일 탐색기에서 실행해야 합니다.

개발 중에는 `npm run dev`를 사용할 수 있습니다. Codex 제한 환경에서 esbuild의 상위 경로 읽기가 차단되면 빌드 후 preview를 사용하세요. 일반 PC의 브라우저에서 localhost 주소를 열면 됩니다.

## 2. Firebase 프로젝트

사용자가 소유한 별도 Firebase 프로젝트가 필요합니다. 현재 소스에 비밀 키나 서비스 계정은 포함하지 않았습니다.

1. Firebase Console에서 프로젝트와 Web App, Android App(`kr.safeloop.app`)을 등록합니다.
2. Authentication에서 이메일/비밀번호 인증을 활성화합니다. Firestore와 Storage를 생성하고 Functions·Cloud Tasks 사용에 필요한 결제 플랜과 IAM을 구성합니다. 운영 데이터 지역은 서울로 통일하는 것을 권합니다.
3. 웹 공개 설정을 `.env.local`에 입력합니다. `VITE_` 값은 클라이언트 공개 설정입니다. 서비스 계정 비밀키를 넣지 마세요.
4. `npm --prefix functions install`을 실행합니다. Firebase CLI에서 본인 계정으로 로그인하고 프로젝트를 선택합니다.
5. `firebase deploy --only firestore:rules,firestore:indexes,storage,functions --project <본인 프로젝트 ID>`로 배포합니다. 실제 배포는 이 작업에서 수행하지 않았습니다.
6. Cloud Tasks 함수 `selfTimeout`, `peerTimeout`, `visitTimeout`에 대해 런타임 서비스 계정의 큐 enqueue 및 함수 invoke 권한을 검토합니다. 에뮬레이터는 실제 FCM·Cloud Tasks 전달을 재현하지 않습니다.
7. 웹을 다시 빌드해 서버 연결 모드로 실행합니다. 계정을 생성하고 현장을 만들면 생성한 계정이 그 현장의 manager가 됩니다. 현장 코드는 현장 생성 응답에 표시됩니다. 현장 ID도 관리자 화면에 표시됩니다.
8. 다른 계정은 코드를 입력해 작업자로 참여합니다. 새 계정이 기존 관리자 역할을 덮어쓸 수 없도록 서버에서 기존 멤버를 보존합니다.

Storage의 브라우저 `getBlob` 다운로드에는 배포 도메인의 CORS 허용이 필요할 수 있습니다. 필요한 경우 운영자가 Storage 버킷에 GET만 허용하는 CORS 설정을 적용합니다. 공개 읽기 권한을 주지 마세요.

`functions/fonts/NotoSansKR.ttf`와 OFL.txt를 함수 배포에 포함해야 한국어 PDF를 생성할 수 있습니다. 원본은 [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosanskr)입니다.

### 서버 보안 원칙

- Firestore Rules는 클라이언트 이벤트 생성·수정·삭제를 금지합니다. Admin SDK는 Rules를 우회하므로 서버 함수에서 인증·멤버십·역할·독립 재확인을 다시 검사합니다.
- 회원가입만으로 관리자 권한이 생기지 않습니다. 자신이 새로 생성한 현장의 관리자만 됩니다.
- 익명 위험의 신고자 UID와 조치 전 사진 저장 경로는 `riskPrivate`에 저장합니다. 일반 클라이언트는 읽지 못합니다. 관리자용 타인 보고서에서 신고자 연결 위험 이벤트는 제외합니다.
- 위험 사진 조회는 인증된 `viewRiskPhoto` 서버 함수로 제공합니다. 사진 파일의 장기 공개 URL을 만들지 않습니다.
- 사진은 생성만 허용하고 기존 파일을 교체하지 않습니다. 평상시 사진 자동 만료·사고 보존 예외는 운영 정책 확정 후 별도 수명주기 작업이 필요합니다.
- 서버 이벤트는 사용자별 순차 해시 체인입니다. 특정 현장만 조회한 부분 집합의 해시는 전체 체인과 직접 비교할 수 없습니다. 서버 검증은 그 사용자의 전체 체인으로 수행합니다. 외부 해시 고정·백업은 미구현입니다.

## 3. Android

1. 별도 `safeloop-app-` 저장소를 받고 Android Studio에서 저장소 최상위 폴더를 엽니다. **JDK 17, Android SDK 35, Gradle 8.9**를 사용합니다. 최신 검증 결과는 `VALIDATION.md`를 확인하세요.
2. Firebase Console에서 받은 `google-services.json`을 앱 저장소의 `app/`에 넣습니다. 없으면 앱은 서버 없는 시연 모드로 실행됩니다. `ANDROID_DEMO.md`에서 iPhone 사용자용 PC 시연 절차를 확인하세요.
3. Android Studio에서 프로젝트에 포함된 Gradle wrapper 8.9와 JDK 17을 사용하도록 설정합니다. wrapper JAR와 실행 스크립트를 포함했습니다.
4. `./gradlew :app:assembleDebug` (Windows는 `gradlew.bat :app:assembleDebug`) 또는 Android Studio Run으로 팀원 기기에 설치합니다.
5. 로그인·현장 참여 후 알림·카메라·출근 위치 권한을 요청할 때 직접 선택합니다.
6. 움직임 감시 시작 시 visible foreground service가 선형가속도계를 감시합니다. 약 3g 충격 후 7초간 움직임 감소 비율로 후보를 만듭니다. 기압계는 사용하지 않으며 GPS는 상시 수집하지 않습니다. 임계값은 검증되지 않은 시험 가정입니다.
7. 감지 시 서버의 15초 응답 대기를 시작합니다. 통신 실패 시 로컬 알림에 실패 사실을 표시합니다. 동료 호출의 전달은 보장되지 않으므로 직접 연락·119 경로가 필요합니다.
8. FCM은 data payload로 발송하고 수신, 열람, 수락을 각기 기록합니다. 앱 강제 종료, 절전, 잠금 화면, 통신 단절에서 실기기 2대 이상으로 검증하세요.

Foreground service는 `specialUse`로 선언했습니다. 실제 배포 전 사용 목적에 대한 Play Console 심사와 권한 적합성을 확인해야 합니다. 움직임 감시를 명시적으로 시작할 때만 실행하며 재부팅 자동 시작은 없습니다. 서비스 종료·앱 강제 종료 후 복구, 기기 상태 heartbeat는 추가 구현·검증 대상입니다.

## 4. 검증 시나리오

- A·B 같은 현장·작업조로 참여 → 출근 → 본인 신고 → B가 A 보호구 확인 → 반대 방향도 독립 기록.
- 사진 거부 시 버튼 기록을 허용하고 등급 2를 확인. 불일치 시 사진을 남기지 않고 개선 후 재확인.
- A가 익명 위험 신고 → 관리자가 조치 후 사진 → 제3 작업자 재확인. 신고자·조치자 재확인은 거부되어야 함.
- 센서 모형 시험 → 본인 응답 시 종료, 무응답 시 동료+책임자 통보, 30초 무응답 시 같은 구역 응답 가능 동료로 확대.
- 오프라인에서 수신·열람 기록을 WorkManager로 지연 전송. 중복 처리와 서버 시간·기기 시간을 비교.
- 원본 수정·삭제 시도 거부, 정정 새 사건 생성, 해시 변조 탐지, 보고서 한글·긴 내용 페이지 확인.

## 참고한 공식 문서

- [Firestore Rules 및 Admin SDK 우회](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Cloud Tasks](https://firebase.google.com/docs/functions/task-functions)
- [Android Foreground service 유형](https://developer.android.com/develop/background-work/services/fgs/service-types)
