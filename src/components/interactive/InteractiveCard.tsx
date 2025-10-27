'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface InteractiveCardProps {
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  currentStep?: number
  totalSteps?: number
  onNext?: () => void
  nextLabel?: string
}

export function InteractiveCard({
  title,
  description,
  children,
  footer,
  currentStep,
  totalSteps,
  onNext,
  nextLabel = 'Next'
}: InteractiveCardProps) {
  return (
    <div className="w-full rounded-lg overflow-hidden">
      {/* Header Section - Purple Background */}
      <div className="bg-[#e6e6ff] p-6 space-y-4">
        <h2 className="text-[28px] font-semibold leading-8 text-black">
          {title}
        </h2>
        {description && (
          <p className="text-lg leading-7 text-black/80">
            {description}
          </p>
        )}
        {children && (
          <div className="space-y-4">
            {children}
          </div>
        )}
      </div>

      {/* Footer Section - Purple Background with border */}
      {(footer || onNext) && (
        <div className="bg-[#e6e6ff] border-t border-white p-4 flex items-center justify-between">
          <div className="flex-1">
            {currentStep && totalSteps && (
              <p className="text-base font-semibold text-black">
                {currentStep}/{totalSteps}
              </p>
            )}
            {footer}
          </div>
          {onNext && (
            <Button
              onClick={onNext}
              className="bg-black hover:bg-black/90 text-white px-6 py-2 rounded-lg"
            >
              {nextLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

