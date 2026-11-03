// Demo responses share the NestJS screen components; production never imports these fixtures.
export function createWireframeDemo() {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const at = (t) => date + "T" + t + "+09:00";
  const user = { id: "foreman", name: "이영호 반장" };
  const site = {
    id: "demo-site",
    name: "성수동 근린생활시설 신축",
    code: "SS-2417",
    foremanId: user.id,
    foremanName: user.name,
    role: "foreman",
  };
  const names = ["김민수", "박철수", "정하늘", "오성호", "유재석", "한지민"];
  const workers = names.map((name, i) => ({
    userId: "worker-" + i,
    name,
    occupation: ["형틀 목공", "형틀 목공", "철근", "철근", "설비", "전기"][i],
    zone: [
      "2층 슬래브",
      "2층 슬래브",
      "3층 서측",
      "3층 서측",
      "1층 기계실",
      "1층 기계실",
    ][i],
    buddyUserId:
      i < 4 ? "worker-" + (i % 2 ? i - 1 : i + 1) : i === 4 ? "foreman" : null,
    checkedInAt: i < 5 ? at("07:50:00") : null,
    attendanceId: "attendance-" + i,
    peerStatus:
      i < 4 ? "photo_confirmed" : i === 4 ? "statement_only" : "pending",
    checkInStatus: "okay",
  }));
  const risks = [
    ["개구부 덮개가 없어요", "2층 동측", "open", "fall", 180],
    ["통로에 자재가 쌓여 있어요", "1층 출입구", "open", "trip", 40],
    ["안전난간 보강", "3층 서측", "awaiting_recheck", "fall", 30],
    ["임시 전선 정리", "1층 기계실", "resolved", "electric", 20],
    ["사다리 받침 보강", "2층 서측", "resolved", "fall", 10],
  ].map(([title, zone, status, category, minutes], i) => ({
    id: "risk-" + i,
    title,
    zone,
    status,
    category,
    createdAt: new Date(Date.now() - minutes * 60000).toISOString(),
    anonymous: true,
    note: "현장 안전 확인이 필요해요.",
    canRecheck: true,
  }));
  const events = [
    ["11:25:00", "incident.observation", "human", "worker-1"],
    ["11:21:00", "incident.arrived", "human", "worker-1"],
    ["11:20:38", "incident.accepted", "human", "worker-1"],
    ["11:20:23", "incident.worker_unanswered", "system", "worker-0"],
    ["11:20:08", "incident.signal_detected", "system", "worker-0"],
    ["11:00:00", "incident.response_delayed", "system", "worker-4"],
    ["07:58:00", "peer.confirmed", "human", "worker-0"],
    ["07:52:00", "safety_check.corrected", "human", "worker-0"],
  ].map(([t, type, source, actorId], i) => ({
    id: "event-" + i,
    seq: 8 - i,
    type,
    source,
    actorId,
    recordedAt: at(t),
    details:
      type === "incident.accepted"
        ? { responseSeconds: 13, role: "buddy" }
        : {},
    canRequestCorrection: true,
  }));
  const incident = {
    id: "0420",
    worker: { id: "worker-0", name: "김민수" },
    zone: "2층 슬래브",
    createdAt: at("11:20:08"),
    status: "arrived",
    peakG: 3.4,
    arrivedAt: at("11:21:00"),
    responderId: "worker-1",
    recipients: [
      {
        userId: "worker-1",
        name: "박철수",
        role: "buddy",
        requestedAt: at("11:20:25"),
        sentAt: at("11:20:25"),
        receivedAt: at("11:20:26"),
        openedAt: at("11:20:31"),
        acceptedAt: at("11:20:38"),
      },
      {
        userId: "foreman",
        name: "이영호 반장",
        role: "foreman",
        requestedAt: at("11:20:25"),
        sentAt: at("11:20:25"),
        receivedAt: at("11:20:27"),
        openedAt: at("11:20:40"),
      },
      {
        userId: "worker-2",
        name: "정하늘",
        role: "zone",
        requestedAt: at("11:20:55"),
        sentAt: at("11:20:55"),
      },
    ],
  };
  const api = {
    request: async (path, options = {}) => {
      if (options.method && options.method !== "GET")
        throw new Error(
          "모의 화면에서는 서버에 저장하지 않아요. 실제 조치는 서버 화면에서 진행해 주세요.",
        );
      if (options.response === "blob")
        throw new Error(
          "예시 데이터는 보고서로 내보내지 않아요. 서버 화면에서 실제 보고서를 내려받아 주세요.",
        );
      const url = new URL(path, "https://demo.invalid"),
        p = url.pathname;
      if (p.endsWith("/workers")) return { workers };
      if (p.endsWith("/dashboard"))
        return {
          site,
          workDate: date,
          counts: {
            attended: 5,
            members: 6,
            photoConfirmed: 4,
            openRisks: 2,
            unverified: 0,
          },
          activeCalls: [
            {
              id: incident.id,
              workerId: "worker-0",
              workerName: "김민수",
              zone: incident.zone,
              status: incident.status,
              startedAt: incident.createdAt,
              responderId: "worker-1",
              acceptedAt: at("11:20:38"),
            },
          ],
          oldestRisks: risks.slice(0, 2),
          timeline: events.slice(0, 4),
        };
      if (p.endsWith("/safety-requests")) return { requests: [] };
      if (p.endsWith("/timeline/verify")) return { valid: true, checked: 8 };
      if (p.endsWith("/timeline"))
        return {
          events: url.searchParams.get("day") === date ? events : [],
          nextBefore: null,
        };
      if (p.endsWith("/corrections")) return { corrections: [] };
      if (p.endsWith("/risks"))
        return {
          risks: risks.filter(
            (r) =>
              !url.searchParams.get("status") ||
              r.status === url.searchParams.get("status"),
          ),
          counts: { open: 2, awaiting_recheck: 1, resolved: 2 },
          nextOffset: null,
        };
      if (p.includes("/risks/"))
        return { risk: risks.find((r) => p.endsWith("/" + r.id)) };
      if (p.endsWith("/reports/incidents"))
        return {
          incidents:
            url.searchParams.get("month") === date.slice(0, 7)
              ? [{ ...incident, workerName: "김민수" }]
              : [],
          nextOffset: null,
        };
      if (p.endsWith("/reports/monthly")) {
        const current = url.searchParams.get("month") === date.slice(0, 7);
        return {
          summary: {
            totalWorkers: current ? 6 : 0,
            workerDays: current ? 70 : 0,
            expectedWageTotal: current ? 16100000 : 0,
            pendingCorrections: current ? 1 : 0,
          },
          workers: current
            ? workers.map((w, i) => ({
                ...w,
                workerDays: i < 2 ? 13 : 11,
                workedMinutes: (i < 2 ? 118 : 99) * 60,
                expectedWageTotal: (i < 2 ? 13 : 11) * 230000,
                pendingCorrections: i === 2 ? 1 : 0,
                photoConfirmedChecks: 10,
                statementOnlyChecks: 1,
              }))
            : [],
          dailyRecords: [],
          dataGaps: [],
        };
      }
      if (p.endsWith("/reports/work"))
        return {
          shifts:
            url.searchParams.get("month") === date.slice(0, 7)
              ? workers
                  .filter(
                    (w) =>
                      !url.searchParams.get("userId") ||
                      url.searchParams.get("userId") === w.userId,
                  )
                  .map((w) => ({
                    ...w,
                    id: w.userId,
                    workDate: date,
                    expectedWage: 230000,
                  }))
              : [],
          dataGaps: [],
        };
      if (p === "/incidents/0420") return { incident };
      throw new Error("이 항목은 서버 화면에서 확인할 수 있어요.");
    },
    upload: async () => {
      throw new Error("모의 화면에서는 사진을 저장하지 않아요.");
    },
  };
  return { api, site, user };
}
