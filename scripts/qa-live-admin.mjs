import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const root = fileURLToPath(new URL("../web", import.meta.url));
const apiBase = "http://127.0.0.1:19900";
const server = await createServer({
  root,
  configFile: false,
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBase) },
  optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] },
  server: {
    host: "127.0.0.1",
    port: 0,
    // Exercise the 119 button without allowing Chrome to launch an external dialer.
    headers: {
      "Content-Security-Policy":
        "sandbox allow-scripts allow-same-origin allow-forms",
    },
  },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const user = { id: "manager", name: "태규" };
  const site = (id) => ({
    id,
    name: id + " 현장",
    code: "CODE-" + id,
    role: "foreman",
    foremanId: user.id,
    foremanName: user.name,
  });
  const sites = [site("A")],
    siteBodies = [],
    reviews = [],
    receipts = [],
    dials = [];
  const fixes = [];
  let uploads = 0,
    attempt = 0,
    releasePreview;
  const previewDelay = new Promise((resolve) => {
    releasePreview = resolve;
  });
  const date = "2026-10-22T00:05:00.000Z";
  const risk = {
    id: "risk",
    title: "개구부",
    zone: "2층",
    status: "open",
    reporterName: "실명 작업자",
    anonymous: false,
    createdAt: date,
  };
  const incident = {
    id: "incident",
    status: "closed",
    worker: { name: "작업자" },
    resolution: "worker_confirmed_okay",
    createdAt: date,
    closedAt: date,
    recipients: [{ userId: "manager" }],
  };
  await page.addInitScript((account) => {
    sessionStorage.setItem(
      "safeloop-nest-session-v1",
      JSON.stringify({
        user: account,
        accessToken: "test",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
  }, user);
  await page.route(apiBase + "/**", async (route) => {
    const req = route.request();
    const { pathname: path, searchParams } = new URL(req.url());
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me") return reply({ user });
    if (path === "/sites/mine") return reply({ sites });
    if (path === "/sites") {
      const body = req.postDataJSON();
      siteBodies.push(body);
      if (siteBodies.length === 1) {
        sites.push(site("B"));
        return route.abort();
      }
      return reply({ site: site("B") });
    }
    if (path.endsWith("/workers")) return reply({ workers: [] });
    if (path.endsWith("/dashboard"))
      return reply({
        site: site(path.split("/")[2]),
        activeCalls: [],
        counts: {},
        oldestRisks: [],
        timeline: [],
      });
    if (path.endsWith("/safety-requests"))
      return reply({
        requests: [
          {
            attendanceId: "shift",
            name: "작업자",
            requestedAt: date,
            fallHazard: "unknown",
          },
        ],
      });
    if (path.endsWith("/acknowledgement")) {
      reviews.push(req.postDataJSON());
      return reply({ error: { message: "점검 변경" } }, 409);
    }
    if (path.endsWith("/risks")) return reply({ risks: [risk], counts: {} });
    if (path.endsWith("/risks/risk")) return reply({ risk });
    if (path.endsWith("/photos"))
      return reply({ photo: { id: "image-" + ++uploads } });
    if (path.endsWith("/fix")) {
      fixes.push(req.postDataJSON());
      return ++attempt === 1 ? route.abort() : reply({ risk });
    }
    if (path.endsWith("/timeline"))
      return reply({
        events: [
          {
            id: "anon",
            type: "risk.reported",
            source: "human",
            recordedAt: date,
            canRequestCorrection: true,
          },
          {
            id: "other",
            type: "risk.reported",
            source: "human",
            recordedAt: date,
            canRequestCorrection: false,
          },
        ],
      });
    if (path.endsWith("/corrections")) return reply({ corrections: [] });
    if (path.endsWith("/reports/monthly")) return reply({ workers: [] });
    if (path.endsWith("/reports/incidents"))
      return reply({ incidents: [{ ...incident, workerName: "작업자" }] });
    if (path.endsWith("/reports/work")) {
      const month = searchParams.get("month");
      if (month === "2026-09") await previewDelay;
      return reply({
        shifts: [{ id: month, name: month, checkedInAt: date }],
        dataGaps: [],
      });
    }
    if (path === "/incidents/incident") return reply({ incident });
    if (path.endsWith("/receipt")) {
      receipts.push(req.postDataJSON());
      return reply({ incident });
    }
    if (path.endsWith("/dial-intents") || path.endsWith("/dial-intent")) {
      dials.push({ path, ...req.postDataJSON() });
      return reply({});
    }
    throw Error("Unexpected request: " + path);
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const navigate = (name) =>
    page.locator("nav").getByRole("button", { name }).click();
  const modal = page.getByRole("dialog");
  const close = () => modal.getByRole("button", { name: "닫기" }).click();
  await page.goto(server.resolvedUrls.local[0]);
  await button("요청 확인").click();
  await page.getByText("점검 변경", { exact: true }).first().waitFor();
  assert.deepEqual(reviews, [{ expectedRequestedAt: date }]);

  await button("현장 정보").click();
  await button("새 현장 만들기").click();
  await page.getByRole("heading", { name: "관리할 현장 선택" }).waitFor();
  await page.getByLabel("현장명").fill("B 현장");
  await page.getByLabel("반장 전화번호").fill("010-0000-0000");
  await page.getByLabel("위도").fill("37.5");
  await page.getByLabel("경도").fill("127.05");
  await page.getByLabel("휴식 복귀").fill("13:05");
  await page.getByLabel("교대").fill("18:15");
  await button("현장 생성").evaluate((button) => {
    button.form.requestSubmit();
    button.form.requestSubmit();
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "저장 여부를 먼저" })
    .waitFor();
  await button("현장 생성").click();
  await button("작업자 초대").click();
  await modal.getByText("CODE-B", { exact: true }).waitFor();
  assert.equal(siteBodies.length, 2);
  assert.match(siteBodies[0].requestId, /^[a-f0-9-]{36}$/i);
  assert.deepEqual(siteBodies[0], {
    name: "B 현장",
    center: { latitude: 37.5, longitude: 127.05 },
    foremanPhone: "010-0000-0000",
    breakReturnTime: "13:05",
    shiftChangeTime: "18:15",
    requestId: siteBodies[1].requestId,
  });
  assert.deepEqual(siteBodies[1], siteBodies[0]);
  await close();

  await navigate("위험 신고");
  await button("조치 이력 보기").click();
  await modal.getByText(/신고자 실명 작업자/).waitFor();
  await modal
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("test"),
    });
  await button("조치 완료 신고").click();
  await page
    .getByText(/저장 여부를 먼저/)
    .first()
    .waitFor();
  await button("조치 완료 신고").click();
  await page.getByText("저장했어요.", { exact: true }).first().waitFor();
  assert.equal(uploads, 1);
  assert.deepEqual(fixes, [
    { afterPhotoId: "image-1" },
    { afterPhotoId: "image-1" },
  ]);
  await close();

  await navigate("안전 타임라인");
  await button("정정 요청").waitFor();
  assert.equal(await button("정정 요청").count(), 1);
  await navigate("보고서");
  const month = page.getByLabel("조회 월");
  await month.fill("2026-09");
  await Promise.all([
    page.waitForRequest((req) =>
      req.url().includes("/reports/work?month=2026-09"),
    ),
    button("기록 미리 보기").click(),
  ]);
  await month.fill("2026-10");
  await button("기록 미리 보기").click();
  await page.getByRole("cell", { name: "2026-10" }).waitFor();
  releasePreview();
  assert.equal(await page.getByRole("cell", { name: "2026-09" }).count(), 0);
  await button("상세 보기").click();
  await modal.getByText("출동 대상 아님").first().waitFor();
  await modal.getByRole("button", { name: "119 전화 화면 열기" }).click();
  await page
    .getByText(/119 전화 화면 열기 요청을 기록했어요/)
    .first()
    .waitFor();
  assert.equal(receipts.length, 0);
  assert.equal(dials[0].path, "/sites/B/dial-intents");
  assert.ok(Number.isFinite(Date.parse(dials[0].openedAt)));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: stale review, photo retry, reporter privacy, anonymous correction, report race, historical 119 and site creation retry",
  );
} finally {
  await browser?.close();
  await server.close();
}
