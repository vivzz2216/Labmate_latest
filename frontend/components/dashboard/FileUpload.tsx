'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { apiService, type UploadResponse } from '@/lib/api'
import { useAuth } from '@/contexts/BasicAuthContext'
import { formatFileSize } from '@/lib/utils'

interface FileUploadProps {
  onUploadComplete: (upload: UploadResponse) => void
  onError: (error: string) => void
}

export default function FileUpload({ onUploadComplete, onError }: FileUploadProps) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadResponse | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const upload = await apiService.uploadFile(file, user?.id)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadedFile(upload)
      
      setTimeout(() => {
        onUploadComplete(upload)
        setUploading(false)
        setUploadProgress(0)
      }, 500)

    } catch (error) {
      setUploading(false)
      setUploadProgress(0)
      onError(error instanceof Error ? error.message : 'Upload failed')
    }
  }, [onUploadComplete, onError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploading
  })

  if (uploadedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-50 border-2 border-green-200 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-green-900 text-base mb-1">File Uploaded Successfully</h3>
            <p className="text-sm text-green-700 truncate">
              {uploadedFile.original_filename}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {formatFileSize(uploadedFile.file_size)} • Ready for processing
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
        ${isDragActive 
          ? 'border-[#5f3bff] bg-[#5f3bff]/5 shadow-lg scale-[1.02]' 
          : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
        }
        ${uploading ? 'cursor-not-allowed opacity-60' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      {uploading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#5f3bff] to-[#a964ff] rounded-2xl flex items-center justify-center shadow-lg">
            <Upload className="w-10 h-10 text-white animate-pulse" />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Uploading your file...</h3>
            <div className="max-w-md mx-auto">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-slate-600 mt-2 font-medium">{uploadProgress}% complete</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center shadow-inner">
            <FileText className="w-10 h-10 text-slate-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {isDragActive ? 'Drop your file here' : 'Upload Lab Manual'}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {isDragActive 
                ? 'Release to upload your file' 
                : 'Drag and drop your DOCX or PDF file here, or click to browse'
              }
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Supported formats: .docx, .pdf • Maximum file size: 50MB
            </p>
          </div>
          <Button 
            variant="outline" 
            className="mt-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 font-medium px-6 py-2.5 rounded-xl transition-all"
          >
            Browse Files
          </Button>
        </motion.div>
      )}
    </div>
  )
}
