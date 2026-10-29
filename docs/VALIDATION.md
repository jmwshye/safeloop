# 검증 기록

## 2026-10-29 · 관리자 웹과 작업자 앱 분리

- 작업자 웹 화면·역할 전환·작업자 참여 폼을 제거하고 관리자 대시보드 디자인·메뉴를 유지했다.
- Android 소스는 별도 `safeloop-app-` 저장소로 분리했다. 이전 소스는 이 PC의 웹 저장소 밖에 백업했다.
- 관리자 웹 프로덕션 빌드, Node 테스트 15개, Firebase 함수 문법 검사 통과.
- 실제 Chrome에서 관리자 메뉴 6개·초대 안내·작업자 전환 버튼 부재·런타임 오류 부재 확인.
- 새 Android 앱 빌드·단위 테스트 10개·Pixel 7 실행과 출근·본인 응답·15초 무응답·동료 도착·카메라 사진 완료·재실행 보존을 확인했다. 자세한 결과는 앱 저장소 `docs/VALIDATION.md`에 기록했다.
- 실제 Firebase 통합·기기 간 FCM·실기기 센서 정확도는 미검증. 원격 push·main 병합·운영 배포는 수행하지 않았다.

아래는 분리 이전의 검증 이력이다.

2026-10-26 / 한국 표준시

## 확인 완료

- React/Vite 프로덕션 빌드 성공.
- Node 도메인 테스트 10개 통과: 점검과 출근의 독립성, 해시 체인 변경·삭제·순서 탐지, 원본 보존 정정, 불일치 처리, 사진/버튼 등급 구분, 조치 후 독립 재확인, CSV 수식 주입 방지, 사람/시스템 성격 분리, 서버 정규화 해시, GPS 정확도 입력 검사.
- 로컬 Chrome 브라우저: 대시보드 렌더, 출근·퇴근, 점검 없이 근로 기록 생성, 해시 확인, 초대창, 모바일 390px 가로 넘침 없음. 콘솔 pageerror 없음.
- PDFKit과 공개 한글 폰트로 보고서 3종 생성. 사고 경위 PDF를 Poppler로 렌더하고 한글 표시·페이지 배치 확인.
- Firebase 함수 모듈을 실제 Node에서 import해 exported endpoint 로드 확인. 소스 문법 검사 통과.
- Firebase Admin 14.5 / Functions 7.4로 갱신 후 npm 설치 검사에서 알려진 의존성 취약점 0건.

## 검증하지 못한 것

- Firebase 실제 프로젝트가 제공되지 않아 인증·Rules·Storage·Cloud Tasks·FCM 통합시험과 실배포는 수행하지 않음.
- 초기에는 Android 빌드 환경이 없었으나 아래 Android 확장 검증에서 debug APK 빌드·서명 검사를 완료함. Android 에뮬레이터와 실기기 실행은 아직 미검증.
- 센서 정확도, 잠금·절전·강제 종료, 배터리 소모, 통신 단절과 푸시 성공률, 현장 GPS 오차는 미측정.
- PDF 샘플은 명시적으로 시연 데이터이며 실제 근로·사고 증빙이 아님.
- 원본 해시 체인은 변경 탐지 보조 기능임. 전체 DB와 체인을 재작성할 권한을 가진 운영자를 막는 외부 해시 고정은 미구현.
- 사진 카메라 입력은 앱 흐름 제한이며, 기기 또는 변조 클라이언트에 의한 사진 진위까지 보장하지 않음.

## 도구 및 배포 상태

기본 브라우저·Windows 자동화 도구는 `failed to write kernel assets` 오류로 초기화 실패. 설치되어 있는 Chrome의 headless 검증으로 대체했다.

이전 배포 시도는 외부 전송에 대한 명시적 승인 부족으로 자동 검토에서 거부되었다. 이후 사용자가 Sites 소스 업로드를 명시적으로 승인하여, `.openai/hosting.json`의 기존 비공개 사이트 ID로 업로드·게시를 재개한다. Firebase 실제 운영 배포와 웹 시연의 Sites 배포는 별개다.

## 재현

`npm test`, `npm run build`, `npm --prefix functions run check`를 실행한다. 선택 브라우저 스모크 스크립트 `qa.mjs`, `qa-flows.mjs`는 이 환경의 bundled Playwright 절대 경로를 사용하므로 다른 PC에서는 Playwright import 경로를 수정해야 한다. Chrome 외에 별도 브라우저를 설치하지 않았다.

## 추가 브라우저 검증 결과

가상 카메라(실제 사용자 사진 미사용)로 다음 8개 흐름을 확인했으며 pageerror가 없었다: 3항목 자기 확인, 불일치 상태, 사진 없는 2등급 확인, 카메라 촬영과 사진 지문 생성, 조치자의 재확인 거부, 다른 작업자의 재확인, 본인 응답에 의한 긴급 알림 종료, 정정 추가 후 해시 일치. 카메라 메타데이터가 준비되기 전에 촬영하지 못하도록 버튼을 비활성화했다.

최종 웹 빌드에서 초기 시연 번들은 약 293KB(압축 약 89KB)이며 Firebase 연결 화면은 별도 지연 로딩한다. Firebase SDK 연결 번들에 대한 크기 경고는 남아 있다.

## Android 안전 확인 흐름 확장 검증 (2026-10-26)

- JDK 17, Gradle 8.9, Android SDK 35로 Android 앱 및 테스트 소스를 실제 컴파일했다. 기존 Firebase HttpsCallableResult의 접근 오류를 `getData()` 호출로 수정했다.
- `assembleDebug` APK 생성 완료. 파일 크기 14,633,254바이트. `apksigner verify --verbose`의 APK v2 서명 검사를 통과했다. 캡스톤 작업 폴더에 `SafeLoop-Android-demo.apk`로 복사했다.
- 감지 로직 JUnit 테스트를 컴파일한 클래스에 대해 직접 실행: **4개 통과**. 정지만 있는 경우, 충격 후 정지, 계속 움직이는 경우, 센서 공백을 확인했다.
- Windows 한글 경로의 Gradle 테스트 실행기 문제를 피하기 위해 영문 경로 별칭을 사용했다. `testDebugUnitTest` **BUILD SUCCESSFUL**, JUnit XML에서 **tests=4, failures=0, errors=0** 확인. 직접 JUnit 실행과 Gradle 실행 모두 4개 통과했다.
- 최종 Node 테스트 **15개 통과**. 추가된 서버 정책 테스트는 본인 응답 기한, 중복 수락 거부, 도착·사진 없는 완료 거부, 호출 대상 외 응답 거부, 구역별 수신자 선정을 포함한다. 실제 Firestore/Storage/Cloud Tasks/FCM 통합 시험을 대신하지 않는다.
- `npm --prefix functions run check`와 서버 export 10개 import 확인. React/Vite 최종 빌드 통과. 기존 웹 대시보드 Chrome headless 렌더에서 pageerror 없음.
- Android 에뮬레이터/실기기에서 UI·카메라·알림을 실행하지 않았다. Firebase 실서버 배포 및 두 계정 간 푸시, 사진 업로드·조회, Firestore 트리거/IAM은 미검증이다.
- 센서 임계값, 잠금·절전·프로세스 종료, wake lock 사용에 따른 배터리, 통신 단절 시 호출 전달 여부는 실기기 시험이 필요하다.
- 로컬 소스와 시연 APK를 생성했으며 GitHub에 push하거나 실제 Firebase에 배포하지 않았다.

## 실행기 수정

사용자의 실행 실패 제보 후, 시작마다 npm 빌드를 반복하던 배치 파일을 교체했다. `scripts/start-local.mjs`는 Node 기본 모듈만으로 `dist`를 localhost에 제공하고, 서버가 준비된 다음 브라우저를 연다. 포트 충돌 시 5174~5190에서 다음 포트를 선택한다. 시작 메시지·오류는 실행 창과 `start.log`에 표시한다. 배치 파일은 ASCII/CRLF로 저장했으며 `start.cmd`도 제공한다. 배포 파일 외 경로는 제공하지 않는다.


실행기 수정 후 `cmd.exe`로 실제 배치 파일을 실행하고 HTTP 200 응답을 확인했다. 포트 충돌 시 다음 포트로 전환되는 것과 CRLF 형식, `package.json` 비공개 404 응답을 확인했다.
