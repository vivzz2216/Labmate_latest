'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Loader2, RefreshCw, UploadCloud, Wand2, Clipboard } from 'lucide-react'
import { apiService, CodeIssue, CodeReviewResponse } from '@/lib/api'
import { useAuth } from '@/contexts/BasicAuthContext'

const DEFAULT_PROMPT = 'Implement a stack using an array'

export default function CodeReviewPanel() {
  const { user } = useAuth()
  const [problemStatement, setProblemStatement] = useState(DEFAULT_PROMPT)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [review, setReview] = useState<CodeReviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [variantLoading, setVariantLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = event.target.files?.[0]
    if (file && !file.name.endsWith('.py')) {
      setError('Only .py files are allowed for AI code review.')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file ?? null)
  }

  const submitForReview = async () => {
    if (!selectedFile) {
      setError('Select a Python file before requesting a review.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await apiService.reviewPythonAssignment(selectedFile, problemStatement.trim())
      setReview(response)
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Failed to review the file.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const requestVariant = async () => {
    if (!review) return
    setVariantLoading(true)
    setError(null)
    try {
      const response = await apiService.requestCodeVariant({
        original_code: review.original_code,
        problem_statement: review.problem_statement,
        review_id: review.review_id,
      })
      setReview(response)
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Failed to generate an alternative solution.'
      setError(message)
    } finally {
      setVariantLoading(false)
    }
  }

  const copyToClipboard = async (payload: string, label: string) => {
    try {
      await navigator.clipboard.writeText(payload)
    } catch (err) {
      console.error(`Failed to copy ${label}`, err)
    }
  }

  const issueBuckets = useMemo(() => {
    if (!review) return { summary: [] as CodeIssue[], validator: [] as CodeIssue[] }
    return {
      summary: review.issues || [],
      validator: review.validation_notices || [],
    }
  }, [review])

  return (
    <Card className="bg-gray-900/60 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-blue-400" />
          Python Assignment AI Review
        </CardTitle>
        <CardDescription className="text-white/70">
          Upload a .py solution and let Claude analyze it, fix validator issues, and personalize the final code with your profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Problem Statement</label>
            <textarea
              value={problemStatement}
              onChange={(event) => setProblemStatement(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="space-y-4">
            <label className="text-sm font-medium text-white/80 block">Upload Python File</label>
            <label
              className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-white/20 bg-black/30 px-4 py-6 text-white/70 cursor-pointer hover:border-blue-400"
            >
              <UploadCloud className="w-5 h-5" />
              <span>{selectedFile ? selectedFile.name : 'Click to select .py file'}</span>
              <input type="file" accept=".py" className="hidden" onChange={handleFileChange} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={submitForReview}
                disabled={loading || !selectedFile}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Run AI Review
              </Button>
              <Button
                variant="outline"
                onClick={requestVariant}
                disabled={!review || variantLoading}
                className="border-white/30 text-white hover:bg-white/10"
              >
                {variantLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Generate Different Code
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {review && (
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">Result Summary</p>
                  <p className="text-lg font-semibold text-white">{review.summary}</p>
                </div>
                <div className="text-sm text-white/60">
                  Source: <span className="text-white font-medium">{review.model_source}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <IssueList title="AI Findings" issues={issueBuckets.summary} />
              <IssueList title="Validator Flags" issues={issueBuckets.validator} />
            </div>

            <ProfileCard profile={review.user_profile} />

            <CodeBlock
              label="Improved Reference Solution"
              code={review.improved_code}
              onCopy={() => copyToClipboard(review.improved_code, 'Improved Code')}
            />
            <CodeBlock
              label="Personalized Submission (Use this)"
              code={review.personalized_code}
              onCopy={() => copyToClipboard(review.personalized_code, 'Personalized Code')}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface IssueListProps {
  title: string
  issues: CodeIssue[]
}

function IssueList({ title, issues }: IssueListProps) {
  if (!issues || issues.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-white/50">
        No {title.toLowerCase()}.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
      <p className="text-sm font-semibold text-white/80">{title}</p>
      {issues.map((issue, index) => (
        <div key={`${issue.title}-${index}`} className="rounded-md border border-white/5 bg-black/40 p-3">
          <p className="text-white font-medium">{issue.title}</p>
          <p className="text-xs uppercase tracking-wide text-blue-300">{issue.severity}</p>
          <p className="text-sm text-white/70 mt-1">{issue.detail}</p>
          {issue.suggestion && <p className="text-xs text-green-300 mt-1">Fix: {issue.suggestion}</p>}
        </div>
      ))}
    </div>
  )
}

interface CodeBlockProps {
  label: string
  code: string
  onCopy: () => void
}

function CodeBlock({ label, code, onCopy }: CodeBlockProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">{label}</p>
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={onCopy}>
          <Clipboard className="w-4 h-4 mr-1" />
          Copy
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg border border-white/10 bg-black/70 p-4 text-sm leading-6 text-green-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}

interface ProfileCardProps {
  profile: Record<string, any>
}

function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <p className="text-sm font-semibold text-white/80 mb-2">Injected Profile Metadata</p>
      <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
        <div>
          <p className="text-white/50 text-xs uppercase">Name</p>
          <p>{profile?.name || 'N/A'}</p>
        </div>
        <div>
          <p className="text-white/50 text-xs uppercase">Course</p>
          <p>{profile?.course || 'N/A'}</p>
        </div>
        <div>
          <p className="text-white/50 text-xs uppercase">Institution</p>
          <p>{profile?.institution || 'N/A'}</p>
        </div>
        <div>
          <p className="text-white/50 text-xs uppercase">City</p>
          <p>{profile?.city || 'N/A'}</p>
        </div>
      </div>
    </div>
  )
}

