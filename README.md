# 안전고리 SafeLoop

프로젝트 헌장(44쪽)과 기존 화면 시안을 바탕으로 작성한 캡스톤 MVP 소스입니다.

## 바로 실행

파일 탐색기에서 `start.bat` 또는 `start.cmd`를 더블클릭하면 준비된 웹 화면이 브라우저에 열립니다. 실행 창은 켜 두세요. Node.js가 필요하며 매번 설치·빌드하지 않습니다. 시작 메시지는 `start.log`에 남습니다. 코드를 수정한 경우에만 아래 명령으로 다시 빌드하세요.

```powershell
npm install
npm run build
npm run preview -- --port 5174
```

- 기본 실행은 **로컬 시연**입니다. 김민수 작업자와 4명의 동료, 초기 위험·근로 기록은 모의 자료입니다.
- 오른쪽 위 **작업자 앱**으로 전환하면 출퇴근, 점검, 동료 확인, 긴급 시연을 수행합니다.
- 시연 기록은 브라우저에 저장됩니다. 다른 브라우저나 기기로 자동 동기화되지 않습니다.
- **실제 Firebase 모드**는 `.env.example`을 `.env.local`로 복사하고 Firebase 설정을 입력한 뒤 다시 빌드하면 활성화됩니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `web/src/` | React 관리자 웹, 작업자 웹 시연, Firebase 연결 모드 |
| `functions/src/` | Firebase 인증 검증, 현장 참여, 서버 이벤트, 해시, 위험 처리, FCM·Cloud Tasks, PDF |
| `firestore.rules`, `storage.rules` | 클라이언트 원본 수정 금지, 역할·당사자 접근 제한 |
| `android/` | Kotlin·Jetpack Compose 작업자 앱, 가속도 감시 서비스, FCM, 카메라 촬영 |
| `tests/` | 근로·안전 규칙과 해시 체인 테스트 |
| `docs/SETUP.md` | Firebase·Android 설정과 실행 절차 |
| `docs/REQUIREMENTS.md` | 헌장 요구사항 대응표와 남은 검증 |
| `docs/VALIDATION.md` | 검증 결과와 한계 |

## 구현한 주요 흐름

출퇴근과 예상 일당은 안전점검 완료 여부와 독립적입니다. 작업 전 3항목에 모름을 선택하면 책임자 확인 요청을 기록합니다. 본인 신고와 동료 확인을 분리하고, 불일치는 개선 필요로 남깁니다. 사진 없는 동료 확인은 2등급, 사진 인증은 3등급으로 구분합니다. 위험은 조치 전 사진 → 조치 후 사진 → 신고자·조치자 외 다른 동료 재확인으로 처리합니다.

원본 사건은 서버에서 생성하며 SHA-256 체인으로 연결합니다. 정정은 새로운 사건으로 추가합니다. 관리자 화면에 익명 신고자의 UID와 원본 사진 경로를 제공하지 않습니다. 사람의 진술과 센서의 추정을 구분하고, 119 전화 기능 실행을 실제 통화 연결이나 접수로 표시하지 않습니다.

## 현재 상태

웹 시연은 실행·빌드 가능한 결과입니다. Firebase와 Android 소스도 제공하지만, **Firebase 프로젝트의 실제 배포·기기 간 알림·Android APK 빌드·잠금 화면 센서는 이 환경에서 검증하지 못했습니다.** 실제 현장용 완성품으로 검증된 상태가 아닙니다. 상세 상태는 `docs/VALIDATION.md`를 확인하세요.

사진 캡처는 HTTPS 또는 localhost와 카메라 권한이 필요합니다. 시연 모드에서 사진과 기록은 같은 브라우저에 남습니다. 현장 개인정보 대신 팀원·모의 데이터로 시험하세요.

## 테스트

```powershell
npm test
npm --prefix functions install
npm --prefix functions run check
```

한국어 PDF에는 Google Fonts Noto Sans KR(OFL 라이선스)을 포함했습니다. Firebase 서버의 PDF 3종과 원본 JSON을 함께 내보낼 수 있습니다. 웹 시연 보고서는 인쇄 창에서 PDF로 저장합니다.


## GitHub에서 처음 받은 팀원

GitHub 저장소에는 설치 캐시와 빌드 결과 `dist`가 포함되지 않습니다. 아래 순서로 최초 1회 설치·빌드한 뒤 실행하세요. ZIP 산출물에는 `dist`가 포함되어 바로 실행할 수 있습니다.

```powershell
git clone https://github.com/jmwshye/safeloop.git
cd safeloop
npm ci
npm run build
.\start.bat
```

Git을 설치하지 않은 경우 저장소의 `Code` → `Download ZIP`으로 받고 압축을 푼 뒤, 그 폴더에서 `npm ci`, `npm run build`를 실행하면 됩니다. Node.js 22 이상이 필요합니다. 코드를 바꾸면 다시 빌드해야 화면에 반영됩니다.

기본 모드는 모의 데이터 시연이며 각 브라우저의 기록은 별도로 저장됩니다. Android APK와 Firebase 실서버가 배포된 상태는 아닙니다. 실제 계정·푸시·기기 간 공유는 `docs/SETUP.md`에 따라 별도로 연결해야 합니다. `.env.local`, `google-services.json`, 서비스 계정 키, Android 서명 키를 GitHub에 올리지 마세요.
