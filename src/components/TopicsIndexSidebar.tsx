'use client'

import { useEffect, useState } from 'react'
import { StreamInteractiveItem } from '@/types'

interface TopicCard {
  id: string
  title: string
  score?: string
  isActive?: boolean
}

interface TopicsIndexSidebarProps {
  currentSubjectId?: string | null
}

export function TopicsIndexSidebar({ currentSubjectId }: TopicsIndexSidebarProps) {
  const [topics, setTopics] = useState<TopicCard[]>([])

  useEffect(() => {
    // Listen for new interactive content being added to the stream
    const handleNewInteractive = (event: CustomEvent) => {
      const item = event.detail as StreamInteractiveItem
      
      setTopics(prev => {
        // Avoid duplicates
        if (prev.some(t => t.id === item.id)) return prev
        
        return [...prev, {
          id: item.id,
          title: item.title || item.type.replace('-', ' '),
          isActive: false
        }]
      })
    }

    window.addEventListener('streamInteractiveAdded', handleNewInteractive as EventListener)
    
    return () => {
      window.removeEventListener('streamInteractiveAdded', handleNewInteractive as EventListener)
    }
  }, [])

  // Reset topics when subject changes
  useEffect(() => {
    setTopics([])
  }, [currentSubjectId])

  const handleTopicClick = (topicId: string) => {
    const anchor = `item-${topicId}`
    window.location.hash = anchor
    const el = document.getElementById(anchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="w-[340px] h-full bg-white border-l border-gray-200 flex flex-col">
      {topics.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-500 text-sm text-center">
            Interactive content will appear here as you learn
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-[380px]">
          {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => handleTopicClick(topic.id)}
            className={`
              w-full text-left p-4 rounded border border-black/10 
              bg-black/[0.02] hover:bg-black/[0.04] transition-colors
              ${topic.isActive ? 'ring-2 ring-blue-500' : ''}
            `}
          >
            <div className="space-y-2">
              <p className="font-semibold text-base text-black leading-6">
                {topic.title}
              </p>
              {topic.score && (
                <p className="font-normal text-base text-black leading-6">
                  {topic.score}
                </p>
              )}
            </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

