'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Subject, LessonPlan } from '@/types'

interface LessonOutlineSidebarProps {
  currentSubject: Subject | null
  lessonPlan?: LessonPlan | null  // For future use
  onUpdatePlan?: () => void
}

interface Section {
  id: string
  title: string
  items: string[]
}

export function LessonOutlineSidebar({ 
  currentSubject, 
  // lessonPlan, // Reserved for future use
  onUpdatePlan 
}: LessonOutlineSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['started', 'went', 'ended'])
  )

  // Convert lesson plan to sections format
  // The AI should generate lessons with 3 phases that match these section titles
  const sections: Section[] = []
  
  if (currentSubject?.lessonPlan?.lessons && currentSubject.lessonPlan.lessons.length > 0) {
    const lessons = currentSubject.lessonPlan.lessons
    const thirdSize = Math.ceil(lessons.length / 3)
    
    sections.push(
      {
        id: 'started',
        title: 'How it started',
        items: lessons.slice(0, thirdSize).map(lesson => lesson.title)
      },
      {
        id: 'went',
        title: 'How it went',
        items: lessons.slice(thirdSize, thirdSize * 2).map(lesson => lesson.title)
      },
      {
        id: 'ended',
        title: 'How it ended',
        items: lessons.slice(thirdSize * 2).map(lesson => lesson.title)
      }
    )
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  if (!currentSubject) {
    return (
      <div className="w-[340px] h-full bg-white border-r border-gray-200 p-4 flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center">
          Select or create a subject to view the lesson outline
        </p>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="w-[340px] h-full bg-white border-r border-gray-200 p-4 flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center">
          Chat with the AI to generate a lesson plan for {currentSubject.name}
        </p>
      </div>
    )
  }

  return (
    <div className="w-[340px] h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          
          return (
            <div key={section.id} className="space-y-2">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 w-full text-left group"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                )}
                <h3 className="font-semibold text-lg text-black/80 group-hover:text-black">
                  {section.title}
                </h3>
              </button>
              
              {isExpanded && (
                <ol className="ml-6 space-y-1 list-decimal list-outside text-sm text-black/60">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="pl-1">
                      <span className="leading-6">{item}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>

      {/* Update Lesson Plan Button */}
      {onUpdatePlan && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onUpdatePlan}
            className="w-full px-3 py-2 text-base text-left rounded hover:bg-gray-50 transition-colors"
          >
            Update lesson plan
          </button>
        </div>
      )}
    </div>
  )
}

