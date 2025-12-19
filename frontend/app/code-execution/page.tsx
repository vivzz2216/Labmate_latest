'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, UploadCloud, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import FileUpload from '@/components/dashboard/FileUpload'
import TaskList from '@/components/dashboard/TaskList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiService, type Task, type UploadResponse, type JobStatus, type ThemeOption } from '@/lib/api'
import { useAuth } from '@/contexts/BasicAuthContext'

const THEME_EXTENSION_MAP: Record<ThemeOption, string> = {
  html: '.html',
  react: '.jsx',
  node: '.js',
  idle: '.py',
  notepad: '.java',
  codeblocks: '.c',
}

const LANGUAGE_TO_THEME_MAP: Record<string, ThemeOption> = {
  'html': 'html',
  'react': 'react',
  'node': 'node',
}

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, '')
const toSnakeCase = (value: string) =>
  value
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()

export default function CodeExecutionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [upload, setUpload] = useState<UploadResponse | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [filenameInput, setFilenameInput] = useState('')
  const [savingFilename, setSavingFilename] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('react')
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const autoSaveFilename = async (theme: ThemeOption, uploaded?: UploadResponse) => {
    const targetUpload = uploaded || upload
    if (!targetUpload) return
    const base = toSnakeCase(stripExtension(targetUpload.original_filename) || 'lab_assignment')
    const finalName = `${base}_${theme}${THEME_EXTENSION_MAP[theme] || ''}`
    setFilenameInput(base)
    setSavingFilename(true)
    try {
      await apiService.setFilename(targetUpload.id, finalName)
      setStatus(`Auto-named file as ${finalName}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set filename automatically.')
    } finally {
      setSavingFilename(false)
    }
  }

  const applyTheme = async (theme: ThemeOption, uploaded?: UploadResponse) => {
    setSelectedTheme(theme)
    await autoSaveFilename(theme, uploaded)
    setStatus(`Environment auto-selected: ${theme.toUpperCase()}`)
  }

  const handleUploadComplete = async (uploaded: UploadResponse) => {
    setUpload(uploaded)
    setError(null)
    setStatus('File uploaded. Parsing your questions...')
    setFilenameInput(toSnakeCase(stripExtension(uploaded.original_filename)))
    setDocxHtml(null) // Reset preview for new upload
    await fetchTasks(uploaded.id, uploaded)
  }

  const fetchTasks = async (fileId: number, uploaded?: UploadResponse) => {
    setLoadingTasks(true)
    setError(null)
    try {
      const response = await apiService.parseFile(fileId)
      setTasks(response.tasks || [])
      
      // Refresh upload to get updated language after parsing
      // The parse endpoint sets upload.language based on detected code
      // We'll check tasks for language hints if upload.language isn't set yet
      const currentUpload = uploaded || upload
      if (currentUpload) {
        // Check if any task has code snippets that suggest a language
        const codeSnippets = response.tasks
          .filter(t => t.code_snippet)
          .map(t => t.code_snippet)
        
        let detectedLanguage: string | null = null
        
        // Detect language from code snippets
        for (const code of codeSnippets) {
          const codeLower = code.toLowerCase()

          // Node.js detection (check first: Node labs often embed HTML strings)
          if (
            codeLower.includes('require(') ||
            codeLower.includes('module.exports') ||
            codeLower.includes('exports.') ||
            codeLower.includes('express()') ||
            codeLower.includes('app.listen') ||
            codeLower.includes('app.get(') ||
            codeLower.includes('app.post(') ||
            codeLower.includes('app.use(') ||
            codeLower.includes("from 'express'") ||
            codeLower.includes('from "express"') ||
            codeLower.includes('import express') ||
            codeLower.includes('http.createserver') ||
            codeLower.includes('https.createserver') ||
            codeLower.includes('createserver(') ||
            codeLower.includes('process.env') ||
            codeLower.includes('__dirname')
          ) {
            detectedLanguage = 'node'
            break
          }

          // React detection
          if (
            codeLower.includes('import react') ||
            codeLower.includes('reactdom') ||
            codeLower.includes('createroot') ||
            codeLower.includes('jsx') ||
            codeLower.includes('usestate') ||
            codeLower.includes('useeffect') ||
            codeLower.includes("from 'react'") ||
            codeLower.includes('from "react"') ||
            codeLower.includes('react-router') ||
            codeLower.includes('browserrouter') ||
            codeLower.includes('classname=')
          ) {
            detectedLanguage = 'react'
            break
          }

          // HTML detection (be conservative)
          if (
            codeLower.includes('<!doctype') ||
            codeLower.includes('<html') ||
            codeLower.includes('<head') ||
            codeLower.includes('<body')
          ) {
            detectedLanguage = 'html'
            break
          }
        }
        
        // Auto-select theme based on detected language (web-only)
        const fallbackTheme: ThemeOption = 'react'
        const detectedTheme: ThemeOption = detectedLanguage
          ? (LANGUAGE_TO_THEME_MAP[detectedLanguage] || fallbackTheme)
          : fallbackTheme
        await applyTheme(detectedTheme, currentUpload)
        setStatus(`Tasks detected. Auto-selected ${detectedTheme} theme.`)
      } else {
        await applyTheme('react', uploaded)
        setStatus('Tasks detected. Auto-selected react theme.')
      }
    } catch (err) {
      setTasks([])
      setError(err instanceof Error ? err.message : 'Failed to parse assignment. Try again.')
    } finally {
      setLoadingTasks(false)
    }
  }

  const handleUploadError = (message: string) => {
    setError(message)
  }

  const handleTaskError = (message: string) => {
    setError(message)
  }

  const handleExecutionComplete = (jobs: JobStatus[]) => {
    setStatus('Execution finished. Preview screenshots or regenerate if needed.')
  }

  const handlePreview = (jobs: JobStatus[]) => {
    if (!jobs || jobs.length === 0) {
      setError('Run at least one task before previewing.')
      return
    }
    const params = new URLSearchParams()
    params.set('jobResults', JSON.stringify(jobs))
    if (upload?.id) {
      params.set('uploadId', String(upload.id))
    }
    router.push(`/preview?${params.toString()}`)
  }

  // Fetch DOCX preview HTML when upload is available
  useEffect(() => {
    const fetchPreview = async () => {
      if (upload && upload.file_type === 'docx' && !docxHtml && !loadingPreview) {
        setLoadingPreview(true)
        try {
          const html = await apiService.getDocxPreview(upload.id)
          setDocxHtml(html)
        } catch (err) {
          console.error('Failed to load DOCX preview:', err)
          setError('Failed to load document preview. Please try again.')
        } finally {
          setLoadingPreview(false)
        }
      }
    }
    fetchPreview()
  }, [upload, docxHtml, loadingPreview])

  return (
    <div className="min-h-screen bg-[#eef1ff] text-slate-900">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-sm text-slate-500 font-medium">Lab Assignment Flow</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h1 className="text-3xl font-bold text-slate-900">
            Code Execution Workspace
          </h1>
          <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
            Upload your lab manual, configure the execution environment, and generate professional code screenshots with outputs.
          </p>
        </motion.div>

        {status && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-800">{status}</p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </motion.div>
        )}

        <Card className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <CardTitle className="text-slate-900 text-xl font-semibold">Step 1: Upload Lab Manual</CardTitle>
                <CardDescription className="text-slate-600 text-sm mt-1">
                  Upload your DOCX or PDF file to extract programming questions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <FileUpload onUploadComplete={handleUploadComplete} onError={handleUploadError} />
          </CardContent>
        </Card>

        {upload && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-6">
                <CardTitle className="text-slate-900 text-xl font-semibold">Step 2: Auto Environment</CardTitle>
                <CardDescription className="text-slate-600 text-sm mt-1">
                  Automatically detected environment and filename. No input required.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="pt-2">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border-2 border-[#5f3bff] bg-[#5f3bff]/10 p-4">
                      <p className="font-semibold text-sm text-[#5f3bff]">Environment</p>
                      <p className="text-xs text-slate-700 mt-1">Auto-selected: {selectedTheme.toUpperCase()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-sm text-slate-900">Output Filename</p>
                      <p className="text-xs text-slate-700 mt-1 break-all">
                        {filenameInput || 'auto_name'}{THEME_EXTENSION_MAP[selectedTheme]}
                      </p>
                      {savingFilename && <p className="text-[11px] text-slate-500 mt-1">Saving...</p>}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-sm text-slate-900">Mode</p>
                      <p className="text-xs text-slate-700 mt-1">Auto template & execution (no user config)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {loadingTasks && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#5f3bff] border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 font-medium">Parsing your document and extracting questions...</p>
            </div>
          </motion.div>
        )}

        {tasks.length > 0 && upload && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-6"
          >
            {/* Left Column: Task Selection */}
            <div className="space-y-4">
              <TaskList
                tasks={tasks}
                uploadId={upload.id}
                onExecutionComplete={handleExecutionComplete}
                onError={handleTaskError}
                onPreview={handlePreview}
                initialTheme={selectedTheme}
                onThemeChange={() => {}}
                showThemeSelector={false}
              />
            </div>

            {/* Right Column: Lab Manual Viewer */}
            <div className="lg:sticky lg:top-6 h-fit">
              <Card className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-slate-900 text-base font-semibold truncate">
                        {upload.original_filename}
                      </CardTitle>
                      <CardDescription className="text-slate-600 text-xs mt-0.5">
                        Lab Manual Reference
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[calc(100vh-280px)] min-h-[600px] bg-white overflow-hidden">
                    {upload.file_type === 'pdf' ? (
                      <iframe
                        src={`/uploads/${upload.filename}`}
                        className="w-full h-full border-0"
                        title="Lab Manual PDF Viewer"
                      />
                    ) : loadingPreview ? (
                      <div className="h-full flex flex-col items-center justify-center p-8">
                        <div className="w-12 h-12 border-4 border-[#5f3bff] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-slate-600 font-medium">Loading document preview...</p>
                      </div>
                    ) : docxHtml ? (
                      <div 
                        className="h-full overflow-y-auto p-6 prose prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                          <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-slate-900 font-semibold mb-2">Preview Unavailable</h3>
                        <p className="text-sm text-slate-600 mb-4 max-w-sm">
                          Unable to load document preview. Please try refreshing the page.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}

