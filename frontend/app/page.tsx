'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/BasicAuthContext'
import { useRouter } from 'next/navigation'
import LoginModal from '@/components/auth/LoginModal'
import { GridScan } from '@/components/hero/GridScan'
import SpotlightCard from '@/components/ui/SpotlightCard'
import CardSwap, { Card } from '@/components/ui/CardSwap'
import { Iphone } from '@/components/ui/Iphone'
import LogoLoop from '@/components/ui/LogoLoop'
import { cn } from '@/lib/utils'
import { 
  SiPython, 
  SiC, 
  SiCplusplus,
  SiHtml5,
  SiCss3,
  SiJavascript,
  SiReact,
  SiAngular,
  SiNodedotjs,
  SiMysql,
  SiGooglecolab,
  SiFlutter,
  SiAssemblyscript
} from 'react-icons/si'
import { FaJava } from 'react-icons/fa'
import { 
  Menu, 
  X,
  ArrowRight,
  CheckCircle,
  Database,
  Users,
  Lock,
  Star,
  ChevronRight,
  ExternalLink,
  Terminal,
  FileText,
  Brain,
  Rocket,
  Download,
  Upload,
  Eye,
  Search,
  Zap,
  BookOpen,
  MessageCircle
} from 'lucide-react'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const { user, loading } = useAuth()
  const router = useRouter()

  const handleGetStarted = () => {
    if (loading) return
    if (user) {
      router.push('/dashboard')
      return
    }
    setShowLoginModal(true)
  }

  // Smooth scroll with 1 second duration
  useEffect(() => {
    const smoothScrollTo = (target: Element, duration: number = 1000) => {
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - 80;
      const startPosition = window.pageYOffset;
      const distance = targetPosition - startPosition;
      let startTime: number | null = null;

      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const animation = (currentTime: number) => {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = easeInOutCubic(progress);
        
        window.scrollTo(0, startPosition + distance * ease);
        
        if (timeElapsed < duration) {
          requestAnimationFrame(animation);
        }
      };

      requestAnimationFrame(animation);
    };

    // Handle smooth scroll for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement;
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href !== '#') {
          const targetElement = document.querySelector(href);
          if (targetElement) {
            e.preventDefault();
            smoothScrollTo(targetElement, 1000);
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [])

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LabMate AI",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1000"
    },
    "description": "Automate your college lab assignments with AI-powered code execution and screenshot generation.",
    "featureList": [
      "AI Code Analysis",
      "Automated Execution",
      "Smart Documentation",
      "Screenshot Generation"
    ]
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 pt-4 pb-4 flex justify-center">
        <div className="flex items-center px-6 py-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg space-x-6 max-w-fit">
            {/* Logo */}
            <div className="flex items-center">
              <img 
                src="/logomain.png" 
                alt="LabMate Logo" 
                className="h-8 w-auto mr-2.5"
              />
              <span className="text-base font-semibold text-white tracking-tight">LabMate</span>
            </div>

            {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <a href="#features" className="text-white/90 hover:text-white px-4 py-1.5 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Features</a>
            <a href="#how-it-works" className="text-white/90 hover:text-white px-4 py-1.5 rounded-full hover:bg-white/5 transition-all text-sm font-medium">How it Works</a>
            <a href="#pricing" className="text-white/90 hover:text-white px-4 py-1.5 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Pricing</a>
            <a href="#testimonials" className="text-white/90 hover:text-white px-4 py-1.5 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Reviews</a>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 mx-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg">
            <div className="px-4 py-4 space-y-2">
              <a href="#features" className="block text-white/90 hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Features</a>
              <a href="#how-it-works" className="block text-white/90 hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-all text-sm font-medium">How it Works</a>
              <a href="#pricing" className="block text-white/90 hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Pricing</a>
              <a href="#testimonials" className="block text-white/90 hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-all text-sm font-medium">Reviews</a>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={handleGetStarted}
                  className="w-full px-6 py-3 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-all"
                >
                  Get Started
                </button>
                <button className="w-full px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/20 text-white rounded-full font-semibold text-sm hover:bg-black/60 transition-all">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center optimize-scroll">
        {/* GridScan Background */}
        <div className="absolute inset-0 z-0 gpu-accelerated">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/30 z-10"></div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-20">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0 }}
            className="mb-8 flex justify-center"
          >
            <img 
              src="/logomain.png" 
              alt="LabMate Logo" 
              className="h-20 md:h-24 lg:h-28 w-auto"
            />
          </motion.div>

          {/* Main Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight text-white optimize-scroll"
          >
            Automate Your Lab Assignments with AI
          </motion.h1>

          {/* Subhead */}
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto"
          >
            Transform your lab assignments into professional submissions with AI-powered code generation, automated execution, and comprehensive documentation.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4"
          >
            <button 
              onClick={handleGetStarted}
              className="px-8 py-4 bg-white text-black rounded-full font-semibold text-base hover:bg-white/90 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Get Started
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
        {/* Grid Background */}
        <div
          className={cn(
            "absolute inset-0",
            "[background-size:40px_40px]",
            "[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
            "opacity-90"
          )}
        />
        {/* Radial gradient for the container to give a faded look */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16 optimize-scroll"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white">
              Powerful Features
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2 Cards Stacked */}
            <div className="lg:col-span-2 space-y-6">
              {[
                {
                  title: "Personalized Code Generation",
                  description: "Automatically inject your profile details including name, roll number, and college information into generated code, ensuring authentic-looking submissions that match your coding style.",
                  spotlightColor: "rgba(59, 130, 246, 0.2)"
                },
                {
                  title: "Intelligent Code Regeneration",
                  description: "Generate multiple code variations with a single click. Each iteration produces unique, well-structured code that passes quality checks and maintains professional standards.",
                  spotlightColor: "rgba(16, 185, 129, 0.2)"
                },
              ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true, margin: "-50px" }}
                className="optimize-scroll"
              >
                  <SpotlightCard 
                    className="h-full"
                    spotlightColor={feature.spotlightColor}
                  >
                    <h3 className="text-xl font-bold mb-4 text-white text-left">
                  {feature.title}
                </h3>
                    <p className="text-white text-left leading-relaxed">
                  {feature.description}
                </p>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>

            {/* Right Column - 1 Vertical Card */}
            <div className="lg:col-span-1 flex">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                className="optimize-scroll w-full"
              >
                <SpotlightCard 
                  className="h-full min-h-[300px]"
                  spotlightColor="rgba(168, 85, 247, 0.2)"
                >
                  <h3 className="text-xl font-bold mb-4 text-white text-left">
                    Smart Documentation
                  </h3>
                  <p className="text-white text-left leading-relaxed">
                    Generate professional reports with embedded screenshots and detailed explanations.
                  </p>
                </SpotlightCard>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section 
        id="how-it-works" 
        className="py-20 px-4 sm:px-6 lg:px-8 relative bg-gradient-to-b from-black via-purple-950/20 to-black"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4 text-white">
              How it works
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Get started in minutes with our streamlined 3-step process.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text Steps */}
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Upload",
                  description: "Upload your lab assignment in PDF, DOCX, or image format. Our system automatically extracts questions and requirements. Maximum file size: 50MB.",
                  icon: Upload
                },
                {
                  step: "2",
                  title: "AI Processing",
                  description: "Our advanced AI analyzes your assignment, generates executable code, captures terminal outputs, and creates comprehensive documentation. Your profile information is automatically integrated for personalized results.",
                  icon: Brain
                },
                {
                  step: "3",
                  title: "Download",
                  description: "Download your completed assignment as a professional PDF or Word document, complete with code, execution screenshots, and detailed explanations.",
                  icon: Download
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                >
                  <div className="rounded-2xl border border-purple-500/30 bg-black/40 backdrop-blur-sm p-6 hover:border-purple-500/50 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2 text-purple-400">
                          {item.title}
                        </h3>
                        <p className="text-white/80 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right Side - iPhone */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
              className="hidden lg:flex justify-center items-center"
            >
              <Iphone 
                autoScroll={true}
                scrollSpeed={30}
                scrollContent={
                  <div className="p-6 space-y-6 bg-gradient-to-b from-purple-50 to-white">
                    {/* Step 1 - Upload */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Step 1: Upload</h3>
                      </div>
                      <p className="text-gray-600 text-sm">Drop your lab PDF or image</p>
                      <div className="mt-4 h-32 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl border-2 border-dashed border-purple-300 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>

                    {/* Step 2 - AI Solves */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Step 2: AI Solves</h3>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">Generating code and screenshots...</p>
                      <div className="space-y-2">
                        <div className="h-4 bg-purple-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-purple-200 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-purple-200 rounded w-5/6 animate-pulse"></div>
                      </div>
                      <div className="mt-4 h-24 bg-gradient-to-br from-purple-200 to-purple-100 rounded-xl flex items-center justify-center">
                        <Terminal className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>

                    {/* Step 3 - Download */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <Download className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Step 3: Download</h3>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">Your assignment is ready!</p>
                      <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">lab_assignment.docx</p>
                            <p className="text-xs text-gray-500">2.4 MB • Ready</p>
                          </div>
                          <Download className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </div>

                    {/* Extra content for scrolling */}
                    <div className="h-32 bg-gradient-to-br from-purple-50 to-white rounded-2xl"></div>
                    <div className="h-24 bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl"></div>
                  </div>
                }
              />
            </motion.div>

            {/* Mobile View - Simple Stack */}
            <div className="lg:hidden space-y-4">
              {[1, 2, 3].map((num) => (
                <div key={num} className="rounded-2xl border border-purple-500/30 bg-purple-900/20 p-6">
                  <div className="text-6xl font-black text-purple-400/30 mb-2">{num}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.6; }
            50% { transform: translateY(-10px) translateX(5px); opacity: 1; }
          }
          .perspective-1000 {
            perspective: 1000px;
          }
        `}</style>
      </section>

      {/* Supported Subjects Section */}
      <section id="subjects" className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Supported Programming Languages
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Comprehensive support for multiple programming languages and frameworks.
            </p>
          </motion.div>

          {/* Available Now - LogoLoop */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-white/60 mb-8 text-center">Available Now</h3>
            <div style={{ height: '120px', position: 'relative', overflow: 'hidden' }}>
              <LogoLoop
                logos={[
                  { node: <SiPython size={48} />, title: "Python" },
                  { node: <FaJava size={48} />, title: "Java" },
                  { node: <SiC size={48} />, title: "C" },
                  { node: <SiCplusplus size={48} />, title: "C++" },
                  { node: <SiHtml5 size={48} />, title: "HTML" },
                  { node: <SiCss3 size={48} />, title: "CSS" },
                  { node: <SiJavascript size={48} />, title: "JavaScript" },
                  { node: <SiReact size={48} />, title: "React" },
                  { node: <SiAngular size={48} />, title: "Angular" },
                  { node: <SiNodedotjs size={48} />, title: "Node.js" },
                ]}
                speed={80}
                direction="left"
                logoHeight={48}
                gap={60}
                hoverSpeed={20}
                scaleOnHover
                fadeOut
                fadeOutColor="#000000"
                ariaLabel="Available technologies"
              />
            </div>
          </div>

          {/* Work in Progress - LogoLoop */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-white/60 mb-8 text-center flex items-center justify-center gap-2">
              <span>Work in Progress</span>
              <span className="text-sm bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">🚧</span>
            </h3>
            <div style={{ height: '120px', position: 'relative', overflow: 'hidden', opacity: 0.7 }}>
              <LogoLoop
                logos={[
                  { node: <SiMysql size={48} />, title: "SQL" },
                  { node: <SiGooglecolab size={48} />, title: "Google Colab" },
                  { node: <SiAssemblyscript size={48} />, title: "Assembly" },
                  { node: <SiFlutter size={48} />, title: "Flutter" },
                ]}
                speed={60}
                direction="left"
                logoHeight={48}
                gap={60}
                hoverSpeed={10}
                scaleOnHover
                fadeOut
                fadeOutColor="#000000"
                ariaLabel="Work in progress technologies"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Why Choose LabMate
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Rocket,
                title: "Time Efficient",
                description: "Significantly reduce assignment completion time, allowing you to focus on understanding concepts and preparing for examinations."
              },
              {
                icon: Eye,
                title: "Professional Quality",
                description: "Generate code with realistic variable names, proper formatting, and personalized details that maintain academic integrity standards."
              },
              {
                icon: CheckCircle,
                title: "Verified Results",
                description: "Test code execution locally or preview results before final submission to ensure accuracy and completeness."
              },
              {
                icon: Zap,
                title: "Version Control",
                description: "Maintain multiple code variations and regenerate alternatives when needed, all while preserving your work history."
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <SpotlightCard 
                  className="h-full p-6"
                  spotlightColor="rgba(16, 185, 129, 0.15)"
                >
                  <benefit.icon className="w-8 h-8 text-white mb-4" />
                  <h3 className="text-lg font-bold mb-2 text-white">{benefit.title}</h3>
                  <p className="text-white/80 text-sm">{benefit.description}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Pricing Plans
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Free",
                price: "₹0",
                features: ["2 uploads / month", "Watermark on PDF"],
                highlight: false
              },
              {
                name: "Student",
                price: "₹149",
                period: "/month",
                features: ["Unlimited uploads", "5 regenerations per assignment", "No watermark"],
                highlight: true
              },
              {
                name: "Pro",
                price: "₹399",
                period: "/month",
                features: ["Unlimited regenerations", "Priority generation", "Team sharing"],
                highlight: false
              },
              {
                name: "College Plan",
                price: "Custom",
                features: ["Batch uploads", "LMS integration", "Admin analytics"],
                highlight: false
              }
            ].map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <SpotlightCard 
                  className={`h-full p-8 ${plan.highlight ? 'border-2 border-blue-500' : ''}`}
                  spotlightColor={plan.highlight ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.1)"}
                >
                  <h3 className="text-2xl font-bold mb-2 text-white">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-white/60">{plan.period}</span>}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-white/80 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={plan.name === "Free" ? handleGetStarted : undefined}
                    className={`w-full py-3 rounded-lg font-semibold transition-all ${
                      plan.highlight 
                        ? 'bg-white text-black hover:bg-white/90' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {plan.name === "College Plan" ? "Contact Sales" : "Get Started"}
                  </button>
                </SpotlightCard>
              </motion.div>
            ))}
                </div>
              </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div>
              <div className="flex items-center mb-4">
                <img 
                  src="/logomain.png" 
                  alt="LabMate Logo" 
                  className="h-10 w-auto mr-3"
                />
                <span className="text-xl font-semibold">LabMate</span>
              </div>
              <p className="text-white/60 mb-4">
                LabMate AI — built for students, low-key magical. Privacy-first. Honest pricing.
              </p>
              <div className="flex space-x-4">
                <MessageCircle className="w-5 h-5 text-white/60 hover:text-white cursor-pointer" />
              </div>
            </div>
            
            {[
              {
                title: "Product",
                links: ["Features", "How it Works", "Pricing", "API"]
              },
              {
                title: "Company", 
                links: ["About", "Blog", "Careers", "Contact"]
              },
              {
                title: "Resources",
                links: ["Docs", "Support", "Community", "Security"]
              },
              {
                title: "Legal",
                links: ["Privacy Policy", "Terms of Service", "Cookie Policy"]
              }
            ].map((section, index) => (
              <div key={index}>
                <h3 className="font-semibold mb-4 text-white">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <a href="#" className="text-white/60 hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-white/10 pt-8">
            <p className="text-white/60 text-sm">
              © 2024 LabMate. All rights reserved.
            </p>
          </div>
        </div>
      </footer>


      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  )
}