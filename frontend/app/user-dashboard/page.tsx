'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/BasicAuthContext'
import { useRouter } from 'next/navigation'
import { apiService } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Upload, Calendar, CheckCircle, XCircle, Clock, Download } from 'lucide-react'

interface Assignment {
  id: number
  filename: string
  original_filename: string
  language?: string
  uploaded_at: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  in_progress_tasks: number
  report_download_url?: string
}

export default function UserDashboard() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
      return
    }

    if (user) {
      fetchAssignments()
    }
  }, [user, authLoading, router])

  const fetchAssignments = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const data = await apiService.getUserAssignments(user.id)
      setAssignments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assignments')
      console.error('Error fetching assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const handleUploadNew = () => {
    router.push('/dashboard')
  }

  const getLanguageDisplay = (language?: string) => {
    switch (language) {
      case 'python': return 'Python (IDLE)'
      case 'java': return 'Java (Notepad)'
      case 'c': return 'C (CodeBlocks)'
      case 'webdev': return 'Web Dev (VS Code)'
      default: return 'Not specified'
    }
  }

  const getStatusColor = (assignment: Assignment) => {
    if (assignment.completed_tasks === assignment.total_tasks && assignment.total_tasks > 0) {
      return 'text-green-400'
    } else if (assignment.failed_tasks > 0) {
      return 'text-red-400'
    } else if (assignment.in_progress_tasks > 0) {
      return 'text-yellow-400'
    }
    return 'text-gray-400'
  }

  const getStatusText = (assignment: Assignment) => {
    if (assignment.completed_tasks === assignment.total_tasks && assignment.total_tasks > 0) {
      return 'Completed'
    } else if (assignment.failed_tasks > 0) {
      return 'Failed'
    } else if (assignment.in_progress_tasks > 0) {
      return 'In Progress'
    }
    return 'Pending'
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-xl font-semibold text-white">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to homepage
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-white">LabMate AI</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-white/80">Welcome back,</p>
                <p className="font-semibold text-white">{user.name}</p>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-4 text-white">
            Your Assignment Dashboard
          </h1>
          <p className="text-xl text-white/80 mb-6">
            Manage your lab assignments and track your progress
          </p>
          
          <Button
            onClick={handleUploadNew}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload New Assignment
          </Button>
        </motion.div>

        {/* Assignments List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {error && (
            <Card className="mb-6 border-red-500/50 bg-red-500/10">
              <CardContent className="p-4">
                <p className="text-red-400">{error}</p>
              </CardContent>
            </Card>
          )}

          {assignments.length === 0 ? (
            <Card className="bg-gray-900/50 border-white/10">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-white/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Assignments Yet</h3>
                <p className="text-white/60 mb-6">
                  Upload your first lab assignment to get started with AI-powered processing
                </p>
                <Button
                  onClick={handleUploadNew}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Assignment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment, index) => (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-gray-900/50 border-white/10 hover:bg-gray-900/70 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {assignment.original_filename}
                            </h3>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              getStatusColor(assignment)
                            } bg-current/10`}>
                              {getStatusText(assignment)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-6 text-sm text-white/60 mb-3">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(assignment.uploaded_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <FileText className="w-4 h-4" />
                              <span>{getLanguageDisplay(assignment.language)}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm">
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-green-400">{assignment.completed_tasks} completed</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <XCircle className="w-4 h-4 text-red-400" />
                              <span className="text-red-400">{assignment.failed_tasks} failed</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4 text-yellow-400" />
                              <span className="text-yellow-400">{assignment.in_progress_tasks} in progress</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {assignment.report_download_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => window.open(assignment.report_download_url, '_blank')}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Report
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={() => router.push(`/dashboard?upload_id=${assignment.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
