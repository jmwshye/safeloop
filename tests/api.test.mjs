import test from "node:test";
import assert from "node:assert/strict";
import {
  createApi,
  normalizeBaseUrl,
  readSession,
  sessionKey,
  siteSettingsBody,
  workReportPath,
  filenameFrom,
  ApiError,
} from "../web/src/api.mjs";

const session = () => ({
  accessToken: "test-access-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: { id: "worker-id", name: "시험 계정" },
});
const response = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

test("현장 설정에 좌표·시간과 명시적 초기화 값을 보존", () => {
  const filled = new URLSearchParams({
    name: "현장",
    latitude: "0",
    longitude: "127.3",
    breakReturnTime: "13:00",
    shiftChangeTime: "18:00",
  });
  assert.deepEqual(siteSettingsBody(filled), {
    name: "현장",
    center: { latitude: 0, longitude: 127.3 },
    breakReturnTime: "13:00",
    shiftChangeTime: "18:00",
    foremanPhone: null,
  });
  filled.delete("latitude");
  assert.throws(() => siteSettingsBody(filled), /함께 입력/);
  filled.delete("longitude");
  filled.delete("shiftChangeTime");
  assert.equal(siteSettingsBody(filled).center, null);
  assert.equal(siteSettingsBody(filled).shiftChangeTime, null);
});
function fixture(fetchImpl, overrides = {}) {
  return createApi({
    baseUrl: "http://127.0.0.1:3300",
    getSession: session,
    fetchImpl,
    ...overrides,
  });
}

test("API 주소는 HTTPS 또는 로컬 HTTP만 허용하고 인증정보 URL 거부", () => {
  assert.equal(
    normalizeBaseUrl("https://api.example.com/"),
    "https://api.example.com",
  );
  for (const address of [
    "",
    "file:///tmp/api",
    "http://example.com",
    "https://user:secret@example.com",
    "https://api.example.com/?token=secret",
  ])
    assert.throws(() => normalizeBaseUrl(address));
});
test("로그인 요청은 비밀번호를 JSON 본문에만 전송하고 기존 토큰은 제외", async () => {
  let captured;
  const api = fixture(async (url, options) => {
    captured = { url, options };
    return response(session());
  });
  const actual = await api.login("worker@example.com", "examplePassword123");
  assert.equal(actual.accessToken, "test-access-token");
  assert.equal(captured.url, "http://127.0.0.1:3300/auth/login");
  assert.deepEqual(JSON.parse(captured.options.body), {
    email: "worker@example.com",
    password: "examplePassword123",
  });
  assert.equal(captured.options.headers.get("Authorization"), null);
  assert.equal(captured.options.credentials, "omit");
  assert.equal(captured.options.redirect, "error");
});
test("현장 권한 조회는 Bearer 헤더 사용, 403은 로그인 유지", async () => {
  let expired = 0;
  const api = fixture(
    async (url, options) => {
      assert.equal(
        options.headers.get("Authorization"),
        "Bearer test-access-token",
      );
      return response({}, 403);
    },
    { onUnauthorized: () => expired++ },
  );
  await assert.rejects(
    api.request("/sites/other-site/dashboard"),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(expired, 0);
});
test("서버의 401은 로그인 해제하며 실패 응답을 데이터로 반환하지 않음", async () => {
  let expired = 0;
  const api = fixture(
    async () =>
      response(
        { error: { code: "UNAUTHORIZED", message: "다시 로그인" } },
        401,
      ),
    { onUnauthorized: () => expired++ },
  );
  await assert.rejects(api.request("/auth/me"), {
    status: 401,
    code: "UNAUTHORIZED",
  });
  assert.equal(expired, 1);
});
test("로그인 실패 401은 현재 로그인 세션 해제 콜백을 호출하지 않음", async () => {
  let expired = 0;
  const api = fixture(async () => response({}, 401), {
    onUnauthorized: () => expired++,
  });
  await assert.rejects(api.login("wrong@example.com", "incorrect"), {
    status: 401,
  });
  assert.equal(expired, 0);
});
test("이전 계정 조회의 늦은 401이 새 로그인 세션을 지우지 않음", async () => {
  let current = session(),
    finish,
    expired = 0;
  const api = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    { getSession: () => current, onUnauthorized: () => expired++ },
  );
  const pending = api.request("/sites/mine");
  current = { ...session(), accessToken: "new-account-token" };
  finish(response({}, 401));
  await assert.rejects(pending, { status: 401 });
  assert.equal(expired, 0);
});
test("만료된 토큰은 네트워크 요청 전에 차단", async () => {
  let calls = 0,
    expired = 0;
  const api = fixture(
    async () => {
      calls++;
      return response({});
    },
    {
      getSession: () => ({ ...session(), expiresAt: "2020-01-01T00:00:00Z" }),
      onUnauthorized: () => expired++,
    },
  );
  await assert.rejects(api.request("/sites/mine"), { status: 401 });
  assert.equal(calls, 0);
  assert.equal(expired, 1);
});
test("저장소의 유효 세션만 복원하고 만료·변조 형식·저장소 차단 처리", () => {
  let stored = JSON.stringify(session()),
    removed = 0;
  const storage = {
    getItem: (key) => {
      assert.equal(key, sessionKey);
      return stored;
    },
    removeItem: () => removed++,
  };
  assert.equal(readSession(storage).user.id, "worker-id");
  stored = JSON.stringify({ ...session(), expiresAt: "invalid" });
  assert.equal(readSession(storage), null);
  stored = "broken";
  assert.equal(readSession(storage), null);
  assert.equal(removed, 2);
  assert.equal(
    readSession({
      getItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
    }),
    null,
  );
});
test("현장 전환 시 AbortSignal 전달, 취소를 연결 장애로 바꾸지 않음", async () => {
  const controller = new AbortController();
  const api = fixture(
    (url, options) =>
      new Promise((resolve, reject) => {
        assert.ok(options.signal instanceof AbortSignal);
        options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        );
      }),
  );
  const pending = api.request("/sites/first/timeline", {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
test("저장 중 연결 실패를 성공·모의 응답으로 대신하지 않고 자동 재전송하지 않음", async () => {
  let calls = 0;
  const api = fixture(async () => {
    calls++;
    throw new TypeError("network");
  });
  await assert.rejects(
    api.request("/sites/site/risks", {
      method: "POST",
      body: { requestId: "stable-id" },
    }),
    (error) =>
      error.code === "NETWORK_ERROR" && error.message.includes("저장 여부"),
  );
  assert.equal(calls, 1);
});
test("사진은 multipart로 전송하며 파일 형식·크기 초과는 요청 전 거부", async () => {
  let calls = 0;
  const image = new File(["jpeg-bytes"], "check.jpg", { type: "image/jpeg" });
  const api = fixture(async (url, options) => {
    calls++;
    assert.equal(url, "http://127.0.0.1:3300/sites/site-id/photos");
    assert.equal(options.headers.get("Content-Type"), null);
    assert.equal(options.body.get("purpose"), "risk_after");
    assert.equal(options.body.get("file").name, "check.jpg");
    return response({ photo: { id: "photo-id", purpose: "risk_after" } }, 201);
  });
  assert.equal(
    (await api.upload("site-id", "risk_after", image)).photo.id,
    "photo-id",
  );
  assert.throws(() =>
    api.upload(
      "site-id",
      "risk_after",
      new File(["x"], "bad.svg", { type: "image/svg+xml" }),
    ),
  );
  assert.throws(() =>
    api.upload("site-id", "risk_after", {
      type: "image/jpeg",
      size: 6 * 1024 * 1024,
    }),
  );
  assert.equal(calls, 1);
});
test("PDF 다운로드는 인증된 바이트로 받고 URL에 토큰을 넣지 않음", async () => {
  const api = fixture(async (url, options) => {
    assert.ok(!url.includes("token"));
    assert.equal(
      options.headers.get("Authorization"),
      "Bearer test-access-token",
    );
    return new Response("%PDF-test", {
      headers: {
        "content-type": "application/pdf",
        "content-disposition":
          "attachment; filename*=UTF-8''%EA%B7%BC%EB%A1%9C.pdf",
      },
    });
  });
  const file = await api.request(
    "/sites/site/reports/work?scope=all&format=pdf",
    { response: "blob" },
  );
  assert.equal(file.filename, "근로.pdf");
  assert.equal(await file.blob.text(), "%PDF-test");
  assert.equal(
    filenameFrom('attachment; filename="../../report.csv"'),
    ".._.._report.csv",
  );
});
test("개인·전체 작업자 보고서와 직접 기간을 API 명세대로 분리", () => {
  const all = new URL(
    workReportPath("site", { month: "2026-11", target: "all", format: "csv" }),
    "http://test",
  );
  assert.equal(all.searchParams.get("scope"), "all");
  assert.equal(all.searchParams.get("userId"), null);
  const one = new URL(
    workReportPath("site", { month: "2026-11", target: "worker" }),
    "http://test",
  );
  assert.equal(one.searchParams.get("userId"), "worker");
  assert.equal(one.searchParams.get("scope"), null);
  const period = new URL(
    workReportPath("site", {
      month: "2026-11",
      from: "2026-10-01",
      to: "2026-11-01",
    }),
    "http://test",
  );
  assert.equal(period.searchParams.get("month"), null);
  assert.equal(period.searchParams.get("from"), "2026-10-01");
});
test("인증 요청 경로로 외부 URL을 사용하지 못함", async () => {
  let called = false;
  const api = fixture(async () => {
    called = true;
    return response({});
  });
  await assert.rejects(api.request("https://other.example.com/leak"));
  await assert.rejects(api.request("//other.example.com/leak"));
  assert.equal(called, false);
});
test("204 응답은 JSON을 읽지 않고 빈 성공으로 처리", async () => {
  const api = fixture(async () => new Response(null, { status: 204 }));
  assert.equal(
    await api.request("/sites/site/photos/id", { method: "DELETE" }),
    null,
  );
});

test("이전 계정의 늦은 성공 응답을 새 계정 화면에 전달하지 않음", async () => {
  let current = session(),
    finish,
    expired = 0;
  const api = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    { getSession: () => current, onUnauthorized: () => expired++ },
  );
  const pending = api.request("/sites/previous/workers");
  current = { ...session(), accessToken: "next-account-token" };
  finish(response({ workers: [{ name: "이전 계정 전용" }] }));
  await assert.rejects(pending, { code: "SESSION_CHANGED" });
  assert.equal(expired, 0);
});

test("사진·다운로드 바이트를 받는 도중 로그아웃하면 표시·저장에 전달하지 않음", async () => {
  for (const path of [
    "/sites/previous/photos/ppe-id",
    "/sites/previous/reports/work?format=pdf",
  ]) {
    let current = session(),
      finish,
      started;
    const reading = new Promise((resolve) => {
      started = resolve;
    });
    const api = fixture(
      async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        blob: () => {
          started();
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      }),
      { getSession: () => current },
    );
    let consumed = false;
    const pending = api.request(path, { response: "blob" }).then((value) => {
      consumed = true;
      return value;
    });
    await reading;
    current = null;
    finish(new Blob(["private-record"]));
    await assert.rejects(pending, { code: "SESSION_CHANGED" });
    assert.equal(consumed, false);
  }
});

test("현장 전환 취소 이후 fetch가 성공해도 이전 현장 데이터를 반환하지 않음", async () => {
  const controller = new AbortController();
  let finish;
  const api = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = api.request("/sites/previous/timeline", {
    signal: controller.signal,
  });
  controller.abort();
  finish(response({ events: [{ id: "previous-event" }] }));
  await assert.rejects(pending, { name: "AbortError" });
});

test("응답이 멎으면 제한 시간에 취소하며 자동 재전송하지 않음", async () => {
  let calls = 0,
    aborted = false;
  const api = fixture(
    (url, options) =>
      new Promise((resolve, reject) => {
        calls++;
        const timer = setTimeout(() => resolve(response({ late: true })), 200);
        options.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            clearTimeout(timer);
            reject(options.signal.reason);
          },
          { once: true },
        );
      }),
  );
  await assert.rejects(api.request("/sites/mine", { timeoutMs: 5 }), {
    status: 0,
    code: "TIMEOUT",
  });
  assert.equal(calls, 1);
  assert.equal(aborted, true);
});
