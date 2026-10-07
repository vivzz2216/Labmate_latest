'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ScreenshotCard from './ScreenshotCard'
import { JobStatus } from '@/lib/api'
import { Download, FileText, RefreshCw } from 'lucide-react'

interface PreviewGridProps {
  jobs: JobStatus[]
  onRemoveJob: (jobId: number) => void
  onPreviewJob: (job: JobStatus) => void
  onGenerateReport: (screenshotOrder: number[]) => void
  onReset: () => void
}

function SortableScreenshotCard({ 
  job, 
  onRemove, 
  onPreview 
}: { 
  job: JobStatus
  onRemove: (jobId: number) => void
  onPreview: (job: JobStatus) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ScreenshotCard
        job={job}
        index={job.task_id}
        onRemove={onRemove}
        onPreview={onPreview}
        isDragging={isDragging}
      />
    </div>
  )
}

export default function PreviewGrid({ 
  jobs, 
  onRemoveJob, 
  onPreviewJob, 
  onGenerateReport,
  onReset 
}: PreviewGridProps) {
  const [orderedJobs, setOrderedJobs] = useState<JobStatus[]>(jobs)
  const [generatingReport, setGeneratingReport] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrderedJobs((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    try {
      const screenshotOrder = orderedJobs
        .filter(job => job.screenshot_url)
        .map(job => job.id)
      
      await onGenerateReport(screenshotOrder)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleReset = () => {
    setOrderedJobs(jobs)
    onReset()
  }

  const completedJobs = orderedJobs.filter(job => job.status === 'completed')
  const jobsWithScreenshots = orderedJobs.filter(job => job.screenshot_url)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <FileText className="w-5 h-5" />
            <span>Report Preview</span>
          </CardTitle>
          <CardDescription className="text-white/60">
            Review and reorder your screenshots before generating the final report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{orderedJobs.length}</div>
              <div className="text-sm text-blue-400">Total Tasks</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{completedJobs.length}</div>
              <div className="text-sm text-green-400">Completed</div>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{jobsWithScreenshots.length}</div>
              <div className="text-sm text-purple-400">Screenshots</div>
            </div>
            <div className="text-center p-3 bg-red-500/10 rounded-lg">
              <div className="text-2xl font-bold text-red-400">
                {orderedJobs.filter(job => job.status === 'failed').length}
              </div>
              <div className="text-sm text-red-400">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drag and Drop Grid */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Screenshot Gallery</CardTitle>
              <CardDescription className="text-white/60">
                Drag and drop to reorder screenshots. The order will be maintained in the final report.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orderedJobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Screenshots Available</h3>
              <p className="text-white/60">Execute some code tasks first to generate screenshots.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedJobs.map(job => job.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orderedJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <SortableScreenshotCard
                        job={job}
                        onRemove={onRemoveJob}
                        onPreview={onPreviewJob}
                      />
                    </motion.div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Button */}
      {jobsWithScreenshots.length > 0 && (
        <Card className="bg-gray-900/50 border-white/10">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Ready to Update Your Document</h3>
                <p className="text-white/80">
                  {jobsWithScreenshots.length} screenshot{jobsWithScreenshots.length !== 1 ? 's' : ''} will be added to your original document.
                </p>
              </div>
              <Button
                onClick={handleGenerateReport}
                disabled={generatingReport || jobsWithScreenshots.length === 0}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {generatingReport ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Updating Document...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Update & Download Document
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
