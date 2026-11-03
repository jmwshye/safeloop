export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeBaseUrl(value) {
  if (!value?.trim())
    throw new Error("VITE_API_BASE_URL에 NestJS 서버 주소를 설정해 주세요.");
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("올바른 HTTP 또는 HTTPS API 주소가 필요해요.");
  if (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("외부 서버에는 HTTPS 주소를 사용해 주세요.");
  return url.href.replace(/\/$/, "");
}

export const sessionKey = "safeloop-nest-session-v1";
export function readSession(storage, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(sessionKey));
    if (
      typeof value?.accessToken === "string" &&
      value.user?.id &&
      Date.parse(value.expiresAt) > now
    )
      return value;
  } catch {
    /* Invalid or unavailable browser storage is not an authenticated session. */
  }
  try {
    storage.removeItem(sessionKey);
  } catch {
    /* memory-only login still works */
  }
  return null;
}

export function createApi({
  baseUrl,
  getSession = () => null,
  onUnauthorized = () => {},
  fetchImpl = fetch,
}) {
  const base = normalizeBaseUrl(baseUrl);
  async function request(
    path,
    {
      method = "GET",
      body,
      signal,
      auth = true,
      response = "json",
      timeoutMs,
    } = {},
  ) {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
      throw new Error("API 상대 경로가 필요해요.");
    const headers = new Headers({
      Accept: response === "blob" ? "*/*" : "application/json",
    });
    const session = getSession();
    if (auth) {
      if (
        !session?.accessToken ||
        !(Date.parse(session.expiresAt) > Date.now())
      ) {
        onUnauthorized();
        throw new ApiError(
          401,
          "로그인이 만료됐어요. 다시 로그인해 주세요.",
          "UNAUTHORIZED",
        );
      }
      headers.set("Authorization", "Bearer " + session.accessToken);
    }
    const multipart =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !multipart)
      headers.set("Content-Type", "application/json");
    let result;
    const deadline = AbortSignal.timeout(
      timeoutMs ?? (response === "blob" ? 60000 : 15000),
    );
    const requestSignal = signal
      ? AbortSignal.any([signal, deadline])
      : deadline;
    function ensureContext() {
      if (requestSignal.aborted) throw requestSignal.reason;
      if (auth && getSession()?.accessToken !== session?.accessToken)
        throw new ApiError(
          0,
          "로그인 정보가 변경되어 이전 요청을 취소했어요.",
          "SESSION_CHANGED",
        );
    }
    try {
      result = await fetchImpl(base + path, {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : multipart
              ? body
              : JSON.stringify(body),
        signal: requestSignal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
      if (!result.ok) {
        const payload = await result.json().catch(() => ({}));
        if (
          result.status === 401 &&
          auth &&
          getSession()?.accessToken === session?.accessToken
        )
          onUnauthorized();
        const defaults = {
          401: auth
            ? "로그인이 만료됐어요. 다시 로그인해 주세요."
            : "이메일과 비밀번호를 확인해 주세요.",
          403: "이 작업을 할 권한이 없어요.",
          404: "기록이 없거나 열람 권한이 없어요.",
          409: "상태가 변경됐어요. 새로고침 후 확인해 주세요.",
          429: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        };
        throw new ApiError(
          result.status,
          payload.error?.message ||
            defaults[result.status] ||
            "요청을 처리하지 못했어요.",
          payload.error?.code,
        );
      }
      if (result.status === 204) {
        ensureContext();
        return null;
      }
      if (response === "blob") {
        const blob = await result.blob();
        ensureContext();
        return {
          blob,
          filename: filenameFrom(result.headers.get("Content-Disposition")),
        };
      }
      const data = await result.json();
      ensureContext();
      return data;
    } catch (error) {
      if (
        error instanceof ApiError ||
        signal?.aborted ||
        (error.name === "AbortError" && !deadline.aborted)
      )
        throw error;
      throw new ApiError(
        0,
        method === "GET"
          ? deadline.aborted
            ? "서버 응답 시간이 초과됐어요. 다시 조회해 주세요."
            : "서버에 연결할 수 없어요. 주소와 네트워크를 확인해 주세요."
          : "서버 응답을 받지 못했어요. 저장 여부를 먼저 새로고침으로 확인해 주세요.",
        deadline.aborted ? "TIMEOUT" : "NETWORK_ERROR",
      );
    }
  }
  return {
    request,
    login: (email, password, signal) =>
      request("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
        signal,
      }),
    signup: (name, email, password, signal) =>
      request("/auth/signup", {
        method: "POST",
        body: { name, email, password },
        auth: false,
        signal,
      }),
    upload: (siteId, purpose, file, signal) => {
      if (
        !file ||
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error("JPG·PNG·WebP 사진을 5 MiB 이하로 선택해 주세요.");
      const body = new FormData();
      body.set("purpose", purpose);
      body.set("file", file);
      return request(sitePath(siteId, "/photos"), {
        method: "POST",
        body,
        signal,
      });
    },
  };
}

export function sitePath(id, suffix = "") {
  return "/sites/" + encodeURIComponent(id) + suffix;
}

export function siteSettingsBody(form) {
  const value = (name) => String(form.get(name) ?? "").trim();
  const latitude = value("latitude");
  const longitude = value("longitude");
  const center =
    latitude || longitude
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;
  if (
    center &&
    (!latitude ||
      !longitude ||
      !Number.isFinite(center.latitude) ||
      Math.abs(center.latitude) > 90 ||
      !Number.isFinite(center.longitude) ||
      Math.abs(center.longitude) > 180)
  ) {
    throw new Error("현장 위도(-90~90)와 경도(-180~180)를 함께 입력해 주세요.");
  }
  return {
    name: value("name"),
    foremanPhone: value("phone") || null,
    center,
    breakReturnTime: value("breakReturnTime") || null,
    shiftChangeTime: value("shiftChangeTime") || null,
  };
}

// One form submission may need to retry after the server already saved it.
export function createSiteSubmission() {
  let previous;
  return (fields) => {
    const key = JSON.stringify(fields);
    if (key !== previous?.key)
      previous = { key, body: { ...fields, requestId: crypto.randomUUID() } };
    return previous.body;
  };
}

export function createPhotoSubmission() {
  let last;
  return async (target, source, upload) => {
    if (!source) return undefined;
    if (last?.target === target && last.source === source) return last.id;
    const { photo } = await upload();
    last = { target, source, id: photo.id };
    return photo.id;
  };
}
export function query(values) {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return entries.length ? "?" + new URLSearchParams(entries) : "";
}
export function workReportPath(
  siteId,
  { month, from, to, target = "all", format = "json" },
) {
  return (
    sitePath(siteId, "/reports/work") +
    query({
      ...(from || to ? { from, to } : { month }),
      ...(target === "all" ? { scope: "all" } : { userId: target }),
      format,
    })
  );
}
export function filenameFrom(header) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename="?([^";]+)/i)?.[1];
  let name = "safeloop-report";
  try {
    name = encoded ? decodeURIComponent(encoded) : plain || name;
  } catch {
    /* use safe default */
  }
  return name.replace(/[\\/\r\n]/g, "_");
}

export function downloadFile({ blob, filename }, fallback) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename === "safeloop-report" ? fallback : filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
