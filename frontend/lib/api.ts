import axios from "axios";

// Call same-origin paths (e.g. `/api/...`) and let Next.js rewrites proxy to the backend.
// This avoids browser CORS issues on Railway.
const API_BASE_URL = "";

// Create axios instance with default config
// Conditionally include the beta key header only when a build-time env var is provided.
// Avoid hardcoding a placeholder key which will always fail server-side checks.
const DEFAULT_HEADERS: Record<string, string> = {};
const PUBLIC_BETA_KEY = process.env.NEXT_PUBLIC_BETA_KEY;
if (PUBLIC_BETA_KEY) {
  DEFAULT_HEADERS["X-Beta-Key"] = PUBLIC_BETA_KEY;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes: React (npm install + Vite + screenshots) can take several minutes on first run
  headers: DEFAULT_HEADERS,
});

// Ensure latest stored tokens are attached before every request
api.interceptors.request.use((config) => {
  // Metadata/session checks fail promptly; large report downloads keep their longer budget.
  const download = config.responseType === 'blob' || config.responseType === 'arraybuffer';
  if ((config.method?.toLowerCase() === 'get' && !download) || config.url?.includes('/basic-auth/')) {
    config.timeout = 15000;
  }
  if (typeof window !== "undefined") {
    if (!('_labmateUser' in config)) (config as any)._labmateUser = profileStorageKey();
    const accessToken = localStorage.getItem("labmate_access_token");
    const csrfToken = localStorage.getItem("labmate_csrf_token");
    if (accessToken) {
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    } else config.headers.delete('Authorization');
    if (csrfToken) {
      config.headers.set("X-CSRF-Token", csrfToken);
    } else config.headers.delete('X-CSRF-Token');
  }
  return config;
});

// Automatically refresh access & CSRF tokens on 401 Unauthorized or 403 Invalid/Missing CSRF token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, tokens: { accessToken: string; csrfToken?: string } | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(tokens);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const detail = String(error.response?.data?.detail || "");
    const isCsrfError =
      status === 403 && detail.toLowerCase().includes("csrf token");

    if (
      (status === 401 || isCsrfError) &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/basic-auth/login") &&
      !originalRequest.url?.includes("/basic-auth/refresh")
    ) {
      originalRequest._retry = true;
      if (typeof window !== 'undefined') {
        if (originalRequest._labmateUser !== profileStorageKey()) return Promise.reject(new axios.CanceledError('Session changed.'));
        const latestAccess = localStorage.getItem('labmate_access_token');
        const latestCsrf = localStorage.getItem('labmate_csrf_token');
        if (latestAccess && (originalRequest.headers?.Authorization !== `Bearer ${latestAccess}` ||
            (isCsrfError && latestCsrf && originalRequest.headers?.['X-CSRF-Token'] !== latestCsrf))) {
          return api(originalRequest);
        }
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((tokens: any) => {
            if (tokens?.accessToken) {
              originalRequest.headers["Authorization"] = `Bearer ${tokens.accessToken}`;
            }
            if (tokens?.csrfToken) {
              originalRequest.headers["X-CSRF-Token"] = tokens.csrfToken;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("labmate_refresh_token")
          : null;

      if (refreshToken) {
        const refreshUser = profileStorageKey();
        const rotateSession = async () => {
        try {
          const currentRefresh = localStorage.getItem('labmate_refresh_token');
          let res: { data: any };
          if (currentRefresh !== refreshToken) {
            if (!refreshUser || profileStorageKey() !== refreshUser || !currentRefresh || !localStorage.getItem('labmate_access_token') || !localStorage.getItem('labmate_csrf_token')) {
              throw new axios.CanceledError('Session changed while waiting to refresh.');
            }
            // Another tab already rotated this session while we waited for the lock.
            res = {data: {access_token: localStorage.getItem('labmate_access_token'), refresh_token: currentRefresh, csrf_token: localStorage.getItem('labmate_csrf_token')}};
          } else {
            res = await axios.post("/api/basic-auth/refresh", { refresh_token: currentRefresh }, { timeout: 15000 });
          }
          if (localStorage.getItem("labmate_refresh_token") !== currentRefresh || profileStorageKey() !== refreshUser) {
            throw new axios.CanceledError('Session changed while refreshing.');
          }
          const newAccessToken = res.data.access_token;
          const newRefreshToken = res.data.refresh_token;
          const newCsrfToken = res.data.csrf_token;
          if (!newAccessToken || !newCsrfToken) {
            throw new Error('Session refresh returned incomplete credentials. Please retry.');
          }
          if (newAccessToken) {
            localStorage.setItem("labmate_access_token", newAccessToken);
            api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;
            originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
          }
          if (newRefreshToken) {
            localStorage.setItem("labmate_refresh_token", newRefreshToken);
          }
          if (newCsrfToken) {
            localStorage.setItem("labmate_csrf_token", newCsrfToken);
            api.defaults.headers.common["X-CSRF-Token"] = newCsrfToken;
            originalRequest.headers["X-CSRF-Token"] = newCsrfToken;
          }
          if (res.data?.user && typeof window !== "undefined") {
            try {
              const prevRaw = localStorage.getItem("labmate_user");
              const prev = prevRaw ? JSON.parse(prevRaw) : {};
              localStorage.setItem(
                "labmate_user",
                JSON.stringify({
                  ...prev,
                  ...res.data.user,
                  is_admin: res.data.user.is_admin === true,
                }),
              );
            } catch {
              // ignore storage errors
            }
          }
          if (newAccessToken) {
            processQueue(null, { accessToken: newAccessToken, csrfToken: newCsrfToken });
            return api(originalRequest);
          }
        } catch (refreshErr) {
          const refreshStatus = axios.isAxiosError(refreshErr) ? refreshErr.response?.status : undefined;
          if (typeof window !== "undefined" && localStorage.getItem("labmate_refresh_token") === refreshToken && (refreshStatus === 401 || refreshStatus === 403)) {
            localStorage.removeItem("labmate_access_token");
            localStorage.removeItem("labmate_refresh_token");
            localStorage.removeItem("labmate_csrf_token");
          }
          processQueue(refreshErr, null);
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
        };
        if (typeof navigator !== 'undefined' && navigator.locks) {
          return navigator.locks.request('labmate-session-refresh', rotateSession).catch(refreshError => {
            if (isRefreshing) { isRefreshing = false; processQueue(refreshError, null); }
            throw refreshError;
          });
        }
        return rotateSession();
      } else {
        processQueue(error, null);
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface UploadResponse {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface Task {
  id: number;
  question_text: string;
  code_snippet: string;
  requires_screenshot: boolean;
  ai_answer: string;
}

export interface ParseResponse {
  tasks: Task[];
}

export interface JobStatus {
  id: number;
  task_id: number;
  question_text: string;
  status: string;
  output_text?: string;
  error_message?: string;
  execution_time?: number;
  screenshot_url?: string;
  screenshot_urls?: string[];
  files?: ExecutionFile[];
  code_snippet?: string;
}

export interface RunResponse {
  jobs: JobStatus[];
}

export interface ComposeResponse {
  report_id: number;
  filename: string;
  download_url: string;
}

export type ThemeOption =
  | "sql"
  | "colab"
  | "ubuntu"
  | "idle"
  | "notepad"
  | "codeblocks"
  | "html"
  | "react"
  | "node";

export interface RunRequest {
  upload_id: number;
  task_ids: number[];
  theme: ThemeOption;
  screenshot_task_ids?: number[];
}

export interface ComposeRequest {
  upload_id: number;
  screenshot_order?: number[];
}

// AI Analysis types
export interface AITaskCandidate {
  task_id: string;
  question_context: string;
  task_type: string; // screenshot_request, answer_request, code_execution, react_project
  suggested_code?: string | Record<string, string>;
  extracted_code?: string;
  confidence: number;
  suggested_insertion: string;
  brief_description: string;
  follow_up?: string;
  project_files?: Record<string, string>; // For React projects
  routes?: string[]; // For React projects
  project_type?: string;
  project_confidence?: number;
  project_indicators?: string[];
}

export interface AnalyzeResponse {
  candidates: AITaskCandidate[];
}

export interface TaskSubmission {
  task_id: string;
  selected: boolean;
  user_code?: string;
  follow_up_answer?: string;
  insertion_preference: string;
  task_type?: string; // For react_project
  question_context?: string;
  project_files?: Record<string, string>; // For React projects
  routes?: string[]; // For React projects
  project_type?: string;
  project_config?: Record<string, any>;
}

export interface TasksSubmitRequest {
  file_id: number;
  tasks: TaskSubmission[];
  theme: string;
  insertion_preference: string;
}

export interface TasksSubmitResponse {
  job_id: number;
  status: string;
}

export interface TaskResult {
  id: number;
  task_id: string;
  task_type: string;
  status: string;
  screenshot_url?: string;
  stdout?: string;
  exit_code?: number;
  caption?: string;
  assistant_answer?: string;
}

export interface JobStatusResponse {
  job_id: number;
  status: string;
  tasks: TaskResult[];
}

export interface ExecutionFile {
  filename: string;
  content: string;
  type: "input" | "generated";
  screenshot_url?: string;
}

export interface BasicAuthUser {
  is_admin?: boolean;
  id: number;
  email: string;
  name: string;
  profile_picture?: string;
  created_at: string;
  last_login: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: BasicAuthUser;
  csrf_token: string;
}

export interface CodeIssue {
  title: string;
  severity: string;
  detail: string;
  suggestion: string;
}

export interface CodeReviewResponse {
  review_id: string;
  variant_of?: string | null;
  regenerated: boolean;
  original_filename: string;
  problem_statement: string;
  summary: string;
  issues: CodeIssue[];
  validation_notices: CodeIssue[];
  improved_code: string;
  personalized_code: string;
  original_code: string;
  model_source: string;
  variant_label?: string | null;
  user_profile: Record<string, any>;
}

export interface CodeVariantRequest {
  original_code: string;
  problem_statement?: string;
  review_id?: string;
}

// Client-side SWR cache & in-flight deduplication for instant page transitions
const CACHE_TTL_MS = 20_000;
const assignmentsCache = new Map<number, { data: any[]; ts: number }>();
const assignmentsInflight = new Map<number, Promise<any[]>>();
const workspaceCache = new Map<number, { data: any; ts: number }>();
let profileCache: { data: any; ts: number } | null = null;
let profileInflight: Promise<any> | null = null;
let cacheEpoch = 0;
let profileEpoch = 0;

function profileStorageKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = JSON.parse(localStorage.getItem('labmate_user') || 'null')?.id;
    return Number.isSafeInteger(id) && id > 0 ? `labmate_profile_${id}` : null;
  } catch { return null; }
}

function normalizeAssignmentsList(raw: any): any[] {
  const list = Array.isArray(raw) ? raw : (raw?.assignments ?? raw?.data ?? []);
  return Array.isArray(list) ? list : [];
}

// API functions
export const apiService = {
  clearSessionCaches() {
    cacheEpoch++;
    profileEpoch++;
    assignmentsCache.clear();
    assignmentsInflight.clear();
    workspaceCache.clear();
    profileCache = null;
    profileInflight = null;
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).filter(key => key.startsWith('labmate_')).forEach(key => sessionStorage.removeItem(key));
      } catch { /* Storage can be disabled by the browser. */ }
    }
  },
  invalidateAssignmentsCache(userId?: number) {
    if (userId !== undefined) {
      assignmentsCache.delete(userId);
    } else {
      assignmentsCache.clear();
    }
    workspaceCache.clear();
  },

  invalidateProfileCache() {
    profileEpoch++;
    profileCache = null;
    profileInflight = null;
    if (typeof window !== 'undefined') {
      const key = profileStorageKey();
      try { if (key) sessionStorage.removeItem(key); } catch { /* optional cache */ }
    }
  },

  peekUserAssignments(userId?: number): any[] | null {
    if (!userId) return null;
    const hit = assignmentsCache.get(userId);
    if (hit) return hit.data;
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`labmate_assignments_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            assignmentsCache.set(userId, { data: parsed, ts: 0 });
            return parsed;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return null;
  },

  peekUserProfile(): any | null {
    if (profileCache) return profileCache.data;
    if (typeof window !== "undefined") {
      try {
        const key = profileStorageKey();
        const raw = key ? sessionStorage.getItem(key) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            profileCache = { data: parsed, ts: 0 };
            return parsed;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return null;
  },

  // Upload file
  async uploadFile(file: File, userId?: number): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (userId) {
      formData.append("user_id", String(userId));
    }

    const response = await api.post("/api/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    this.invalidateAssignmentsCache(userId);
    return response.data;
  },

  // Parse uploaded file
  async parseFile(fileId: number): Promise<ParseResponse> {
    const response = await api.get(`/api/parse/${fileId}`);
    return response.data;
  },

  // Run code execution
  async runTasks(request: RunRequest): Promise<RunResponse> {
    const response = await api.post("/api/run", request);
    this.invalidateAssignmentsCache();
    return response.data;
  },

  // Compose final report
  async composeReport(request: ComposeRequest): Promise<ComposeResponse> {
    const response = await api.post("/api/compose", request);
    this.invalidateAssignmentsCache();
    return response.data;
  },

  // Download report
  async downloadReport(docId: number): Promise<Blob> {
    try {
      const response = await api.get(`/api/download/${docId}`, {
        responseType: "blob",
      });
      return response.data;
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) {
            error.response.data = json;
          }
        } catch {
          // ignore parsing error
        }
      }
      throw error;
    }
  },

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await api.get("/health");
    return response.data;
  },

  // AI Analysis
  async analyzeDocument(
    fileId: number,
    language?: string,
  ): Promise<AnalyzeResponse> {
    const response = await api.post("/api/analyze", {
      file_id: fileId,
      language,
    });
    return response.data;
  },

  // Submit AI tasks
  async submitTasks(request: TasksSubmitRequest): Promise<TasksSubmitResponse> {
    const response = await api.post("/api/tasks/submit", request);
    this.invalidateAssignmentsCache();
    return response.data;
  },

  // Get job status
  async getJobStatus(jobId: number): Promise<JobStatusResponse> {
    const response = await api.get(`/api/tasks/${jobId}`);
    return response.data;
  },

  // Get user assignments (with in-flight deduplication and SWR cache)
  async getUserAssignments(userId: number, options?: { force?: boolean }): Promise<any[]> {
    const epoch = cacheEpoch;
    const now = Date.now();
    const cached = assignmentsCache.get(userId);
    if (!options?.force && cached && now - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }

    const existingPromise = assignmentsInflight.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchPromise = api
      .get(`/api/assignments/?user_id=${userId}`)
      .then((response) => {
        if (epoch !== cacheEpoch) throw new axios.CanceledError('Session changed.');
        const list = normalizeAssignmentsList(response.data);
        assignmentsCache.set(userId, { data: list, ts: Date.now() });
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`labmate_assignments_${userId}`, JSON.stringify(list));
          } catch {
            // ignore storage quota errors
          }
        }
        return list;
      })
      .finally(() => {
        if (assignmentsInflight.get(userId) === fetchPromise) assignmentsInflight.delete(userId);
      });

    assignmentsInflight.set(userId, fetchPromise);
    return fetchPromise;
  },

  // Get full assignment workspace details (questions, code, screenshots, report)
  async getAssignmentWorkspace(assignmentId: number, options?: { force?: boolean }): Promise<any> {
    const epoch = cacheEpoch;
    const now = Date.now();
    const cached = workspaceCache.get(assignmentId);
    if (!options?.force && cached && now - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
    const response = await api.get(`/api/assignments/${assignmentId}/workspace`);
    if (epoch !== cacheEpoch) throw new axios.CanceledError('Session changed.');
    workspaceCache.set(assignmentId, { data: response.data, ts: Date.now() });
    return response.data;
  },

  // Set custom filename for uploaded file
  async setFilename(
    uploadId: number,
    filename: string,
  ): Promise<{ message: string; filename: string }> {
    // Append the correct extension if missing, based on current selection heuristics in UI
    const response = await api.post("/api/set-filename", {
      upload_id: uploadId,
      filename,
    });
    this.invalidateAssignmentsCache();
    return response.data;
  },

  // Basic authentication methods
  async signup(
    email: string,
    name: string,
    password: string,
  ): Promise<TokenResponse> {
    const response = await api.post("/api/basic-auth/signup", {
      email,
      name,
      password,
    });
    return response.data;
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const response = await api.post("/api/basic-auth/login", {
      email,
      password,
    });
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await api.post("/api/basic-auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('labmate_refresh_token') : null;
    await api.post('/api/basic-auth/logout', { refresh_token: refreshToken });
  },

  async getCurrentUser(userId: number): Promise<any> {
    const response = await api.get(`/api/basic-auth/me?user_id=${userId}`);
    return response.data;
  },

  async reviewPythonAssignment(
    file: File,
    problemStatement?: string,
  ): Promise<CodeReviewResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (problemStatement) {
      formData.append("problem_statement", problemStatement);
    }
    const response = await api.post("/api/ai-review/review", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async requestCodeVariant(
    payload: CodeVariantRequest,
  ): Promise<CodeReviewResponse> {
    const response = await api.post("/api/ai-review/variant", payload);
    return response.data;
  },

  async updateUserProfile(profileData: {
    name?: string;
    institution?: string;
    course?: string;
    profile_metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await api.post("/api/basic-auth/profile", profileData);
    this.invalidateProfileCache();
    return response.data;
  },

  async getUserProfile(options?: { force?: boolean }): Promise<any> {
    const epoch = cacheEpoch;
    const revision = profileEpoch;
    const storageKey = profileStorageKey();
    const now = Date.now();
    if (!options?.force && profileCache && now - profileCache.ts < CACHE_TTL_MS) {
      return profileCache.data;
    }
    if (profileInflight) {
      return profileInflight;
    }
    profileInflight = api
      .get("/api/basic-auth/profile")
      .then((response) => {
        if (epoch !== cacheEpoch || revision !== profileEpoch || storageKey !== profileStorageKey()) throw new axios.CanceledError('Session changed.');
        profileCache = { data: response.data, ts: Date.now() };
        if (typeof window !== "undefined") {
          try {
            if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(response.data));
          } catch {
            // ignore storage errors
          }
        }
        return response.data;
      })
      .finally(() => {
        if (epoch === cacheEpoch && revision === profileEpoch) profileInflight = null;
      });
    return profileInflight;
  },

  // Get DOCX preview as HTML
  async getDocxPreview(uploadId: number): Promise<string> {
    const response = await api.get(`/api/upload/preview/${uploadId}`, {
      responseType: "text",
    });
    return response.data;
  },
};

export default api;
