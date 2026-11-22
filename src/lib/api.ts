/**
 * The single HTTP client for the dashboard.
 *
 * It owns three things the rest of the app never has to think about:
 *  - the access/refresh token pair, refreshed exactly once per expiry even when a dozen
 *    queries fail at the same moment (concurrent 401s queue behind one refresh);
 *  - the API's error envelope, unwrapped into a typed ApiError with per-field messages;
 *  - query-string building for the cursor/filter/sort conventions the API expects.
 */

const BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api/v1';
const ACCESS_KEY = 'sudamind.access';
const REFRESH_KEY = 'sudamind.refresh';

export interface ApiFieldError { code: string; message: string; field?: string }

export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: ApiFieldError[],
    public requestId?: string,
  ) {
    super(errors[0]?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
  /** Field -> message, for wiring server-side validation back into a form. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      this.errors.filter((e) => e.field).map((e) => [e.field!, e.message]),
    );
  }
}

/**
 * Where the session lives.
 *
 * "Stay signed in" writes to localStorage, so the session survives closing the browser.
 * Without it the pair goes to sessionStorage instead and dies with the tab — the right
 * default on a machine someone else also uses. A token refresh must not silently promote a
 * session between the two, so `set` keeps whichever store the session already lives in
 * unless it is told otherwise.
 */
function sessionStore(): Storage {
  return localStorage.getItem(REFRESH_KEY) ? localStorage : sessionStorage;
}

export const tokens = {
  get access() { return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY); },
  get refresh() { return sessionStorage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY); },
  /** `persist` is only passed at sign-in; a refresh omits it and stays where it was. */
  set(access: string, refresh: string, persist?: boolean) {
    const target = persist === undefined ? sessionStore() : (persist ? localStorage : sessionStorage);
    const other = target === localStorage ? sessionStorage : localStorage;
    other.removeItem(ACCESS_KEY);
    other.removeItem(REFRESH_KEY);
    target.setItem(ACCESS_KEY, access);
    target.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(ACCESS_KEY);
      store.removeItem(REFRESH_KEY);
    }
  },
};

const EMAIL_KEY = 'sudamind.login.email';
const REMEMBER_KEY = 'sudamind.login.remember';

/**
 * What the login screen fills in for you next time.
 *
 * The address only. A password belongs in the browser's password manager, which the form's
 * autocomplete attributes hand it to — storing one here would put it in plain text in a
 * place any script on the origin can read.
 */
export const savedLogin = {
  get remember() { return localStorage.getItem(REMEMBER_KEY) !== '0'; },
  get email() { return this.remember ? (localStorage.getItem(EMAIL_KEY) ?? '') : ''; },
  save(email: string, remember: boolean) {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember && email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  },
  forget() {
    localStorage.removeItem(EMAIL_KEY);
    localStorage.setItem(REMEMBER_KEY, '0');
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Notified when the session is definitively gone, so the app can route to /login. */
export function onUnauthorized(fn: Listener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      tokens.set(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Release the gate on the next tick so queued callers all see the same result.
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the Authorization header (login, refresh). */
  anonymous?: boolean;
  /** Set internally to stop an infinite refresh loop. */
  _retried?: boolean;
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, anonymous, _retried, headers, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(!anonymous && tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !anonymous && !_retried) {
    if (await refreshTokens()) {
      return request<T>(path, { ...options, _retried: true });
    }
    tokens.clear();
    unauthorizedListeners.forEach((fn) => fn());
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) {
    const errors: ApiFieldError[] = parsed?.errors ?? [
      { code: 'ERROR', message: parsed?.message ?? res.statusText ?? 'Request failed' },
    ];
    throw new ApiError(res.status, errors, parsed?.requestId ?? res.headers.get('X-Request-Id') ?? undefined);
  }
  return parsed as T;
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

/** Build `?limit=&cursor=&q=&sort=&filter[x]=` from a plain object. */
export function qs(params: Record<string, any> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'filter' && typeof value === 'object') {
      for (const [fk, fv] of Object.entries(value as Record<string, any>)) {
        if (fv === undefined || fv === null || fv === '') continue;
        search.append(`filter[${fk}]`, String(fv));
      }
    } else {
      search.append(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) => request<T>(`${path}${qs(params)}`),
  post: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...options }),
  patch: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};

export interface Page<T> { data: T[]; nextCursor: string | null; total?: number }

/** One PUT with progress. Used for a whole small file and for each part of a large one. */
function put(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded); };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve({ etag: (xhr.getResponseHeader('ETag') ?? '').replace(/"/g, '') })
        : reject(new ApiError(xhr.status, [{ code: 'UPLOAD_FAILED', message: 'Object storage rejected the upload.' }]));
    xhr.onerror = () =>
      reject(new ApiError(0, [{ code: 'NETWORK', message: 'Could not reach object storage.' }]));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export interface UploadOptions {
  contentId?: string;
  /** Playing time, read from the file before it is sent, for audio and video. */
  durationSeconds?: number;
  signal?: AbortSignal;
  /** How many parts of a large file are in flight at once. */
  concurrency?: number;
}

/**
 * Upload a file straight to object storage.
 *
 * Small files go up in a single signed PUT. Past the server's threshold the server hands
 * back one signed URL per part instead, and this uploads them a few at a time, retrying a
 * failed part on its own rather than restarting a multi-gigabyte transfer. Progress is
 * reported across the whole file either way.
 */
export async function uploadFile(
  file: File,
  surface: string,
  onProgress?: (percent: number) => void,
  options: UploadOptions | string = {},
): Promise<{ id: string; url?: string; [k: string]: any }> {
  // The fourth argument used to be a bare contentId; keep that call shape working.
  const opts: UploadOptions = typeof options === 'string' ? { contentId: options } : options;

  const signed = await api.post('/media/uploads', {
    surface,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    contentId: opts.contentId,
    durationSeconds: opts.durationSeconds,
  });

  if (signed.mode === 'multipart') {
    const partSize: number = signed.partSizeBytes;
    const sent = new Array<number>(signed.parts.length).fill(0);
    const report = () => {
      const loaded = sent.reduce((a, b) => a + b, 0);
      onProgress?.(Math.min(99, Math.round((loaded / file.size) * 100)));
    };

    const queue = [...signed.parts] as { partNumber: number; url: string }[];
    const done: { partNumber: number; etag: string }[] = [];

    const worker = async () => {
      for (;;) {
        const part = queue.shift();
        if (!part) return;
        const index = part.partNumber - 1;
        const chunk = file.slice(index * partSize, Math.min((index + 1) * partSize, file.size));
        // One retry: a single dropped part should not cost the whole upload.
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            sent[index] = 0;
            const { etag } = await put(part.url, chunk, {}, (loaded) => { sent[index] = loaded; report(); }, opts.signal);
            done.push({ partNumber: part.partNumber, etag });
            sent[index] = chunk.size;
            report();
            lastError = undefined;
            break;
          } catch (err) {
            lastError = err;
            if ((err as Error).name === 'AbortError') throw err;
          }
        }
        if (lastError) throw lastError;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(opts.concurrency ?? 3, queue.length) }, worker),
    );
    onProgress?.(100);
    return api.post(`/media/uploads/${signed.mediaId}/complete`, {
      parts: done,
      durationSeconds: opts.durationSeconds,
    });
  }

  await put(
    signed.uploadUrl,
    file,
    (signed.headers ?? {}) as Record<string, string>,
    (loaded) => onProgress?.(Math.round((loaded / file.size) * 100)),
    opts.signal,
  );
  onProgress?.(100);
  return api.post(`/media/uploads/${signed.mediaId}/complete`, {
    durationSeconds: opts.durationSeconds,
  });
}
