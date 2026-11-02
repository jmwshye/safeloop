# 안전고리 관리자 웹

- 공용 데이터: NestJS API · PostgreSQL
- 계정·현장·기록: Android 앱과 공유
- 기본 화면: 실제 서버 연결
- 모의 화면: 주소 끝에 `?demo=1` 추가. 브라우저 안에서만 저장

## 실행

Node.js 22 이상.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev -- --port 5173 --strictPort
```

- `.env.local`: `VITE_API_BASE_URL`에 실행 중인 NestJS 주소
- 웹 주소: `http://127.0.0.1:5173`
- NestJS `ADMIN_WEB_ORIGIN`: 웹 주소와 정확히 일치
- 외부 API: HTTPS 주소 사용
- 서버 주소 변경 후 개발 서버 재시작

## 검사 · 빌드

```powershell
npm run build
npm test
npm run preview -- --port 5173 --strictPort
```

- `start.bat` / `start.cmd`: 기존 `dist` 실행. 소스·환경변수 변경 후 재빌드
- 실행 기록: `start.log`

## 로그인 · 연동

- 앱과 같은 이메일·비밀번호로 로그인
- 새 현장 생성자는 반장. 작업자는 발급된 현장 코드로 앱에서 참여
- 반장 권한이 있는 현장만 관리
- 로그인 토큰: 현재 브라우저 탭의 세션 저장소. 서버 만료 시각(로그인 후 7일) 또는 로그아웃 시 삭제
- 조회 실패: 오류 표시. 모의 데이터로 대체하지 않음
- 저장 중 연결 실패: 새로고침으로 반영 여부부터 확인
- 사진: JPG·PNG·WebP, 최대 5 MiB. 인증된 API로 조회·업로드
- PDF·CSV: NestJS에서 생성. 원본 사건·정정·누락 정보 포함
- 119 버튼: 전화 화면 열기 요청. 통화 연결·신고 접수 확인과 구분

## GitHub Pages

- 저장소 변수 `SAFELOOP_API_BASE_URL`: 공개 HTTPS API 주소
- NestJS `ADMIN_WEB_ORIGIN`: Pages 웹의 origin
- Pages 설정: GitHub Actions
- 워크플로: `.github/workflows/deploy-pages.yml`

## 기존 자료

- `legacy/firebase/`: 이전 서버·규칙·검증 원본 보관. 현재 실행·빌드·배포에 사용하지 않음
- `legacy/firebase/docs/`: 이전 기획·검증 자료. 현재 앱은 `safeloop-app-` 저장소 기준
- `.env.local`, 계정 토큰·비밀번호·개인 키는 Git에 올리지 않기
