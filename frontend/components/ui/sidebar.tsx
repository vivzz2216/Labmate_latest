'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SidebarContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

interface SidebarProps {
  children: ReactNode
  open?: boolean
  setOpen?: (open: boolean) => void
}

export const Sidebar = ({ children, open: controlledOpen, setOpen: controlledSetOpen }: SidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledSetOpen || setInternalOpen

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <motion.aside
        initial={false}
        animate={{
          width: open ? '16rem' : '4rem',
        }}
        className={cn(
          'relative flex h-full flex-col border-r border-white/10 bg-black',
          'transition-all duration-300 ease-in-out'
        )}
      >
        {children}
      </motion.aside>
    </SidebarContext.Provider>
  )
}

interface SidebarBodyProps {
  children: ReactNode
  className?: string
}

export const SidebarBody = ({ children, className }: SidebarBodyProps) => {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {children}
    </div>
  )
}

interface SidebarLinkProps {
  link: {
    label: string
    href: string
    icon: ReactNode
    onClick?: () => void
  }
}

export const SidebarLink = ({ link }: SidebarLinkProps) => {
  const { open } = useSidebar()
  const { label, href, icon, onClick } = link

  const handleClick = (e: React.MouseEvent) => {
    if (href === '#') {
      e.preventDefault()
    }
    if (onClick) {
      onClick()
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
        'text-white/80 transition-colors hover:bg-white/10 hover:text-white',
        'cursor-pointer'
      )}
    >
      <div className="flex-shrink-0">{icon}</div>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </a>
  )
}

