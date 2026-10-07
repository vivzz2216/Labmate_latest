'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PreviewGrid from '@/components/preview/PreviewGrid'
import { ArrowLeft, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { apiService, type JobStatus, type ComposeResponse } from '@/lib/api'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PreviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportGenerated, setReportGenerated] = useState<ComposeResponse | null>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setLoading(true)
    try {
      // Get job results from URL parameters
      const jobResultsParam = searchParams.get('jobResults')
      const uploadIdParam = searchParams.get('uploadId')
      
      if (jobResultsParam && uploadIdParam) {
        const jobResults: JobStatus[] = JSON.parse(jobResultsParam)
        setUploadId(parseInt(uploadIdParam))
        
        const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
        const normalizeUrl = (url?: string | null) => {
          if (!url) return undefined
          return url.startsWith('http') ? url : `${apiBaseUrl}${url}`
        }

        const convertedJobs: JobStatus[] = jobResults.map(result => ({
          ...result,
          screenshot_url: normalizeUrl(result.screenshot_url),
          screenshot_urls: result.screenshot_urls?.map(u => normalizeUrl(u) || u),
          files: result.files?.map(file => ({
            ...file,
            screenshot_url: normalizeUrl(file.screenshot_url),
          }))
        }))
        
        setJobs(convertedJobs)
      } else {
        // Fallback to mock data if no params
        const mockJobs: JobStatus[] = [
          {
            id: 1,
            task_id: 1,
            question_text: "Write a Python function to calculate the factorial of a number.",
            status: "completed",
            output_text: "Factorial function created successfully. Test with factorial(5) = 120",
            execution_time: 150,
            screenshot_url: "/screenshots/1/screenshot_abc123.png"
          },
          {
            id: 2,
            task_id: 2,
            question_text: "Create a list comprehension to generate squares of numbers 1 to 10.",
            status: "completed",
            output_text: "[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]",
            execution_time: 89,
            screenshot_url: "/screenshots/2/screenshot_def456.png"
          }
        ]
        setJobs(mockJobs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveJob = (jobId: number) => {
    setJobs(prev => prev.filter(job => job.id !== jobId))
  }

  const handlePreviewJob = (job: JobStatus) => {
    // Open screenshot in new tab or modal
    if (job.screenshot_url) {
      window.open(job.screenshot_url, '_blank')
    }
  }

  const handleGenerateReport = async (screenshotOrder: number[]) => {
    try {
      if (!uploadId) {
        throw new Error('Upload ID not found')
      }
      
      const response = await apiService.composeReport({
        upload_id: uploadId,
        screenshot_order: screenshotOrder
      })
      
      setReportGenerated(response)
      
      // Auto-download the report
      const blob = await apiService.downloadReport(response.report_id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    }
  }

  const handleReset = () => {
    setReportGenerated(null)
    router.push('/dashboard')
  }
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef1ff] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-[#5f3bff] rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Loading preview...</h2>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef1ff]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-slate-100">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#5f3bff] rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">LabMate AI</span>
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium">
              Preview & Download
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Success Message */}
        {reportGenerated && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-green-200 bg-green-50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Report Generated Successfully!</h3>
                    <p className="text-sm text-green-700">
                      Your report "{reportGenerated.filename}" has been generated and downloaded.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-900">Error</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Page Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold mb-4 text-slate-900">
              Preview & Download
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Review your generated screenshots, reorder them as needed, and update your original document with the screenshots.
            </p>
          </motion.div>
        </div>

        {/* Preview Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <PreviewGrid
            jobs={jobs}
            onRemoveJob={handleRemoveJob}
            onPreviewJob={handlePreviewJob}
            onGenerateReport={handleGenerateReport}
            onReset={handleReset}
          />
        </motion.div>

        {/* Code and File Contents */}
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10"
          >
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Code & File Contents</CardTitle>
                <CardDescription className="text-slate-600">
                  Direct view of every Python snippet and text file captured during execution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {jobs.map(job => (
                  <div key={job.id} className="rounded-2xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
                    {job.code_snippet && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Task {job.task_id} · Python code
                        </p>
                        <div className="rounded-xl border border-slate-200 bg-white shadow-inner overflow-x-auto">
                          <pre className="p-4 text-[13px] leading-relaxed text-slate-900 font-mono whitespace-pre-wrap">
                            {job.code_snippet}
                          </pre>
                        </div>
                      </div>
                    )}

                    {job.files?.length ? (
                      <div className="space-y-3">
                        {job.files.map((file, index) => (
                          <div key={`${job.id}-${file.filename}-${index}`}>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                              {file.filename} · {file.type === 'input' ? 'Input file' : 'Generated file'}
                            </p>
                            <div className="rounded-xl border border-indigo-100 bg-white shadow-inner overflow-x-auto">
                              <pre className="p-4 text-[13px] leading-relaxed text-slate-900 font-mono whitespace-pre-wrap">
                                {file.content || '[Binary content omitted]'}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12"
        >
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">How to Use This Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#5f3bff]">1. Review Screenshots</h4>
                  <p className="text-sm text-slate-600">
                    Click on any screenshot to preview it in full size. Check that the code output looks correct.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#5f3bff]">2. Reorder if Needed</h4>
                  <p className="text-sm text-slate-600">
                    Drag and drop screenshots to reorder them. The final report will maintain this order.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#5f3bff]">3. Update Document</h4>
                  <p className="text-sm text-slate-600">
                    Click "Update & Download Document" to add screenshots to your original assignment document.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
