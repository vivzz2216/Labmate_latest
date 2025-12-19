import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '@/contexts/BasicAuthContext'

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: true })

export const metadata: Metadata = {
  title: {
    default: 'LabMate AI - Automated Lab Assignment Platform',
    template: '%s | LabMate AI'
  },
  description: 'Automate your college lab assignments with AI-powered code execution, automated testing, and professional report generation. Perfect for Python, Java, and web development assignments.',
  keywords: [
    'lab assignments',
    'python automation',
    'code execution',
    'assignment automation',
    'education technology',
    'AI coding assistant',
    'automated testing',
    'lab report generator',
    'college assignments',
    'programming assignments',
    'code analysis',
    'screenshot generation'
  ],
  authors: [{ name: 'LabMate AI' }],
  creator: 'LabMate AI',
  publisher: 'LabMate AI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://labmate.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'LabMate AI',
    title: 'LabMate AI - Automated Lab Assignment Platform',
    description: 'Automate your college lab assignments with AI-powered code execution and screenshot generation.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LabMate AI - Automated Lab Assignment Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LabMate AI - Automated Lab Assignment Platform',
    description: 'Automate your college lab assignments with AI-powered code execution and screenshot generation.',
    images: ['/og-image.png'],
    creator: '@labmateai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
