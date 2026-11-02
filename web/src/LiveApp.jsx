import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  ShieldCheck,
  LayoutDashboard,
  Users,
  TriangleAlert,
  Activity,
  ClipboardList,
  FileText,
  Settings,
  ChevronRight,
  HardHat,
  RefreshCw,
  Phone,
  Download,
  Plus,
  Camera,
} from "lucide-react";
import { Tag, Stat } from "./Dashboard.jsx";
import { CameraCapture, Modal } from "./Flows.jsx";
import {
  createApi,
  createPhotoSubmission,
  createSiteSubmission,
  readSession,
  sessionKey,
  sitePath,
  siteSettingsBody,
  query,
  workReportPath,
  downloadFile,
} from "./api.mjs";

const day = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const time = (value) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "미기록";
const money = (value) =>
  value == null
    ? "미입력"
    : new Intl.NumberFormat("ko-KR").format(value) + "원";
function elapsedSince(stamp) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(stamp)) / 60000),
  );
  if (minutes < 1) return "방금";
  if (minutes < 60) return minutes + "분째";
  if (minutes < 1440) return Math.floor(minutes / 60) + "시간째";
  return Math.floor(minutes / 1440) + "일째";
}
const labels = {
  pending: "대기",
  scheduled: "확인 예정",
  cancelled: "요청 취소",
  okay: "괜찮아요",
  help_needed: "도움 필요",
  scaffold: "비계",
  ladder: "사다리",
  opening: "개구부",
  aerial_lift: "고소작업대",
  mismatch: "불일치",
  statement_only: "진술 확인",
  photo_confirmed: "사진 확인",
  confirmed: "확인",
  needs_attention: "주의 필요",
  unknown: "모름",
  inside: "현장 안",
  outside: "현장 밖",
  unverified: "미확인",
  carried: "휴대",
  not_carried: "미휴대",
  open: "미조치",
  awaiting_recheck: "재확인 대기",
  resolved: "완료",
  calling: "동료 호출 중",
  awaiting_worker: "본인 응답 대기",
  unanswered: "수락자 없음",
  responding: "이동 중",
  arrived: "현장 도착",
  closed: "종료",
  accepted: "승인",
  declined: "반려",
  fall: "추락",
  trip: "걸려 넘어짐",
  collision: "충돌",
  electric: "전기",
  other: "기타",
  unconscious: "의식이 없어 보임",
  immobile: "움직이기 어려워 보임",
  conscious: "의식 있음",
  appears_safe: "안전해 보임",
  no_help_needed: "도움 불필요",
  onsite_action_completed: "현장 조치 완료",
  handoff_confirmed: "인계 확인",
  worker_confirmed_okay: "본인이 괜찮다고 응답",
  buddy: "안전 동료",
  foreman: "반장",
  zone: "같은 구역 동료",
};
const text = (value) => labels[value] || value || "미확인";
const nav = [
  ["dashboard", "현장 대시보드", LayoutDashboard],
  ["people", "작업자 관리", Users],
  ["risks", "위험 신고 · 조치", TriangleAlert],
  ["timeline", "안전 타임라인", Activity],
  ["records", "근로 기록", ClipboardList],
  ["reports", "보고서", FileText],
];
function useRemote(load, deps, interval = 0) {
  const loader = useRef(load);
  loader.current = load;
  const [state, setState] = useState(null);
  const [version, setVersion] = useState(0);
  const scope = useMemo(() => ({}), [...deps, version, interval]);
  useEffect(() => {
    let active = true,
      timer;
    const controller = new AbortController();
    async function tick() {
      try {
        const data = await loader.current(controller.signal);
        if (active) setState({ scope, data, error: null, loading: false });
      } catch (error) {
        if (active && !controller.signal.aborted)
          setState((previous) => ({
            scope,
            data: previous?.scope === scope ? previous.data : null,
            error,
            loading: false,
          }));
      } finally {
        if (active && interval) timer = setTimeout(tick, interval);
      }
    }
    tick();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [scope]);
  const current =
    state?.scope === scope ? state : { data: null, error: null, loading: true };
  return { ...current, reload: () => setVersion((v) => v + 1) };
}
function Remote({ resource, children }) {
  return (
    <>
      {resource.error && (
        <div className="notice amber" role="alert">
          {resource.error.message}
          {resource.data && " · 마지막으로 받은 데이터를 표시 중"}
          <button className="text-button" onClick={resource.reload}>
            다시 조회
          </button>
        </div>
      )}
      {resource.data ? (
        children(resource.data)
      ) : resource.loading ? (
        <div className="empty" role="status">
          서버 기록을 불러오는 중…
        </div>
      ) : null}
    </>
  );
}
function Empty({ children = "기록이 없어요." }) {
  return <div className="empty">{children}</div>;
}
function Action({ children, onClick, disabled = false, secondary = false }) {
  return (
    <button
      type="button"
      className={"button " + (secondary ? "secondary" : "primary")}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Photo({ api, siteId, id, label }) {
  const image = useRemote(
    async (signal) =>
      (
        await api.request(
          sitePath(siteId, "/photos/" + encodeURIComponent(id)),
          { signal, response: "blob" },
        )
      ).blob,
    [api, siteId, id],
  );
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!image.data) {
      setUrl(null);
      return;
    }
    const value = URL.createObjectURL(image.data);
    setUrl({ value, blob: image.data });
    return () => URL.revokeObjectURL(value);
  }, [image.data]);
  return (
    <figure className="server-photo">
      <figcaption>{label}</figcaption>
      {url && url.blob === image.data ? (
        <img src={url.value} alt={label} />
      ) : image.error ? (
        <p role="alert">사진을 열 수 없어요.</p>
      ) : (
        <p>사진 조회 중…</p>
      )}
    </figure>
  );
}
function PhotoInput({ onChange, required = false, label = "사진 선택" }) {
  return (
    <label>
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        required={required}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <small>JPG·PNG·WebP, 최대 5 MiB</small>
    </label>
  );
}

export default function LiveApp() {
  const [session, setSession] = useState(() => readSession(sessionStorage)),
    [message, setMessage] = useState("");
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const saveSession = useCallback((value) => {
    sessionRef.current = value;
    setSession(value);
    try {
      value
        ? sessionStorage.setItem(sessionKey, JSON.stringify(value))
        : sessionStorage.removeItem(sessionKey);
    } catch {
      setMessage(
        "새로고침하면 다시 로그인해 주세요. 브라우저 저장소를 사용할 수 없어요.",
      );
    }
  }, []);
  const connection = useMemo(() => {
    try {
      return {
        api: createApi({
          baseUrl: import.meta.env.VITE_API_BASE_URL,
          getSession: () => sessionRef.current,
          onUnauthorized: () => {
            saveSession(null);
            setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
          },
        }),
      };
    } catch (error) {
      return { error };
    }
  }, [saveSession]);
  const api = connection.api;
  const verified = useRemote(
    (signal) =>
      api && session
        ? api.request("/auth/me", { signal })
        : Promise.resolve(null),
    [api, session?.accessToken],
  );
  if (connection.error)
    return (
      <div className="connection-page">
        <section className="panel settings">
          <h1>서버 주소 설정</h1>
          <p>{connection.error.message}</p>
          <p>
            <code>.env.local</code>의 주소를 설정한 뒤 개발 서버를 다시 시작해
            주세요.
          </p>
          <a href="?demo=1">모의 화면만 보기</a>
        </section>
      </div>
    );
  return !session ? (
    <Auth api={api} onLogin={saveSession} message={message} />
  ) : (
    <Remote resource={verified}>
      {(account) => (
        <Workspace
          key={session.user.id}
          api={api}
          user={account.user}
          logout={() => {
            saveSession(null);
            setMessage("로그아웃했어요.");
          }}
        />
      )}
    </Remote>
  );
}
function Auth({ api, onLogin, message }) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (signup)
        await api.signup(
          data.get("name"),
          data.get("email"),
          data.get("password"),
        );
      const session = await api.login(data.get("email"), data.get("password"));
      if (alive.current) onLogin(session);
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="connection-page">
      <section className="panel settings auth-card">
        <div className="brand">
          <span className="brand-symbol">
            <Link />
          </span>
          안전고리
        </div>
        <p className="eyebrow">SAFELOOP · CONNECTED WORKSPACE</p>
        <h1>{signup ? "새 계정 만들기" : "현장 계정 로그인"}</h1>
        <p className="subtitle">앱과 같은 계정·현장 기록을 사용해요.</p>
        {message && <div className="notice">{message}</div>}
        {error && (
          <div className="notice amber" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          {signup && (
            <label>
              이름
              <input name="name" required maxLength={100} autoComplete="name" />
            </label>
          )}
          <label>
            이메일
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              required
              minLength={signup ? 12 : undefined}
              maxLength={signup ? 20 : undefined}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </label>
          {signup && <p className="helper">비밀번호 12~20자</p>}
          <button className="button primary large" disabled={busy}>
            {busy ? "연결 중…" : signup ? "가입하고 로그인" : "로그인"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
          disabled={busy}
        >
          {signup ? "기존 계정으로 로그인" : "새 계정 만들기"}
        </button>
        <a className="text-button" href="?demo=1">
          모의 화면 보기
        </a>
      </section>
    </div>
  );
}
function Workspace({ api, user, logout }) {
  const sites = useRemote(
    (signal) => api.request("/sites/mine", { signal }),
    [api],
    30000,
  );
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const managers =
    sites.data?.sites.filter((item) => item.role === "foreman") || [];
  const site = selected
    ? sites.data?.sites.find((item) => item.id === selected)
    : managers[0];
  const siteSubmission = useRef(null);
  const submittingSite = useRef(false);
  if (!creating && !sites.data && !sites.error)
    return (
      <div className="empty" role="status">
        현장 목록을 불러오는 중…
      </div>
    );
  if (creating || !site)
    return (
      <div className="connection-page">
        <div className="site-picker">
          <div className="panel-heading">
            <div className="brand">
              <ShieldCheck />
              안전고리
            </div>
            <Action secondary onClick={logout}>
              로그아웃
            </Action>
          </div>
          <h1>관리할 현장 선택</h1>
          <Remote resource={sites}>
            {(data) => (
              <>
                <div className="report-grid">
                  {data.sites.map((item) => (
                    <button
                      className="panel site-choice"
                      key={item.id}
                      disabled={item.role !== "foreman"}
                      onClick={() => {
                        setSelected(item.id);
                        setCreating(false);
                      }}
                    >
                      <h2>{item.name}</h2>
                      <Tag>
                        {item.role === "foreman"
                          ? "반장"
                          : "작업자 계정 · 관리자 권한 없음"}
                      </Tag>
                      <p>{item.code}</p>
                    </button>
                  ))}
                </div>
                {!data.sites.length && (
                  <Empty>
                    참여한 현장이 없어요. 현장을 만들면 반장으로 등록돼요.
                  </Empty>
                )}
              </>
            )}
          </Remote>
          <section className="panel settings">
            <h2>새 현장 만들기</h2>
            {error && (
              <div role="alert" className="notice amber">
                {error}
              </div>
            )}
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (submittingSite.current) return;
                const data = new FormData(event.currentTarget);
                submittingSite.current = true;
                setBusy(true);
                try {
                  siteSubmission.current ??= createSiteSubmission();
                  const result = await api.request("/sites", {
                    method: "POST",
                    body: siteSubmission.current(siteSettingsBody(data)),
                  });
                  siteSubmission.current = null;
                  setError("");
                  setSelected(result.site.id);
                  setCreating(false);
                  sites.reload();
                } catch (error) {
                  setError(error.message);
                } finally {
                  submittingSite.current = false;
                  setBusy(false);
                }
              }}
            >
              <SiteFields />
              <button className="button primary" disabled={busy}>
                현장 생성
              </button>
            </form>
            {creating && managers.length > 0 && (
              <Action
                secondary
                disabled={busy}
                onClick={() => {
                  siteSubmission.current = null;
                  setError("");
                  setCreating(false);
                }}
              >
                돌아가기
              </Action>
            )}
          </section>
        </div>
      </div>
    );
  if (site.role !== "foreman")
    return (
      <div className="notice">
        이 현장의 관리자 권한이 없어요.
        <Action onClick={() => setSelected("")}>현장 다시 선택</Action>
      </div>
    );
  return (
    <SiteWorkspace
      key={site.id}
      api={api}
      user={user}
      site={site}
      sites={managers}
      changeSite={setSelected}
      createSite={() => {
        siteSubmission.current = null;
        setError("");
        setCreating(true);
      }}
      reloadSites={sites.reload}
      logout={logout}
    />
  );
}

function SiteFields({ site = {} }) {
  return (
    <>
      <label>
        현장명
        <input name="name" required maxLength={100} defaultValue={site.name} />
      </label>
      <label>
        반장 전화번호
        <input name="phone" type="tel" defaultValue={site.foremanPhone || ""} />
      </label>
      <fieldset>
        <legend>출근 위치 확인 기준 · 선택</legend>
        <div className="two-col">
          <label>
            위도
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              defaultValue={site.center?.latitude ?? ""}
            />
          </label>
          <label>
            경도
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              defaultValue={site.center?.longitude ?? ""}
            />
          </label>
        </div>
        <p className="helper">
          현장 중심 좌표가 없으면 출근은 저장되고 위치는 미확인으로 표시돼요.
        </p>
      </fieldset>
      <fieldset>
        <legend>근무 중 안전 확인 시각 · 한국 시간</legend>
        <div className="two-col">
          <label>
            휴식 복귀
            <input
              name="breakReturnTime"
              type="time"
              defaultValue={site.breakReturnTime || ""}
            />
          </label>
          <label>
            교대
            <input
              name="shiftChangeTime"
              type="time"
              defaultValue={site.shiftChangeTime || ""}
            />
          </label>
        </div>
        <p className="helper">비워 둔 시간에는 확인 요청이 예약되지 않아요.</p>
      </fieldset>
    </>
  );
}

function SiteWorkspace({
  api,
  user,
  site,
  sites,
  changeSite,
  createSite,
  reloadSites,
  logout,
}) {
  const [page, setPage] = useState("dashboard"),
    [incidentView, setIncidentView] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [invite, setInvite] = useState(false);
  const alive = useRef(true),
    lock = useRef(false),
    controller = useRef(new AbortController());
  useEffect(
    () => () => {
      alive.current = false;
      controller.current.abort();
    },
    [],
  );
  const run = async (task, success = "저장했어요.") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task(controller.current.signal);
      if (alive.current) {
        setMessage(success);
        setVersion((v) => v + 1);
      }
    } catch (error) {
      if (alive.current && !controller.current.signal.aborted)
        setMessage(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const refresh = () => setVersion((value) => value + 1);
  const workers = useRemote(
    (signal) => api.request(sitePath(site.id, "/workers"), { signal }),
    [api, site.id, version],
    15000,
  );
  const common = {
    api,
    site,
    user,
    run,
    busy,
    version,
    workers: workers.data?.workers || [],
    openIncident: (id, historical = false) =>
      setIncidentView({ id, historical }),
    navigate: setPage,
    refresh,
  };
  function dial(incidentId) {
    const openedAt = new Date().toISOString();
    location.href = "tel:119";
    api
      .request(
        incidentId
          ? "/incidents/" + encodeURIComponent(incidentId) + "/dial-intent"
          : sitePath(site.id, "/dial-intents"),
        {
          method: incidentId ? "PUT" : "POST",
          body: { requestId: crypto.randomUUID(), openedAt },
          signal: controller.current.signal,
        },
      )
      .then(() => {
        if (alive.current)
          setMessage(
            "119 전화 화면 열기 요청을 기록했어요. 실제 통화·접수 여부는 별도로 확인해 주세요.",
          );
      })
      .catch((error) => {
        if (alive.current && !controller.current.signal.aborted)
          setMessage("119 기록: " + error.message);
      });
  }
  return (
    <div className="app connected-app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setPage("dashboard");
          }}
        >
          <span className="brand-symbol">
            <Link size={27} />
          </span>
          <span>
            안전고리<small>SAFELOOP</small>
          </span>
        </a>
        <div className="workspace">
          <HardHat />
          <label className="workspace-select">
            <span className="sr-only">현재 현장</span>
            <select
              value={site.id}
              onChange={(event) => changeSite(event.target.value)}
            >
              {sites.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small>현장 코드 {site.code}</small>
          </label>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map(([id, title, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {title}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust">
            <ShieldCheck size={24} />
            <b>기록은 작업자의 것입니다.</b>
            <p>
              원본 기록과 정정 이력을
              <br />
              함께 확인해요.
            </p>
          </div>
          <button className="nav-settings" onClick={() => setPage("settings")}>
            <Settings size={19} />
            현장 정보
          </button>
          <div className="user">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <b>{user.name}</b>
              <small>현장 반장</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {site.name}
            <ChevronRight size={14} />
            <b>{nav.find((item) => item[0] === page)?.[1] || "현장 정보"}</b>
          </div>
          <div className="top-actions">
            <button
              className="compact-settings button secondary"
              onClick={() => setPage("settings")}
            >
              현장 설정
            </button>
            <span className="demo-label">
              <i />
              공용 서버 연결
            </span>
            <button
              className="icon-button"
              aria-label="새로고침"
              onClick={refresh}
            >
              <RefreshCw size={18} />
            </button>
            <button className="button secondary" onClick={logout}>
              로그아웃
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{day()} · SAFELOOP</p>
              <h1>
                {nav.find((item) => item[0] === page)?.[1] || "현장 정보"}
                <span className="heading-dot" />
              </h1>
              <p className="subtitle">앱과 함께 쓰는 현장 기록</p>
            </div>
            <Action onClick={() => setInvite(true)}>
              <Plus size={17} />
              작업자 초대
            </Action>
          </div>
          {message && (
            <div className="notice" role="status">
              {message}
              <button className="text-button" onClick={() => setMessage("")}>
                닫기
              </button>
            </div>
          )}
          {busy && (
            <div className="notice" role="status">
              서버 처리 중…
            </div>
          )}
          {workers.error && (
            <div className="notice amber" role="alert">
              작업자 목록: {workers.error.message}
            </div>
          )}
          {page === "dashboard" ? (
            <Overview {...common} />
          ) : page === "people" ? (
            <Workers {...common} />
          ) : page === "risks" ? (
            <Risks {...common} />
          ) : page === "timeline" ? (
            <SafetyTimeline {...common} />
          ) : page === "records" ? (
            <Records {...common} />
          ) : page === "reports" ? (
            <Reports {...common} />
          ) : (
            <section className="panel settings">
              <h2>현장 정보</h2>
              {sites.length > 1 && (
                <label>
                  관리할 현장
                  <select
                    value={site.id}
                    onChange={(event) => changeSite(event.target.value)}
                  >
                    {sites.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="settings-row">
                <span>현장 코드</span>
                <code>{site.code}</code>
              </div>
              <div className="settings-row">
                <span>반장</span>
                <b>{site.foremanName}</b>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  run(async (signal) => {
                    await api.request(sitePath(site.id, "/settings"), {
                      method: "PUT",
                      body: siteSettingsBody(fields),
                      signal,
                    });
                    reloadSites();
                  }, "현장 설정을 저장했어요.");
                }}
              >
                <SiteFields site={site} />
                <button className="button primary" disabled={busy}>
                  현장 설정 저장
                </button>
              </form>
              <Action secondary onClick={createSite}>
                새 현장 만들기
              </Action>
            </section>
          )}
        </main>
        <footer className="main-footer">
          <span>
            SAFELOOP <b>안전은 서로 연결되어 있습니다.</b>
          </span>
          <small>
            119 전화 화면 열기 기록은 실제 신고 접수 확인이 아니에요.
          </small>
        </footer>
      </div>
      <button className="emergency-fab" onClick={() => dial()}>
        <Phone size={18} />
        <b>119</b>
        <span>전화 화면 열기</span>
      </button>
      {invite && (
        <Modal title="작업자 초대" onClose={() => setInvite(false)}>
          <div className="invite-code">{site.code}</div>
          <p>앱에서 로그인한 뒤 이 코드를 입력해 현장에 참여하세요.</p>
          <Action
            onClick={() =>
              run(
                () => navigator.clipboard.writeText(site.code),
                "현장 코드를 복사했어요.",
              )
            }
          >
            코드 복사
          </Action>
        </Modal>
      )}
      {incidentView && (
        <Incident
          {...common}
          key={incidentView.id}
          id={incidentView.id}
          historical={incidentView.historical}
          onClose={() => setIncidentView(null)}
          dial={dial}
        />
      )}
      {message && (
        <div className="toast live-toast" role="status">
          <span>{message}</span>
          <button aria-label="알림 닫기" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function eventLabel(type) {
  const types = {
    "attendance.check_in": "출근 기록",
    "attendance.check_out": "퇴근 기록",
    "attendance.site_linked": "출근 현장 연결",
    "safety_check.saved": "본인 안전점검",
    "safety_check.corrected": "안전점검 답변 정정",
    "safety_check.reviewed": "반장 점검 요청 확인",
    "peer.assigned": "안전 동료 배정",
    "peer.confirmed": "동료 확인",
    "peer.remediated": "보호구 개선 확인",
    "peer.mismatch": "보호구 불일치",
    "incident.signal_detected": "이상 움직임 감지",
    "incident.worker_unanswered": "본인 15초 무응답",
    "incident.response_delayed": "호출 확인 지연",
    "incident.responder_unavailable": "수락자 대응 불가 · 다른 동료 요청",
    "incident.verification_overdue":
      "수락 후 2분간 현장 상태 미확인 · 반장 확인 요청",
    "incident.contacts_requested": "동료·반장 호출",
    "incident.zone_requested": "다른 동료 호출",
    "incident.no_responder": "수락자 없음",
    "incident.help_requested": "도움 요청",
    "incident.worker_safe": "본인 괜찮음 응답",
    "incident.received": "호출 수신 확인",
    "incident.opened": "호출 열람 확인",
    "incident.declined": "호출 수락 어려움",
    "incident.retry": "재호출",
    "incident.accepted": "호출 수락",
    "incident.arrived": "현장 도착",
    "incident.observation": "현장 상태 관찰",
    "incident.closed": "대응 종료",
    "incident.dialer_opened": "119 전화 화면 열기",
    "risk.reported": "위험 신고",
    "risk.fixed": "위험 조치",
    "risk.fix_requested": "위험 조치 담당자 배정",
    "risk.rechecked": "위험 재확인",
    "work.check_in_answered": "안전 확인 응답",
    "work.high_risk_started": "고위험 작업 시작",
    "work.high_risk_ended": "고위험 작업 종료",
    "correction.requested": "정정 요청",
    "correction.accepted": "정정 승인",
    "correction.declined": "정정 반려",
  };
  return types[type] || "현장 기록";
}
function ActiveCalls({ calls, site, workers, openIncident }) {
  return (
    <section className="panel" aria-label="진행 중인 호출">
      <div className="panel-heading">
        <h2>
          진행 중인 호출 <span className="count">{calls.length}</span>
        </h2>
        <small>5초마다 갱신</small>
      </div>
      {calls.map((call) => (
        <button
          className="call-card"
          key={call.id}
          onClick={() => openIncident(call.id)}
        >
          <TriangleAlert />
          <div>
            <b>
              {call.workerName} · {call.zone || "구역 미등록"}
            </b>
            <p>
              {text(call.status)} · 시작 {time(call.startedAt)}
            </p>
            {call.responderId && (
              <p>
                수락자{" "}
                {workers.find((w) => w.userId === call.responderId)?.name ||
                  (call.responderId === site.foremanId
                    ? site.foremanName
                    : "현장 구성원")}{" "}
                · {time(call.acceptedAt)}
              </p>
            )}
          </div>
          <ChevronRight />
        </button>
      ))}
    </section>
  );
}
function Overview(props) {
  const { api, site, version, openIncident, workers, navigate } = props;
  const resource = useRemote(
    (signal) => api.request(sitePath(site.id, "/dashboard"), { signal }),
    [api, site.id, version],
    5000,
  );
  return (
    <Remote resource={resource}>
      {(data) => (
        <>
          {data.activeCalls.length > 0 && (
            <ActiveCalls
              calls={data.activeCalls}
              site={site}
              workers={workers}
              openIncident={openIncident}
            />
          )}
          <section className="site-banner">
            <div className="site-banner-icon">
              <HardHat size={26} />
            </div>
            <div>
              <h2>
                {data.site.name}
                <span>현장 현황</span>
              </h2>
              <p>
                반장 {data.site.foremanName} · 기준일 {data.workDate}
              </p>
            </div>
          </section>
          <div className="stats-grid">
            <Stat
              title="오늘 출근 인원"
              value={data.counts.attended}
              unit={"/ " + data.counts.members + "명"}
              icon={Users}
              footer="현장 등록 작업자 기준"
              color="green"
            />
            <Stat
              title="서로 찍기 완료"
              value={data.counts.photoConfirmed}
              unit="명"
              icon={Camera}
              footer="사진 없는 확인은 포함하지 않아요"
              color="green"
            />
            <Stat
              title="미조치 위험"
              value={data.counts.openRisks}
              unit="건"
              icon={TriangleAlert}
              footer="조치와 재확인까지 함께"
              color="amber"
            />
            <Stat
              title="안전 미확인"
              value={data.counts.unverified}
              unit="명"
              icon={Activity}
              footer="미확인이 사고를 의미하지 않아요"
              color="gray"
            />
          </div>
          {!data.activeCalls.length && (
            <p className="helper">진행 중인 호출이 없어요.</p>
          )}
          <SafetyRequests {...props} />
          <div className="two-col">
            <section className="panel">
              <div className="panel-heading">
                <h2>오래된 미조치 위험</h2>
                <Action secondary onClick={() => navigate("risks")}>
                  전체 보기
                </Action>
              </div>
              {data.oldestRisks.map((risk) => (
                <div className="record-row" key={risk.id}>
                  <b>{risk.title}</b>
                  <span>
                    {risk.zone} · {text(risk.category)} ·{" "}
                    {elapsedSince(risk.createdAt)}
                  </span>
                </div>
              ))}
              {!data.oldestRisks.length && <Empty>미조치 위험이 없어요.</Empty>}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>오늘 최신 기록</h2>
                <Action secondary onClick={() => navigate("timeline")}>
                  전체 보기
                </Action>
              </div>
              {data.timeline.map((event) => (
                <div className="record-row" key={event.id}>
                  <b>{eventLabel(event.type)}</b>
                  <span>
                    {time(event.recordedAt)} ·{" "}
                    {event.source === "human"
                      ? "사람이 확인"
                      : "시스템 기록·추정"}
                  </span>
                </div>
              ))}
              {!data.timeline.length && <Empty />}
            </section>
          </div>
        </>
      )}
    </Remote>
  );
}
function SafetyRequests({ api, site, version, run, busy }) {
  const requests = useRemote(
    (signal) => api.request(sitePath(site.id, "/safety-requests"), { signal }),
    [api, site.id, version],
    15000,
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>작업 전 점검 확인 요청</h2>
      </div>
      <Remote resource={requests}>
        {(data) =>
          data.requests.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>작업자 · 구역</th>
                    <th>추락 위험</th>
                    <th>바닥·난간</th>
                    <th>보호구</th>
                    <th>반장 확인</th>
                  </tr>
                </thead>
                <tbody>
                  {data.requests.map((item) => (
                    <tr key={item.attendanceId}>
                      <td>
                        <b>{item.name}</b>
                        <p>{item.zone}</p>
                      </td>
                      <td>{text(item.fallHazard)}</td>
                      <td>{text(item.floorAndGuardrail)}</td>
                      <td>{text(item.protectiveEquipment)}</td>
                      <td>
                        {item.acknowledgedAt ? (
                          time(item.acknowledgedAt)
                        ) : (
                          <Action
                            disabled={busy}
                            onClick={() =>
                              run(async (signal) => {
                                try {
                                  await api.request(
                                    sitePath(
                                      site.id,
                                      "/safety-requests/" +
                                        item.attendanceId +
                                        "/acknowledgement",
                                    ),
                                    {
                                      method: "PUT",
                                      body: {
                                        expectedRequestedAt: item.requestedAt,
                                      },
                                      signal,
                                    },
                                  );
                                } catch (error) {
                                  if (error.status === 409) requests.reload();
                                  throw error;
                                }
                              })
                            }
                          >
                            요청 확인
                          </Action>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>확인이 필요한 요청이 없어요.</Empty>
          )
        }
      </Remote>
    </section>
  );
}
function Workers({ api, site, workers, run, busy, ...props }) {
  const incidents = useRemote(
    (signal) => api.request(sitePath(site.id, "/dashboard"), { signal }),
    [api, site.id, props.version],
    5000,
  );
  const calls = new Map(
    incidents.data?.activeCalls.map((call) => [call.workerId, call]) || [],
  );
  const [search, setSearch] = useState(""),
    [chosen, setChosen] = useState(null),
    [buddy, setBuddy] = useState(""),
    [capture, setCapture] = useState(null);
  const person = workers.find((item) => item.userId === chosen);
  const ppeUpload = useMemo(createPhotoSubmission, []);
  const photo =
    capture?.attendanceId === person?.attendanceId ? capture?.photo : null;
  const name = (id) =>
    id === site.foremanId
      ? site.foremanName
      : workers.find((w) => w.userId === id)?.name || "미배정";
  const visible = workers.filter((item) =>
    [item.name, item.zone, item.occupation].join(" ").includes(search),
  );
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            현장 작업자 {workers.length}명 · 오늘 출근{" "}
            {workers.filter((worker) => worker.checkedInAt).length}명
          </h2>
          <input
            aria-label="작업자 검색"
            placeholder="이름·구역·직종 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>작업자</th>
                <th>출퇴근</th>
                <th>구역 · 직종</th>
                <th>안전 동료</th>
                <th>현재 확인 상태</th>
                <th>위치·휴대</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((worker) => (
                <tr key={worker.userId}>
                  <td>
                    <b>{worker.name}</b>
                  </td>
                  <td>
                    {calls.has(worker.userId) ? (
                      <Action
                        secondary
                        onClick={() =>
                          props.openIncident(calls.get(worker.userId).id)
                        }
                      >
                        호출 중 · 상세
                      </Action>
                    ) : worker.checkedOutAt ? (
                      "퇴근"
                    ) : worker.checkedInAt ? (
                      "근무 중"
                    ) : (
                      "미출근"
                    )}
                    <small>{time(worker.checkedInAt)}</small>
                  </td>
                  <td>
                    {worker.zone || "미등록"} · {worker.occupation || "미등록"}
                  </td>
                  <td>{name(worker.buddyUserId)}</td>
                  <td>
                    <Tag
                      tone={
                        worker.peerStatus === "photo_confirmed"
                          ? "green"
                          : "amber"
                      }
                    >
                      {text(worker.peerStatus)}
                    </Tag>
                    <small>
                      최근 안전 확인:{" "}
                      {worker.checkInStatus
                        ? text(worker.checkInStatus)
                        : "요청 없음"}
                    </small>
                    {worker.highRiskTask && (
                      <small>고위험 작업: {text(worker.highRiskTask)}</small>
                    )}
                  </td>
                  <td>
                    {text(worker.locationStatus)} · {text(worker.device?.state)}
                  </td>
                  <td>
                    <Action
                      secondary
                      onClick={() => {
                        setChosen(worker.userId);
                        setBuddy(worker.buddyUserId || "");
                        setCapture(null);
                      }}
                    >
                      관리
                    </Action>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <Empty />}
        {incidents.error && (
          <div role="alert" className="notice amber">
            호출 상태 조회 실패 · {incidents.error.message}
          </div>
        )}
        <p className="helper">
          구역과 현재 확인 상태만 공유해요. 단독 작업자의 확인 담당은{" "}
          {site.foremanName} 반장이에요.
        </p>
      </section>
      <SafetyRequests api={api} site={site} run={run} busy={busy} {...props} />
      {person && (
        <Modal
          title={person.name + " · 안전 동료"}
          onClose={() => setChosen(null)}
        >
          <p>현재 동료: {name(person.buddyUserId)}</p>
          <label>
            새 동료
            <select
              value={buddy}
              onChange={(event) => setBuddy(event.target.value)}
            >
              <option value="">선택</option>
              <option value={site.foremanId}>{site.foremanName} · 반장</option>
              {workers
                .filter(
                  (item) =>
                    item.userId !== person.userId &&
                    item.checkedInAt &&
                    !item.checkedOutAt,
                )
                .map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.name} · {item.zone}
                  </option>
                ))}
            </select>
          </label>
          <Action
            disabled={
              busy || !buddy || !person.checkedInAt || !!person.checkedOutAt
            }
            onClick={() =>
              run((signal) =>
                api.request(sitePath(site.id, "/buddy-assignment"), {
                  method: "PUT",
                  body: { workerId: person.userId, buddyId: buddy },
                  signal,
                }),
              )
            }
          >
            동료 재배정
          </Action>
          {person.buddyUserId === site.foremanId &&
            person.attendanceId &&
            !person.checkedOutAt && (
              <>
                <hr />
                <h3>반장 보호구 확인</h3>
                <CameraCapture
                  key={person.attendanceId}
                  value={photo}
                  onChange={(photo) =>
                    setCapture({ attendanceId: person.attendanceId, photo })
                  }
                  label="보호구만 촬영 · 선택"
                />
                <div className="inline">
                  <Action
                    disabled={busy}
                    onClick={() =>
                      run(async (signal) => {
                        const photoId = await ppeUpload(
                          person.attendanceId,
                          photo,
                          async () => {
                            const blob = await (
                              await fetch(photo.data, { signal })
                            ).blob();
                            const file = new File([blob], "ppe.jpg", {
                              type: blob.type,
                            });
                            return api.upload(site.id, "ppe", file, signal);
                          },
                        );
                        await api.request(
                          "/attendances/" + person.attendanceId + "/peer-check",
                          {
                            method: "PUT",
                            body: {
                              outcome: "checked",
                              ...(photoId ? { photoId } : {}),
                            },
                            signal,
                          },
                        );
                      })
                    }
                  >
                    확인 저장
                  </Action>
                  <Action
                    secondary
                    disabled={busy}
                    onClick={() =>
                      run((signal) =>
                        api.request(
                          "/attendances/" + person.attendanceId + "/peer-check",
                          {
                            method: "PUT",
                            body: { outcome: "mismatch" },
                            signal,
                          },
                        ),
                      )
                    }
                  >
                    불일치 기록
                  </Action>
                </div>
                <p className="helper">
                  사진 없이 저장하면 진술 확인으로 남아요.
                </p>
              </>
            )}
        </Modal>
      )}
    </>
  );
}
function Risks(props) {
  const { api, site, version, run, busy } = props;
  const [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(null),
    [creating, setCreating] = useState(false);
  const resource = useRemote(
    (signal) =>
      api.request(
        sitePath(site.id, "/risks") + query({ status, offset, limit: 40 }),
        { signal },
      ),
    [api, site.id, version, status, offset],
    15000,
  );
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          {[
            ["", "전체"],
            ["open", "미조치"],
            ["awaiting_recheck", "재확인 대기"],
            ["resolved", "완료"],
          ].map(([id, title]) => (
            <button
              key={id}
              className={status === id ? "active" : ""}
              onClick={() => {
                setStatus(id);
                setOffset(0);
              }}
            >
              {title}{" "}
              {resource.data?.counts &&
                (id
                  ? resource.data.counts[id]
                  : Object.values(resource.data.counts).reduce(
                      (total, count) => total + count,
                      0,
                    ))}
            </button>
          ))}
        </div>
        <Action onClick={() => setCreating(true)}>
          <Plus size={16} />
          위험 신고
        </Action>
      </div>
      <Remote resource={resource}>
        {(data) => (
          <>
            <div className="risk-grid">
              {data.risks.map((risk) => (
                <section className="panel risk-large" key={risk.id}>
                  <div className="panel-heading">
                    <Tag tone={risk.status === "resolved" ? "green" : "amber"}>
                      {text(risk.status)}
                    </Tag>
                    <small>
                      {time(risk.createdAt)}
                      {risk.status === "open" &&
                        " · " + elapsedSince(risk.createdAt)}
                    </small>
                  </div>
                  {risk.beforePhotoId ? (
                    <Photo
                      api={api}
                      siteId={site.id}
                      id={risk.beforePhotoId}
                      label="신고 당시 사진"
                    />
                  ) : (
                    <div className="risk-photo">
                      <TriangleAlert size={32} />
                      <span>첨부 사진 없음</span>
                    </div>
                  )}
                  <h2>{risk.title}</h2>
                  <p>
                    {risk.zone} · {text(risk.category)}
                  </p>
                  <p>{risk.note}</p>
                  <Action secondary onClick={() => setSelected(risk.id)}>
                    조치 이력 보기
                  </Action>
                </section>
              ))}
            </div>
            {!data.risks.length && (
              <Empty>해당 상태의 위험 신고가 없어요.</Empty>
            )}
            <div className="toolbar">
              <Action
                secondary
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 40))}
              >
                이전
              </Action>
              <Action
                secondary
                disabled={data.nextOffset == null}
                onClick={() => setOffset(data.nextOffset)}
              >
                다음
              </Action>
            </div>
          </>
        )}
      </Remote>
      {creating && <RiskCreate {...props} onClose={() => setCreating(false)} />}
      {selected && (
        <RiskDetailLive
          {...props}
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function RiskCreate({ api, site, run, busy, onClose }) {
  const [file, setFile] = useState(null);
  const pending = useRef(null);
  return (
    <Modal title="위험 신고" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          run(async (signal) => {
            const fields = {
              category: data.get("category"),
              zone: data.get("zone"),
              anonymous: data.get("anonymous") === "on",
              ...(data.get("title") ? { title: data.get("title") } : {}),
              ...(data.get("note") ? { note: data.get("note") } : {}),
            };
            const fingerprint = JSON.stringify(fields);
            if (
              !pending.current ||
              pending.current.fingerprint !== fingerprint ||
              pending.current.file !== file
            ) {
              const beforePhotoId = file
                ? (await api.upload(site.id, "risk_before", file, signal)).photo
                    .id
                : undefined;
              pending.current = {
                fingerprint,
                file,
                body: {
                  ...fields,
                  requestId: crypto.randomUUID(),
                  ...(beforePhotoId ? { beforePhotoId } : {}),
                },
              };
            }
            await api.request(sitePath(site.id, "/risks"), {
              method: "POST",
              body: pending.current.body,
              signal,
            });
            onClose();
          });
        }}
      >
        <label>
          종류
          <select name="category">
            {["fall", "trip", "collision", "electric", "other"].map((value) => (
              <option key={value} value={value}>
                {text(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          위치·구역
          <input name="zone" required maxLength={100} />
        </label>
        <label>
          제목 · 선택
          <input name="title" maxLength={100} />
        </label>
        <label>
          설명 · 선택
          <textarea name="note" maxLength={1000} />
        </label>
        <label className="toggle-row">
          익명 신고
          <input name="anonymous" type="checkbox" defaultChecked />
        </label>
        <PhotoInput onChange={setFile} label="신고 사진 · 선택" />
        <button className="button primary" disabled={busy}>
          신고 저장
        </button>
      </form>
    </Modal>
  );
}
function RiskDetailLive({
  api,
  site,
  workers,
  run,
  busy,
  version,
  id,
  onClose,
}) {
  const resource = useRemote(
    (signal) => api.request(sitePath(site.id, "/risks/" + id), { signal }),
    [api, site.id, id, version],
    10000,
  );
  const [file, setFile] = useState(null),
    [assignee, setAssignee] = useState("");
  const upload = useMemo(createPhotoSubmission, []);
  return (
    <Modal title="위험 신고 · 조치" onClose={onClose}>
      <Remote resource={resource}>
        {({ risk }) => (
          <>
            <Tag tone={risk.status === "resolved" ? "green" : "amber"}>
              {text(risk.status)}
            </Tag>
            <h2>{risk.title}</h2>
            <p>
              {risk.zone} · {text(risk.category)}
            </p>
            <p>{risk.note}</p>
            <div className="two-col">
              {risk.beforePhotoId && (
                <Photo
                  api={api}
                  siteId={site.id}
                  id={risk.beforePhotoId}
                  label="조치 전"
                />
              )}
              {risk.afterPhotoId && (
                <Photo
                  api={api}
                  siteId={site.id}
                  id={risk.afterPhotoId}
                  label="조치 후"
                />
              )}
            </div>
            <p>
              담당자 {risk.assigneeName || "미배정"} · 조치자{" "}
              {risk.fixerName || "미기록"} · 재확인자{" "}
              {risk.verifierName || "미기록"}
            </p>
            <p>
              신고 {time(risk.createdAt)} ·{" "}
              {risk.anonymous
                ? "신고자 이름 비공개"
                : "신고자 " + (risk.reporterName || "미기록")}
              {risk.status === "open" && " · " + elapsedSince(risk.createdAt)}
              <br />
              조치 {time(risk.fixedAt)}
              <br />
              재확인 {time(risk.verifiedAt)}
            </p>
            {risk.status === "open" && (
              <>
                <label>
                  조치 담당자
                  <select
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                  >
                    <option value="">선택</option>
                    <option value={site.foremanId}>
                      {site.foremanName} · 반장
                    </option>
                    {workers.map((worker) => (
                      <option key={worker.userId} value={worker.userId}>
                        {worker.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Action
                  disabled={busy || !assignee}
                  onClick={() =>
                    run((signal) =>
                      api.request(
                        sitePath(site.id, "/risks/" + id + "/request"),
                        {
                          method: "PUT",
                          body: { assigneeId: assignee },
                          signal,
                        },
                      ),
                    )
                  }
                >
                  담당자 배정
                </Action>
                <hr />
                <PhotoInput onChange={setFile} label="조치 후 사진 · 필수" />
                <Action
                  disabled={busy || !file}
                  onClick={() =>
                    run(async (signal) => {
                      const afterPhotoId = await upload(id, file, () =>
                        api.upload(site.id, "risk_after", file, signal),
                      );
                      await api.request(
                        sitePath(site.id, "/risks/" + id + "/fix"),
                        {
                          method: "PUT",
                          body: { afterPhotoId },
                          signal,
                        },
                      );
                      setFile(null);
                    })
                  }
                >
                  조치 완료 신고
                </Action>
              </>
            )}
            {risk.status === "awaiting_recheck" && (
              <>
                <p className="helper">
                  신고자·실제 조치자 외 다른 현장 구성원이 확인해야 해요.
                </p>
                <Action
                  disabled={busy || !risk.canRecheck}
                  onClick={() =>
                    run((signal) =>
                      api.request(
                        sitePath(site.id, "/risks/" + id + "/recheck"),
                        { method: "PUT", body: {}, signal },
                      ),
                    )
                  }
                >
                  독립 재확인 완료
                </Action>
              </>
            )}
          </>
        )}
      </Remote>
    </Modal>
  );
}

function SafetyTimeline({ api, site, user, workers, version, run, busy }) {
  const [date, setDate] = useState(day),
    [before, setBefore] = useState(null),
    [integrity, setIntegrity] = useState(null),
    [correct, setCorrect] = useState(null);
  const resource = useRemote(
    (signal) =>
      api.request(
        sitePath(site.id, "/timeline") +
          query({ scope: "site", day: date, before, limit: 50 }),
        { signal },
      ),
    [api, site.id, date, before, version],
  );
  const corrections = useRemote(
    (signal) => api.request(sitePath(site.id, "/corrections"), { signal }),
    [api, site.id, version],
  );
  const name = (id) =>
    id === user.id
      ? user.name
      : workers.find((item) => item.userId === id)?.name || "현장 구성원";
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <label>
            기록 날짜
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setBefore(null);
              }}
            />
          </label>
          <Action
            secondary
            disabled={busy}
            onClick={() =>
              run(
                async (signal) =>
                  setIntegrity(
                    await api.request(sitePath(site.id, "/timeline/verify"), {
                      signal,
                    }),
                  ),
                "현장 원본 검사를 마쳤어요.",
              )
            }
          >
            <ShieldCheck size={17} />
            현장 전체 원본 검사
          </Action>
        </div>
        {integrity && (
          <div className={"notice " + (integrity.valid ? "green" : "amber")}>
            {integrity.valid ? "원본 연결 일치" : "원본 연결 불일치"} ·{" "}
            {integrity.checked}건 검사
            {integrity.firstInvalidSeq != null &&
              " · 첫 오류 순번 " + integrity.firstInvalidSeq}
          </div>
        )}
        <Remote resource={resource}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>서버 수신 시각</th>
                      <th>사건</th>
                      <th>근거</th>
                      <th>사람</th>
                      <th>기록 확인</th>
                      <th>사진·정정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event) => (
                      <tr key={event.id}>
                        <td>{time(event.recordedAt)}</td>
                        <td>
                          <b>{eventLabel(event.type)}</b>
                          {event.type === "incident.accepted" &&
                            Number.isFinite(event.details?.responseSeconds) && (
                              <small>
                                요청 후 {event.details.responseSeconds}초 ·{" "}
                                {text(event.details.role)}
                              </small>
                            )}
                          <details>
                            <summary>원본 식별자</summary>
                            <small>{event.id}</small>
                            <p>
                              {event.details?.note || event.details?.reviewNote}
                            </p>
                          </details>
                        </td>
                        <td>
                          {[
                            "incident.response_delayed",
                            "incident.verification_overdue",
                          ].includes(event.type) && (
                            <Tag tone="amber">지연</Tag>
                          )}
                          {(event.type.startsWith("correction.") ||
                            event.type === "safety_check.corrected") && (
                            <Tag>정정 추가</Tag>
                          )}
                          {event.source === "human"
                            ? "사람이 확인"
                            : "시스템 기록·추정"}
                        </td>
                        <td>
                          {event.actorId
                            ? name(event.actorId)
                            : event.subjectId
                              ? name(event.subjectId)
                              : "익명·시스템 기록"}
                          {event.subjectId &&
                            event.actorId &&
                            event.subjectId !== event.actorId && (
                              <small>대상 · {name(event.subjectId)}</small>
                            )}
                        </td>
                        <td>
                          {integrity?.firstInvalidSeq === event.seq
                            ? "연결 불일치"
                            : integrity && event.seq <= integrity.checked
                              ? "검사 시 일치"
                              : "미검사"}
                        </td>
                        <td>
                          {event.details?.photoId && (
                            <Photo
                              api={api}
                              siteId={site.id}
                              id={event.details.photoId}
                              label="확인 사진"
                            />
                          )}
                          {event.canRequestCorrection && (
                            <Action
                              secondary
                              onClick={() => setCorrect(event.id)}
                            >
                              정정 요청
                            </Action>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.events.length && <Empty />}
              <div className="toolbar">
                <Action
                  secondary
                  disabled={!before}
                  onClick={() => setBefore(null)}
                >
                  최신 기록
                </Action>
                <Action
                  secondary
                  disabled={data.nextBefore == null}
                  onClick={() => setBefore(data.nextBefore)}
                >
                  이전 기록 더 보기
                </Action>
              </div>
            </>
          )}
        </Remote>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>정정 요청</h2>
        </div>
        <Remote resource={corrections}>
          {(data) =>
            data.corrections.length ? (
              data.corrections.map((item) => (
                <article className="correction-row" key={item.id}>
                  <div className="inline">
                    <Tag>{text(item.status)}</Tag>
                    <small>{time(item.createdAt)}</small>
                  </div>
                  <p>{item.note}</p>
                  <small>원본 사건 {item.eventId}</small>
                  {item.reviewNote && <p>검토: {item.reviewNote}</p>}
                  {item.status === "pending" && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        run((signal) =>
                          api.request(
                            sitePath(
                              site.id,
                              "/corrections/" + item.id + "/review",
                            ),
                            {
                              method: "PUT",
                              body: {
                                status: data.get("status"),
                                note: data.get("note"),
                              },
                              signal,
                            },
                          ),
                        );
                      }}
                    >
                      <label>
                        검토 내용
                        <input name="note" required maxLength={1000} />
                      </label>
                      <div className="inline">
                        <select name="status">
                          <option value="accepted">승인</option>
                          <option value="declined">반려</option>
                        </select>
                        <button className="button primary" disabled={busy}>
                          검토 저장
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))
            ) : (
              <Empty>정정 요청이 없어요.</Empty>
            )
          }
        </Remote>
      </section>
      {correct && (
        <CorrectionForm
          api={api}
          site={site}
          id={correct}
          run={run}
          busy={busy}
          close={() => setCorrect(null)}
        />
      )}
    </>
  );
}
function CorrectionForm({ api, site, id, run, busy, close }) {
  const pending = useRef(null);
  return (
    <Modal title="정정 요청" onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const note = new FormData(event.currentTarget).get("note");
          if (pending.current?.note !== note)
            pending.current = { note, requestId: crypto.randomUUID() };
          run(async (signal) => {
            await api.request(
              sitePath(site.id, "/timeline/" + id + "/corrections"),
              { method: "POST", body: pending.current, signal },
            );
            close();
          });
        }}
      >
        <label>
          바로잡을 내용
          <textarea name="note" required maxLength={1000} />
        </label>
        <button className="button primary" disabled={busy}>
          정정 요청 저장
        </button>
      </form>
    </Modal>
  );
}
function Records({ api, site, version, run, busy }) {
  const [month, setMonth] = useState(() => day().slice(0, 7));
  const resource = useRemote(
    (signal) =>
      api.request(sitePath(site.id, "/reports/monthly") + query({ month }), {
        signal,
      }),
    [api, site.id, month, version],
  );
  const file = (format) =>
    run(
      async (signal) =>
        downloadFile(
          await api.request(
            sitePath(site.id, "/reports/monthly") + query({ month, format }),
            { signal, response: "blob" },
          ),
          "safeloop-monthly." + format,
        ),
      "보고서 파일을 내려받았어요.",
    );
  return (
    <>
      <div className="toolbar">
        <label>
          조회 월
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <div className="inline">
          <Action disabled={busy} onClick={() => file("csv")}>
            CSV
          </Action>
          <Action secondary disabled={busy} onClick={() => file("pdf")}>
            PDF
          </Action>
        </div>
      </div>
      <Remote resource={resource}>
        {(data) => (
          <>
            <div className="stats-grid three">
              <Stat
                title="작업자 수"
                value={data.summary.totalWorkers}
                unit="명"
                icon={Users}
                color="green"
                footer="선택 월 근로 기록 기준"
              />
              <Stat
                title="근로일 합계"
                value={data.summary.workerDays}
                unit="일"
                icon={ClipboardList}
                color="green"
                footer="작업자별 근로일 합계"
              />
              <Stat
                title="예상 일당 합계"
                value={
                  data.summary.expectedWageTotal == null
                    ? "미입력"
                    : new Intl.NumberFormat("ko-KR").format(
                        data.summary.expectedWageTotal,
                      )
                }
                unit="원"
                icon={FileText}
                color="gray"
                footer="실제 지급액과 다를 수 있어요"
              />
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h2>작업자별 근로 기록</h2>
                <Tag>{data.summary.pendingCorrections}건 정정 대기</Tag>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>근로일</th>
                      <th>근무 시간</th>
                      <th>예상 일당</th>
                      <th>사진 확인</th>
                      <th>사진 없는 확인</th>
                      <th>정정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map((worker) => (
                      <tr key={worker.userId}>
                        <td>
                          <b>{worker.name}</b>
                        </td>
                        <td>{worker.workerDays}일</td>
                        <td>
                          {Math.floor(worker.workedMinutes / 60)}시간{" "}
                          {worker.workedMinutes % 60}분
                        </td>
                        <td>{money(worker.expectedWageTotal)}</td>
                        <td>{worker.photoConfirmedChecks}일</td>
                        <td>{worker.statementOnlyChecks}일</td>
                        <td>
                          <Tag
                            tone={worker.pendingCorrections ? "amber" : "green"}
                          >
                            {worker.pendingCorrections
                              ? worker.pendingCorrections + "건 요청"
                              : "정정 요청 없음"}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.workers.length && <Empty />}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>일별 출퇴근</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>근로일</th>
                      <th>작업자</th>
                      <th>출근</th>
                      <th>퇴근</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyRecords.map((row) => (
                      <tr key={row.id}>
                        <td>{row.workDate}</td>
                        <td>{row.name}</td>
                        <td>{time(row.checkedInAt)}</td>
                        <td>{time(row.checkedOutAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.dataGaps.length > 0 && (
                <div className="notice amber">{data.dataGaps.join(" · ")}</div>
              )}
            </section>
          </>
        )}
      </Remote>
    </>
  );
}
function Reports({ api, site, workers, version, run, busy, openIncident }) {
  const [month, setMonth] = useState(() => day().slice(0, 7)),
    [target, setTarget] = useState("all"),
    [range, setRange] = useState(false),
    [from, setFrom] = useState(() => day().slice(0, 7) + "-01"),
    [to, setTo] = useState(day),
    [offset, setOffset] = useState(0),
    [previewPath, setPreviewPath] = useState(null);
  const selectedPath = workReportPath(site.id, {
    month,
    from: range ? from : undefined,
    to: range ? to : undefined,
    target,
  });
  const preview = useRemote(
    (signal) =>
      previewPath
        ? api.request(previewPath, { signal })
        : Promise.resolve(null),
    [api, previewPath, version],
  );
  const incidents = useRemote(
    (signal) =>
      api.request(
        sitePath(site.id, "/reports/incidents") +
          query({ month, offset, limit: 30 }),
        { signal },
      ),
    [api, site.id, month, offset, version],
  );
  const summary = useRemote(
    (signal) =>
      api.request(sitePath(site.id, "/reports/monthly") + query({ month }), {
        signal,
      }),
    [api, site.id, month, version],
  );
  const options = [
    ...new Map(
      [
        ...workers.map((w) => ({ userId: w.userId, name: w.name })),
        ...(summary.data?.workers || []),
      ].map((w) => [w.userId, w]),
    ).values(),
  ];
  function download(path, format) {
    run(
      async (signal) =>
        downloadFile(
          await api.request(path, { signal, response: "blob" }),
          "safeloop-report." + format,
        ),
      "보고서 파일을 내려받았어요.",
    );
  }
  return (
    <>
      <div className="toolbar">
        <label>
          조회 월
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setOffset(0);
              setPreviewPath(null);
            }}
          />
        </label>
      </div>
      <div className="report-grid">
        <section className="panel report-card">
          <div className="report-icon">
            <ClipboardList size={28} />
          </div>
          <h2>작업자 근로 기록</h2>
          <label>
            대상
            <select
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
                setPreviewPath(null);
              }}
            >
              <option value="all">전체 작업자</option>
              {options.map((worker) => (
                <option value={worker.userId} key={worker.userId}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            기간 직접 지정
            <input
              type="checkbox"
              checked={range}
              onChange={(event) => {
                setRange(event.target.checked);
                setPreviewPath(null);
              }}
            />
          </label>
          {range && (
            <div className="two-col">
              <label>
                시작
                <input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPreviewPath(null);
                  }}
                />
              </label>
              <label>
                종료
                <input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPreviewPath(null);
                  }}
                />
              </label>
            </div>
          )}
          <div className="inline">
            {["csv", "pdf"].map((format) => (
              <Action
                key={format}
                disabled={busy || (range && (!from || !to || from > to))}
                onClick={() =>
                  download(
                    workReportPath(site.id, {
                      month,
                      from: range ? from : undefined,
                      to: range ? to : undefined,
                      target,
                      format,
                    }),
                    format,
                  )
                }
              >
                <Download size={16} />
                {format.toUpperCase()}
              </Action>
            ))}
          </div>
          <Action
            secondary
            disabled={busy || (range && (!from || !to || from > to))}
            onClick={() =>
              previewPath === selectedPath
                ? preview.reload()
                : setPreviewPath(selectedPath)
            }
          >
            기록 미리 보기
          </Action>
        </section>
        <section className="panel report-card">
          <div className="report-icon">
            <FileText size={28} />
          </div>
          <h2>월간 근로일·안전확인 집계</h2>
          <p>근로일, 본인 점검, 서로 찍기와 사진 없는 확인을 구분해요.</p>
          <div className="inline">
            {["csv", "pdf"].map((format) => (
              <Action
                key={format}
                disabled={busy}
                onClick={() =>
                  download(
                    sitePath(site.id, "/reports/monthly") +
                      query({ month, format }),
                    format,
                  )
                }
              >
                <Download size={16} />
                {format.toUpperCase()}
              </Action>
            ))}
          </div>
        </section>
      </div>
      {previewPath === selectedPath && (
        <Remote resource={preview}>
          {(data) => (
            <section className="panel">
              <div className="panel-heading">
                <h2>선택한 근로 기록</h2>
                <Action secondary onClick={() => setPreviewPath(null)}>
                  닫기
                </Action>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>작업자</th>
                      <th>날짜</th>
                      <th>직종·구역</th>
                      <th>출근·퇴근</th>
                      <th>예상 일당</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shifts.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.workDate}</td>
                        <td>
                          {row.occupation || "미등록"} · {row.zone || "미등록"}
                        </td>
                        <td>
                          {time(row.checkedInAt)} / {time(row.checkedOutAt)}
                        </td>
                        <td>{money(row.expectedWage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.shifts.length && <Empty />}
              {data.dataGaps.length > 0 && (
                <p className="notice amber">{data.dataGaps.join(" · ")}</p>
              )}
            </section>
          )}
        </Remote>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>사고 경위 보고서</h2>
        </div>
        <Remote resource={incidents}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>작업자</th>
                      <th>시작</th>
                      <th>구역·상태</th>
                      <th>사건 상세</th>
                      <th>다운로드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td>{incident.workerName}</td>
                        <td>{time(incident.createdAt)}</td>
                        <td>
                          {incident.zone} · {text(incident.status)}
                        </td>
                        <td>
                          <Action
                            secondary
                            onClick={() => openIncident(incident.id, true)}
                          >
                            상세 보기
                          </Action>
                        </td>
                        <td>
                          <div className="inline">
                            {["pdf", "csv"].map((format) => (
                              <Action
                                key={format}
                                secondary
                                disabled={busy}
                                onClick={() =>
                                  download(
                                    sitePath(
                                      site.id,
                                      "/reports/incidents/" + incident.id,
                                    ) + query({ format }),
                                    format,
                                  )
                                }
                              >
                                {format.toUpperCase()}
                              </Action>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.incidents.length && (
                <Empty>선택한 달에 사건이 없어요.</Empty>
              )}
              <div className="toolbar">
                <Action
                  secondary
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  이전
                </Action>
                <Action
                  secondary
                  disabled={data.nextOffset == null}
                  onClick={() => setOffset(data.nextOffset)}
                >
                  다음
                </Action>
              </div>
            </>
          )}
        </Remote>
      </section>
      <div className="notice">
        보고서에는 원본 사건, 서버 수신 시각, 정정 이력과 누락을 포함해요.
        산재·보험 접수용 참고 자료이며 법률 판단과 실제 119 접수 확인은
        별도예요.
      </div>
    </>
  );
}

function Incident({
  api,
  site,
  user,
  id,
  historical,
  version,
  run,
  busy,
  onClose,
  dial,
}) {
  const resource = useRemote(
    (signal) => api.request("/incidents/" + id, { signal }),
    [api, id, version],
    5000,
  );
  const [condition, setCondition] = useState(""),
    [reason, setReason] = useState(""),
    [photo, setPhoto] = useState(null),
    [receiptError, setReceiptError] = useState("");
  const incident = resource.data?.incident,
    contact = incident?.recipients.find((item) => item.userId === user.id);
  const upload = useMemo(createPhotoSubmission, []);
  useEffect(() => {
    if (
      historical ||
      !contact ||
      contact.openedAt ||
      incident.closedAt ||
      incident.status === "closed"
    )
      return;
    const controller = new AbortController();
    (async () => {
      try {
        await api.request("/incidents/" + id + "/receipt", {
          method: "PUT",
          body: { stage: "opened" },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setReceiptError("");
      } catch (error) {
        if (!controller.signal.aborted) setReceiptError(error.message);
      }
    })();
    return () => controller.abort();
  }, [
    api,
    id,
    historical,
    incident?.closedAt,
    incident?.status,
    contact?.userId,
    contact?.openedAt,
  ]);
  const command = (suffix, body = {}) =>
    run((signal) =>
      api.request("/incidents/" + id + suffix, { method: "PUT", body, signal }),
    );
  return (
    <Modal title="긴급 호출 · 대응" onClose={onClose}>
      <Remote resource={resource}>
        {({ incident: c }) => (
          <>
            <div className="inline">
              <Tag tone={c.status === "closed" ? "green" : "amber"}>
                {text(c.status)}
              </Tag>
              <small>5초마다 갱신</small>
            </div>
            <h2>
              {c.worker.name} · {c.zone || "구역 미등록"}
            </h2>
            <p>
              시작 {time(c.createdAt)} · 최대 충격{" "}
              {c.peakG == null ? "미기록" : c.peakG + "G (시스템 추정)"}
            </p>
            {c.location && (
              <p>
                사건 위치 {c.location.latitude.toFixed(5)},{" "}
                {c.location.longitude.toFixed(5)} · 오차{" "}
                {Math.round(c.location.accuracyMeters)}m
              </p>
            )}
            <p>
              본인 응답{" "}
              {c.workerResponse === "okay"
                ? "괜찮아요"
                : c.workerResponse === "help_needed"
                  ? "도움 필요"
                  : "미응답"}{" "}
              · {time(c.workerRespondedAt)}
            </p>
            {receiptError && (
              <div className="notice amber" role="alert">
                열람 기록: {receiptError}
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>호출 대상</th>
                    <th>요청</th>
                    <th>발송</th>
                    <th>수신</th>
                    <th>열람</th>
                    <th>수락·거절</th>
                  </tr>
                </thead>
                <tbody>
                  {c.recipients.map((item) => (
                    <tr key={item.userId}>
                      <td>
                        {item.name}
                        <small>{text(item.role)}</small>
                      </td>
                      <td>{time(item.requestedAt)}</td>
                      <td>{time(item.sentAt)}</td>
                      <td>{time(item.receivedAt)}</td>
                      <td>{time(item.openedAt)}</td>
                      <td>
                        {time(item.acceptedAt)}
                        <small>
                          {item.acceptedAt && item.requestedAt
                            ? Math.max(
                                0,
                                Math.round(
                                  (new Date(item.acceptedAt) -
                                    new Date(item.requestedAt)) /
                                    1000,
                                ),
                              ) + "초 후 수락"
                            : item.declinedAt
                              ? "거절 " + time(item.declinedAt)
                              : ""}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contact &&
              !contact.declinedAt &&
              !c.responderId &&
              ["calling", "unanswered"].includes(c.status) && (
                <div className="inline">
                  <Action disabled={busy} onClick={() => command("/accept")}>
                    제가 확인하러 갈게요
                  </Action>
                  <Action
                    secondary
                    disabled={busy}
                    onClick={() => command("/decline")}
                  >
                    수락 어려움
                  </Action>
                </div>
              )}
            {!c.closedAt &&
              !c.observedAt &&
              c.notices?.some(
                (notice) => notice.type === "verification_overdue",
              ) && (
                <div className="notice amber">
                  수락 후 2분 동안 현장 상태가 확인되지 않았어요. 반장이 직접
                  상황을 확인해 주세요.
                </div>
              )}
            {c.status === "unanswered" && (
              <div className="notice amber">
                <p>
                  수락한 동료가 없어요. 현장 책임자가 직접 연락해 안전을 확인해
                  주세요. 긴급하면 119 전화 화면을 여세요.
                </p>
                <Action
                  secondary
                  disabled={busy}
                  onClick={() => command("/retry")}
                >
                  다시 호출
                </Action>
                <Action secondary onClick={() => dial(c.id)}>
                  119 전화 화면 열기
                </Action>
              </div>
            )}
            {c.responderId === user.id && c.status === "responding" && (
              <Action disabled={busy} onClick={() => command("/arrival")}>
                현장에 도착했어요
              </Action>
            )}
            {c.responderId === user.id && c.status === "arrived" && (
              <>
                <label>
                  현장에서 확인한 상태
                  <select
                    value={condition}
                    onChange={(event) => setCondition(event.target.value)}
                  >
                    <option value="">선택</option>
                    {[
                      "unconscious",
                      "immobile",
                      "conscious",
                      "appears_safe",
                    ].map((value) => (
                      <option value={value} key={value}>
                        {text(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <Action
                  disabled={busy || !condition}
                  onClick={() => command("/observation", { condition })}
                >
                  관찰 상태 저장
                </Action>
                {c.observedAt && (
                  <>
                    <hr />
                    <label>
                      대응 완료 사유
                      <select
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      >
                        <option value="">선택</option>
                        {[
                          "no_help_needed",
                          "onsite_action_completed",
                          "handoff_confirmed",
                        ].map((value) => (
                          <option value={value} key={value}>
                            {text(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PhotoInput onChange={setPhoto} label="현장 사진 · 선택" />
                    <Action
                      disabled={busy || !reason}
                      onClick={() =>
                        run(async (signal) => {
                          const photoId = await upload(id, photo, () =>
                            api.upload(
                              site.id,
                              "incident_scene",
                              photo,
                              signal,
                            ),
                          );
                          await api.request(
                            "/incidents/" + id + "/resolution",
                            {
                              method: "PUT",
                              body: { reason, ...(photoId ? { photoId } : {}) },
                              signal,
                            },
                          );
                        })
                      }
                    >
                      대응 완료 저장
                    </Action>
                  </>
                )}
              </>
            )}
            <div className="settings-row">
              <span>현장 도착</span>
              <b>
                {c.resolution === "worker_confirmed_okay" && !c.arrivedAt
                  ? "출동 대상 아님"
                  : time(c.arrivedAt)}
              </b>
            </div>
            <div className="settings-row">
              <span>관찰</span>
              <b>
                {c.resolution === "worker_confirmed_okay" && !c.observedAt
                  ? "출동 대상 아님"
                  : text(c.observation) + " · " + time(c.observedAt)}
              </b>
            </div>
            {c.closedAt && (
              <div className="notice green">
                {text(c.resolution)} · {time(c.closedAt)}
              </div>
            )}
            {c.photoId && (
              <Photo
                api={api}
                siteId={site.id}
                id={c.photoId}
                label="사고 현장 사진"
              />
            )}
            <p className="helper">
              사고 지점 사진은 상황이 안정된 뒤에만 추가해요. 사진 없이도 확인을
              마칠 수 있어요.
            </p>
            <div className="inline">
              <Action
                secondary
                onClick={() =>
                  dial(c.closedAt || c.status === "closed" ? null : c.id)
                }
              >
                <Phone size={16} />
                119 전화 화면 열기
              </Action>
              <Action
                disabled={busy}
                onClick={() =>
                  run(
                    async (signal) =>
                      downloadFile(
                        await api.request(
                          sitePath(site.id, "/reports/incidents/" + id) +
                            "?format=pdf",
                          { signal, response: "blob" },
                        ),
                        "safeloop-incident.pdf",
                      ),
                    "사고 보고서를 내려받았어요.",
                  )
                }
              >
                사고 보고서 PDF
              </Action>
            </div>
            <p className="helper">
              전화 화면 열기는 통화 연결·신고 접수 확인이 아니에요.
            </p>
          </>
        )}
      </Remote>
    </Modal>
  );
}
