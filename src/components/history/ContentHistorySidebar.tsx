'use client'

/**
 * ContentHistorySidebar
 * ----------------
 * TODO: Add description and exports for ContentHistorySidebar.
 */


import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronUp } from 'lucide-react'
import { InteractiveContent } from '../ContentPane'

interface ContentHistorySidebarProps {
  open: boolean
  contentFeed: InteractiveContent[]
  selectedIndex: number
  onSelect: (index: number) => void
  onClose: () => void
}

export const ContentHistorySidebar = memo(function ContentHistorySidebar({
  open,
  contentFeed,
  selectedIndex,
  onSelect,
  onClose
}: ContentHistorySidebarProps) {
  return (
    <AnimatePresence>
      {open && contentFeed.length > 1 && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg z-10"
        >
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Previous Activities</h3>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
                  <ChevronUp className="h-4 w-4 rotate-90" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {contentFeed.slice(0, -1).map((content, index) => {
                  const isSelected = selectedIndex === index
                  return (
                    <motion.div
                      key={content.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        onSelect(index)
                        onClose()
                      }}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          Activity #{index + 1}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          {content.type.replace('-', ' ')}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-blue-500 text-white text-xs">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium truncate">{content.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {content.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
