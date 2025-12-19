'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Clock, Code, Play, Eye } from 'lucide-react'
import { apiService, type Task, type JobStatus, type ThemeOption } from '@/lib/api'
import { themeOptions } from '@/components/dashboard/themeOptions'

interface TaskListProps {
  tasks: Task[]
  onExecutionComplete: (jobs: JobStatus[]) => void
  onError: (error: string) => void
  onPreview: (jobs: JobStatus[]) => void
  uploadId: number | null
  initialTheme?: ThemeOption
  onThemeChange?: (theme: ThemeOption) => void
  showThemeSelector?: boolean
}

export default function TaskList({
  tasks,
  onExecutionComplete,
  onError,
  onPreview,
  uploadId,
  initialTheme = 'idle',
  onThemeChange,
  showThemeSelector = true,
}: TaskListProps) {
  const [selectedTasks, setSelectedTasks] = useState<number[]>([])
  const [theme, setTheme] = useState<ThemeOption>(initialTheme)
  const [executing, setExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [jobResults, setJobResults] = useState<JobStatus[]>([])
  const [executionStage, setExecutionStage] = useState<'code' | 'screenshot'>('code')
  const [taskAnswers, setTaskAnswers] = useState<Record<number, string>>({})
  const [screenshotPrefs, setScreenshotPrefs] = useState<Record<number, boolean>>({})
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

  const handleTaskToggle = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleAnswerChange = (taskId: number, value: string) => {
    setTaskAnswers(prev => ({ ...prev, [taskId]: value }))
  }

  const handleScreenshotToggle = (taskId: number) => {
    setScreenshotPrefs(prev => ({ ...prev, [taskId]: !(prev[taskId] ?? true) }))
  }

  const handleSelectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([])
    } else {
      setSelectedTasks(tasks.map(task => task.id))
    }
  }

  const handleExecute = async () => {
    if (!uploadId) {
      onError('Upload missing. Please upload your lab file first.')
      return
    }

    if (selectedTasks.length === 0) {
      onError('Please select at least one task to execute')
      return
    }

    setExecuting(true)
    setExecutionStage('code')
    setExecutionProgress(0)

    let progressInterval: ReturnType<typeof setInterval> | null = null
    let screenshotStageTimeout: ReturnType<typeof setTimeout> | null = null

    const clearTimers = () => {
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      if (screenshotStageTimeout) {
        clearTimeout(screenshotStageTimeout)
        screenshotStageTimeout = null
      }
    }

    try {
      progressInterval = setInterval(() => {
        setExecutionProgress(prev => {
          if (prev >= 90) {
            return 90
          }
          return prev + 10
        })
      }, 300)

      screenshotStageTimeout = setTimeout(() => {
        setExecutionStage('screenshot')
      }, 1500)

      const screenshotTaskIds = selectedTasks.filter(
        taskId => screenshotPrefs[taskId] ?? true
      )

      const response = await apiService.runTasks({
        upload_id: uploadId,
        task_ids: selectedTasks,
        theme,
        screenshot_task_ids: screenshotTaskIds
      })

      const normalizeUrl = (url?: string | null) => {
        if (!url) return undefined
        return url.startsWith('http') ? url : `${apiBaseUrl}${url}`
      }

      const normalizeJob = (job: JobStatus): JobStatus => {
        const screenshot_urls = job.screenshot_urls?.map(u => normalizeUrl(u) || u)
        const screenshot_url = normalizeUrl(job.screenshot_url) || (screenshot_urls && screenshot_urls[0])
        return {
          ...job,
          screenshot_url,
          screenshot_urls,
          files: job.files?.map(file => ({
            ...file,
            screenshot_url: normalizeUrl(file.screenshot_url),
          })),
        }
      }

      const normalizedJobs = response.jobs.map(normalizeJob)

      clearTimers()
      setExecutionProgress(100)
      setJobResults(normalizedJobs)
      
      setTimeout(() => {
        onExecutionComplete(normalizedJobs)
        setExecuting(false)
        setExecutionProgress(0)
        setExecutionStage('code')
      }, 500)

    } catch (error) {
      clearTimers()
      setExecutionStage('code')
      setExecutionProgress(0)
      setExecuting(false)
      onError(error instanceof Error ? error.message : 'Execution failed')
    }
  }

  useEffect(() => {
    setTheme(initialTheme)
  }, [initialTheme])

  useEffect(() => {
    setSelectedTasks(prev => prev.filter(id => tasks.some(task => task.id === id)))
  }, [tasks])

  useEffect(() => {
    const answers: Record<number, string> = {}
    const screenshots: Record<number, boolean> = {}
    tasks.forEach(task => {
      answers[task.id] = task.ai_answer || ''
      screenshots[task.id] = task.requires_screenshot
    })
    setTaskAnswers(answers)
    setScreenshotPrefs(screenshots)
  }, [tasks])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      {showThemeSelector && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="w-5 h-5" />
              <span>Screenshot Theme</span>
            </CardTitle>
            <CardDescription>
              Choose the editor theme for generated screenshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {themeOptions.map(option => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value)
                    onThemeChange?.(option.value)
                  }}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    theme === option.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <p className="font-semibold text-gray-900">{option.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Select Tasks to Execute</CardTitle>
              <CardDescription>
                Choose which code blocks to run and generate screenshots for
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={executing || tasks.length === 0}
            >
              {selectedTasks.length === tasks.length && tasks.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`cursor-pointer transition-colors ${
                  selectedTasks.includes(task.id) ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task.id)}
                        onChange={() => handleTaskToggle(task.id)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        disabled={executing}
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="font-semibold text-gray-900">Task {task.id}</h4>
                          <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={screenshotPrefs[task.id] ?? true}
                              onChange={() => handleScreenshotToggle(task.id)}
                              disabled={executing}
                            />
                            <span>Screenshot required</span>
                          </label>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {task.question_text}
                        </p>
                        {task.code_snippet && (
                          <div className="bg-gray-900/90 text-white rounded-lg p-3 max-h-48 overflow-auto shadow-inner">
                            <pre className="text-xs font-mono whitespace-pre-wrap">
                              {task.code_snippet}
                            </pre>
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase">AI Suggested Answer</p>
                          <textarea
                            value={taskAnswers[task.id] ?? ''}
                            onChange={(event) => handleAnswerChange(task.id, event.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-slate-900 p-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows={3}
                            disabled={executing}
                            placeholder="AI-generated answer will appear here..."
                          />
                          <p className="text-xs text-gray-500">You can fine-tune the response before documenting.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Execution Controls */}
      <Card>
        <CardContent className="p-6">
          {executing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 text-indigo-600 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {executionStage === 'code' ? 'Executing Code...' : 'Rendering Screenshot...'}
                  </h3>
                  <Progress value={executionProgress} className="mt-2" />
                  <p className="text-sm text-gray-600 mt-1">
                    {executionStage === 'code' ? 'Sending code to the sandbox and waiting for output.' : 'Capturing your IDE view with the latest output.'}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
                </h3>
                <p className="text-sm text-gray-600">
                  Ready to execute code and generate screenshots
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={handleExecute}
                  disabled={selectedTasks.length === 0}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Code
                </Button>
                {jobResults.length > 0 && (
                  <Button
                    onClick={() => onPreview(jobResults)}
                    variant="outline"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview & Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
