import axios from 'axios'

// Call same-origin paths (e.g. `/api/...`) and let Next.js rewrites proxy to the backend.
// This avoids browser CORS issues on Railway.
const API_BASE_URL = ''

// Create axios instance with default config
// Conditionally include the beta key header only when a build-time env var is provided.
// Avoid hardcoding a placeholder key which will always fail server-side checks.
const DEFAULT_HEADERS: Record<string, string> = {}
const PUBLIC_BETA_KEY = process.env.NEXT_PUBLIC_BETA_KEY
if (PUBLIC_BETA_KEY) {
  DEFAULT_HEADERS['X-Beta-Key'] = PUBLIC_BETA_KEY
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes: React (npm install + Vite + screenshots) can take several minutes on first run
  headers: DEFAULT_HEADERS,
})

// Add request/response interceptors for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      data: config.data
    })
    return config
  },
  (error) => {
    console.error('[API Request Error]', error)
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status} from ${response.config.url}`, response.data)
    return response
  },
  (error) => {
    const errorMsg = error.response?.data?.detail || error.message || 'Unknown error'
    console.error(`[API Error] ${error.config?.url}:`, {
      status: error.response?.status,
      detail: errorMsg,
      fullError: error
    })
    return Promise.reject(error)
  }
)

// Types
export interface UploadResponse {
  id: number
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  uploaded_at: string
}

export interface Task {
  id: number
  question_text: string
  code_snippet: string
  requires_screenshot: boolean
  ai_answer: string
}

export interface ParseResponse {
  tasks: Task[]
}

export interface JobStatus {
  id: number
  task_id: number
  question_text: string
  status: string
  output_text?: string
  error_message?: string
  execution_time?: number
  screenshot_url?: string
  screenshot_urls?: string[]
  files?: ExecutionFile[]
  code_snippet?: string
}

export interface RunResponse {
  jobs: JobStatus[]
}

export interface ComposeResponse {
  report_id: number
  filename: string
  download_url: string
}

export type ThemeOption =
  | 'idle'
  | 'notepad'
  | 'codeblocks'
  | 'html'
  | 'react'
  | 'node'

export interface RunRequest {
  upload_id: number
  task_ids: number[]
  theme: ThemeOption
  screenshot_task_ids?: number[]
}

export interface ComposeRequest {
  upload_id: number
  screenshot_order?: number[]
}

// AI Analysis types
export interface AITaskCandidate {
  task_id: string
  question_context: string
  task_type: string // screenshot_request, answer_request, code_execution, react_project
  suggested_code?: string | Record<string, string>
  extracted_code?: string
  confidence: number
  suggested_insertion: string
  brief_description: string
  follow_up?: string
  project_files?: Record<string, string> // For React projects
  routes?: string[] // For React projects
  project_type?: string
  project_confidence?: number
  project_indicators?: string[]
}

export interface AnalyzeResponse {
  candidates: AITaskCandidate[]
}

export interface TaskSubmission {
  task_id: string
  selected: boolean
  user_code?: string
  follow_up_answer?: string
  insertion_preference: string
  task_type?: string // For react_project
  question_context?: string
  project_files?: Record<string, string> // For React projects
  routes?: string[] // For React projects
  project_type?: string
  project_config?: Record<string, any>
}

export interface TasksSubmitRequest {
  file_id: number
  tasks: TaskSubmission[]
  theme: string
  insertion_preference: string
}

export interface TasksSubmitResponse {
  job_id: number
  status: string
}

export interface TaskResult {
  id: number
  task_id: string
  task_type: string
  status: string
  screenshot_url?: string
  stdout?: string
  exit_code?: number
  caption?: string
  assistant_answer?: string
}

export interface JobStatusResponse {
  job_id: number
  status: string
  tasks: TaskResult[]
}

export interface ExecutionFile {
  filename: string
  content: string
  type: 'input' | 'generated'
  screenshot_url?: string
}

export interface BasicAuthUser {
  id: number
  email: string
  name: string
  profile_picture?: string
  created_at: string
  last_login: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: BasicAuthUser
  csrf_token: string
}

export interface CodeIssue {
  title: string
  severity: string
  detail: string
  suggestion: string
}

export interface CodeReviewResponse {
  review_id: string
  variant_of?: string | null
  regenerated: boolean
  original_filename: string
  problem_statement: string
  summary: string
  issues: CodeIssue[]
  validation_notices: CodeIssue[]
  improved_code: string
  personalized_code: string
  original_code: string
  model_source: string
  variant_label?: string | null
  user_profile: Record<string, any>
}

export interface CodeVariantRequest {
  original_code: string
  problem_statement?: string
  review_id?: string
}

// API functions
export const apiService = {
  // Upload file
  async uploadFile(file: File, userId?: number): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (userId) {
      formData.append('user_id', String(userId))
    }
    
    const response = await api.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    return response.data
  },

  // Parse uploaded file
  async parseFile(fileId: number): Promise<ParseResponse> {
    const response = await api.get(`/api/parse/${fileId}`)
    return response.data
  },

  // Run code execution
  async runTasks(request: RunRequest): Promise<RunResponse> {
    const response = await api.post('/api/run', request)
    return response.data
  },

  // Compose final report
  async composeReport(request: ComposeRequest): Promise<ComposeResponse> {
    const response = await api.post('/api/compose', request)
    return response.data
  },

  // Download report
  async downloadReport(docId: number): Promise<Blob> {
    const response = await api.get(`/api/download/${docId}`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await api.get('/health')
    return response.data
  },

  // AI Analysis
  async analyzeDocument(fileId: number, language?: string): Promise<AnalyzeResponse> {
    const response = await api.post('/api/analyze', { file_id: fileId, language })
    return response.data
  },

  // Submit AI tasks
  async submitTasks(request: TasksSubmitRequest): Promise<TasksSubmitResponse> {
    const response = await api.post('/api/tasks/submit', request)
    return response.data
  },

  // Get job status
  async getJobStatus(jobId: number): Promise<JobStatusResponse> {
    const response = await api.get(`/api/tasks/${jobId}`)
    return response.data
  },

  // Get user assignments
  async getUserAssignments(userId: number): Promise<any[]> {
    const response = await api.get(`/api/assignments/?user_id=${userId}`)
    return response.data
  },

  // Set custom filename for uploaded file
  async setFilename(uploadId: number, filename: string): Promise<{ message: string; filename: string }> {
    // Append the correct extension if missing, based on current selection heuristics in UI
    const response = await api.post('/api/set-filename', {
      upload_id: uploadId,
      filename
    })
    return response.data
  },

  // Basic authentication methods
  async signup(email: string, name: string, password: string): Promise<TokenResponse> {
    const response = await api.post('/api/basic-auth/signup', {
      email,
      name,
      password
    })
    return response.data
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const response = await api.post('/api/basic-auth/login', {
      email,
      password
    })
    return response.data
  },

  async getCurrentUser(userId: number): Promise<any> {
    const response = await api.get(`/api/basic-auth/me?user_id=${userId}`)
    return response.data
  },

  async reviewPythonAssignment(file: File, problemStatement?: string): Promise<CodeReviewResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (problemStatement) {
      formData.append('problem_statement', problemStatement)
    }
    const response = await api.post('/api/ai-review/review', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async requestCodeVariant(payload: CodeVariantRequest): Promise<CodeReviewResponse> {
    const response = await api.post('/api/ai-review/variant', payload)
    return response.data
  },

  async updateUserProfile(profileData: {
    name?: string
    institution?: string
    course?: string
    profile_metadata?: Record<string, any>
  }): Promise<any> {
    const response = await api.post('/api/basic-auth/profile', profileData)
    return response.data
  },

  async getUserProfile(): Promise<any> {
    const response = await api.get('/api/basic-auth/profile')
    return response.data
  },

  // Get DOCX preview as HTML
  async getDocxPreview(uploadId: number): Promise<string> {
    const response = await api.get(`/api/upload/preview/${uploadId}`, {
      responseType: 'text',
    })
    return response.data
  },
}

export default api

