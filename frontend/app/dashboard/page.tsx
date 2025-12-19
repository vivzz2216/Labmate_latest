'use client'

import { useState, useEffect } from 'react'
import UserOnboarding from '@/components/auth/UserOnboarding'
import { useAuth } from '@/contexts/BasicAuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiService } from '@/lib/api'
import { FileText, Calendar, CheckCircle, XCircle, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  IconLayoutDashboard,
  IconUpload,
  IconRobot,
  IconChartPie,
  IconSettings,
  IconLogout
} from '@tabler/icons-react'

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profileComplete, checkProfileComplete, signOut, loading } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Redirect to home if not authenticated
    if (!user && !loading) {
      router.push('/')
      return
    }

    // Check profile completion when component mounts
    const checkProfile = async () => {
      if (user) {
        const isComplete = await checkProfileComplete()
        setShowOnboarding(!isComplete)
      }
    }
    if (user) {
      checkProfile()
    }
  }, [user, loading, checkProfileComplete, router])

  const handleOnboardingComplete = async () => {
    await checkProfileComplete()
    setShowOnboarding(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  const navItems = [
    { label: 'Overview', icon: IconLayoutDashboard, href: '/dashboard' },
    { label: 'Upload Manual', icon: IconUpload, href: '/code-execution' },
    { label: 'AI Studio', icon: IconRobot, href: '/user-dashboard?tab=ai' },
    { label: 'Analytics', icon: IconChartPie, href: '/user-dashboard?tab=analytics' },
    { label: 'Settings', icon: IconSettings, href: '/user-dashboard?tab=settings' },
  ]

  const handleUploadCTA = () => {
    router.push('/code-execution')
  }

  return (
    <>
      <UserOnboarding
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
      <div
        className={cn(
          'flex w-full flex-1 flex-col overflow-hidden bg-[#eef1ff] md:flex-row',
          'h-screen'
        )}
      >
        <aside className="hidden md:flex w-64 bg-gradient-to-b from-[#1d0f4a] via-[#1b0d42] to-[#0b0521] text-white rounded-r-3xl shadow-2xl">
          <div className="flex flex-col w-full">
            <div className="px-6 pt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-bold tracking-tight">
                  L
                </div>
                <div>
                  <p className="text-sm uppercase tracking-widest text-white/70">LabMate</p>
                  <p className="text-lg font-semibold">Control</p>
                </div>
              </div>
              <div className="mt-6 w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white/60 w-3/4" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 mt-3">100% faster labs</p>
            </div>

            <nav className="flex-1 mt-8 space-y-2 px-4">
              {navItems.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href)
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition',
                      isActive ? 'bg-white text-[#27145a] shadow-lg' : 'text-white/70 hover:bg-white/10'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isActive ? 'text-[#6b44ff]' : '')} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="px-4 pb-6 mt-auto">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-white/70 text-sm hover:text-white"
              >
                <IconLogout className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <DashboardContent onUploadClick={handleUploadCTA} />
              </div>
    </>
  )
}

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

const DashboardContent = ({ onUploadClick }: { onUploadClick: () => void }) => {
  const { user } = useAuth()
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    if (user?.id) {
      fetchAssignments()
    }
  }, [user])

  const fetchAssignments = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      const data = await apiService.getUserAssignments(user.id)
      setAssignments(data)
    } catch (err) {
      console.error('Error fetching assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  const weeklyReports = [
    {
      title: 'Manuals Uploaded',
      value: assignments.length.toString(),
      sub: 'Total uploads',
      badge: 'bg-[#ffe9d0] text-[#f08a24]',
    },
    {
      title: 'Screenshots Generated',
      value: assignments.reduce((sum, a) => sum + a.completed_tasks, 0).toString(),
      sub: 'Total screenshots',
      badge: 'bg-[#e4fdf4] text-[#19a974]',
    },
  ]

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
      return 'bg-green-100 text-green-700 border-green-200'
    } else if (assignment.failed_tasks > 0) {
      return 'bg-red-100 text-red-700 border-red-200'
    } else if (assignment.in_progress_tasks > 0) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
    return 'bg-gray-100 text-gray-700 border-gray-200'
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

  // Pagination calculations
  const totalPages = Math.ceil(assignments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentAssignments = assignments.slice(startIndex, endIndex)

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden bg-[#eef1ff] text-slate-900">
      <div className="flex h-full w-full flex-1 flex-col lg:flex-row gap-6 p-6 md:p-8 lg:p-10 overflow-y-auto">
        <div className="flex-1 space-y-6">
          {/* Welcome hero */}
          <div className="bg-gradient-to-r from-[#5f3bff] to-[#a964ff] rounded-3xl p-6 text-white shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide opacity-80">LABMATE ASSISTANT</p>
                <h1 className="text-2xl font-bold mt-1">Welcome back, ready to generate your lab assignments?</h1>
                <p className="mt-2 text-white/80">
                  Upload a lab manual or continue from where you left off.
                </p>
              </div>
              <button
                onClick={onUploadClick}
                className="px-6 py-3 rounded-full bg-white text-[#5f3bff] font-semibold shadow-md hover:bg-white/90 transition"
              >
                Upload Assignment
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Recent Activity</p>
                <h2 className="text-lg font-semibold text-slate-900">Your Activity</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-[#ffe9d0] to-[#fff4e6] p-5 border border-[#f08a24]/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[#f08a24]">Manuals Uploaded</p>
                  <IconUpload className="h-5 w-5 text-[#f08a24]" />
                </div>
                <p className="text-3xl font-bold text-slate-900">{weeklyReports.find(r => r.title === 'Manuals Uploaded')?.value || '0'}</p>
                <p className="text-xs text-slate-600 mt-1">Total uploads</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-[#e4fdf4] to-[#f0fdf9] p-5 border border-[#19a974]/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[#19a974]">Screenshots Generated</p>
                  <IconRobot className="h-5 w-5 text-[#19a974]" />
                </div>
                <p className="text-3xl font-bold text-slate-900">{weeklyReports.find(r => r.title === 'Screenshots Generated')?.value || '0'}</p>
                <p className="text-xs text-slate-600 mt-1">Total screenshots</p>
              </div>
            </div>
          </div>

          {/* Weekly reports */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Weekly reports</h2>
              <div className="flex gap-3 text-sm text-slate-500">
                <button className="font-medium text-slate-900">Today</button>
                <button>Week</button>
                <button>Month</button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {weeklyReports.map(report => (
                <div key={report.title} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-500">{report.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-semibold text-slate-900">{report.value}</span>
                    <span className={cn('px-3 py-1 rounded-full text-xs font-medium', report.badge)}>
                      {report.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Assignments Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Assignments</h2>
            </div>
            
            {loading ? (
              <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6b4dff] mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading assignments...</p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">No assignments yet</p>
                <button
                  onClick={onUploadClick}
                  className="px-6 py-2 rounded-full bg-[#6b4dff] text-white font-semibold hover:bg-[#5a3de6] transition"
                >
                  Upload Your First Assignment
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {currentAssignments.map((assignment, index) => (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/user-dashboard?assignment=${assignment.id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 truncate mb-1">
                            {assignment.original_filename || assignment.filename}
                          </h3>
                          <span className={cn('inline-block px-2 py-1 rounded-full text-xs font-medium border', getStatusColor(assignment))}>
                            {getStatusText(assignment)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-xs text-slate-600 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(assignment.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{getLanguageDisplay(assignment.language)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-slate-600">{assignment.completed_tasks}/{assignment.total_tasks}</span>
                        </div>
                        {assignment.report_download_url && (
                          <Download className="w-4 h-4 text-[#6b4dff]" />
                        )}
                      </div>

                      {assignment.total_tasks > 0 && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#6b4dff] to-[#a964ff] rounded-full transition-all"
                            style={{ width: `${(assignment.completed_tasks / assignment.total_tasks) * 100}%` }}
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={cn(
                        'px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium transition',
                        currentPage === 1
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <ChevronLeft className="w-4 h-4 inline mr-1" />
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            'w-10 h-10 rounded-lg text-sm font-medium transition',
                            currentPage === page
                              ? 'bg-[#6b4dff] text-white shadow-md'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          )}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={cn(
                        'px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium transition',
                        currentPage === totalPages
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 inline ml-1" />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>


                          </div>

        {/* Right rail */}
        <aside className="w-full lg:w-80 space-y-6">
          {/* Ads Section */}
          <div className="bg-gradient-to-br from-[#6b4dff] to-[#8b6dff] rounded-3xl p-6 shadow-lg border border-purple-200 text-white">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
                <IconRobot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Upgrade to Pro</h3>
                <p className="text-sm text-white/90 mb-4">
                  Get unlimited assignments, priority processing, and advanced AI features.
                </p>
                <button className="w-full px-4 py-2 rounded-xl bg-white text-[#6b4dff] font-semibold hover:bg-white/90 transition shadow-md">
                  Learn More
                </button>
              </div>
            </div>
          </div>

          {/* Future Implementation */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Coming Soon</h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Future</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#f0f4ff] to-[#f8faff] border border-blue-100">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600">U</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Ubuntu</p>
                  <p className="text-xs text-slate-500">Linux environment support</p>
                </div>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#fff4e6] to-[#fffaf0] border border-orange-100">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-orange-600">A</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Assembly</p>
                  <p className="text-xs text-slate-500">Low-level programming</p>
                </div>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#e6f7ff] to-[#f0f9ff] border border-cyan-100">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-600">GC</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Google Colab</p>
                  <p className="text-xs text-slate-500">Data Science notebooks</p>
                </div>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">
              These features are in development and will be available soon
            </p>
          </div>
        </aside>
        </div>
    </div>
  )
}
