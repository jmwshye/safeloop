# 헌장 요구사항 대응

기준: 안전고리(SafeLoop) 프로젝트 헌장 10장 MVP 및 17장 화면 시안. 확장 로드맵의 개인 카드·현장 온도는 선택 사항으로 보류했습니다.

| 요구 | 구현 위치 | 상태 |
| --- | --- | --- |
| Android Kotlin + Compose | android/app | 소스 구현, APK 미빌드 |
| React 관리자 웹 | web/src | 빌드·시연 |
| Firebase 인증·현장 코드 | LiveApp, functions command | 소스 구현, 실제 프로젝트 미연결 |
| 출퇴근·예상 일당 | 양쪽 UI, 서버 shifts | 웹 시연 검증, 서버 미배포 |
| 작업 전 3항목 | Checks, MainActivity | 시연 및 서버 검증 코드 |
| 같은 구역 동료·반장 배정 | 서버 attendance | 소스 구현; 배정 대칭성·재배정 추가 검증 필요 |
| 자기·동료 확인 분리 | self_check, peer_check | 시연·서버 구현 |
| 교차 사진·2등급 대체 | CameraCapture, Android 카메라, 서버 photo | 카메라 권한 거부 경로 포함; 실제 기기 사진 미검증 |
| 불일치→개선→재확인 | peerResult 및 서버 비교 | 시연 구현·도메인 테스트 |
| 위험 조치 전후·독립 재확인 | 위험 흐름, 서버 resolve/verify | 시연·서버 코드 구현 |
| 익명 선택 | riskPrivate, 관리자 타인 보고서 필터 | 코드 구현; 에뮬레이터 권한 통합시험 미실행 |
| 고위험 작업 모드 | SafetyService, high_risk | 소스 구현·실기기 미검증 |
| 체크인 | Android·웹 checkin | 복귀 버튼 구현; 사용자 지정 예정 시각 체크인 스케줄은 미구현 |
| 가속도·움직임 감소 | SafetyService | 규칙 기반 시험 코드; 센서 성능 미측정 |
| 15초 본인 확인 | 서버 selfTimeout | 웹 타이머 시연, 실제 큐 미검증 |
| 30초 무응답 확대 | peerTimeout | 웹 시연·서버 큐 코드 |
| 발송·수신·열람·수락 구분 | 서버·PushService | 소스 구현; FCM 실제 전달 미검증 |
| 119 항상 표시 | 웹 FAB, Android bottomBar | 수동 다이얼러 실행; 자동 신고 없음 |
| 사건 타임라인 | Timeline, users/events | 시연 및 서버 기록 |
| 원본 불변·정정 추가 | 서버 event, rules | 도메인 테스트, 보안 규칙 소스 |
| SHA-256 체인 | server domain, web domain | 변조·제거·순서 테스트 |
| PDF 3종 | 서버 pdf, 웹 printReport | 한글 샘플 생성·렌더 확인 |
| 월간 집계 CSV | 웹 reports | 시연 개인 집계; 실제 다인 집계 PDF 지원 |
| 사진 오프라인 임시 저장·재전송 | Android | 전체 사진 큐 미구현; 일부 응답만 WorkManager 재시도 |
| 사진 보관 기간·접근 분리 | rules 및 metadata | 접근 분리 소스, 수명주기 작업 미구현 |

## 범위 밖으로 유지한 항목

AI 보호구 분석, 사고 종류 확정, 정밀 층별 GPS, 자동 119 신고, 기관 직접 연동, 급여명세서·실지급 정산, 채용 점수·순위는 구현하지 않았습니다.

## 출시 전 남은 작업

Firebase 실배포 및 IAM·Rules 통합 시험, Android Gradle 빌드, 2대 이상 기기 FCM·잠금 센서·배터리 시험, 사진 오프라인 큐, 동료 대칭 배정·재배정, 예정 체크인 스케줄, 앱 강제 종료·기기 미연결 감지, 서버 작업 outbox/중복방지·실패 복구, 삭제·보관 정책, 사진 열람 UI 보완, 현장 인터뷰가 필요합니다. 이번 결과를 전체 12주 MVP 검증 완료로 보아서는 안 됩니다.
