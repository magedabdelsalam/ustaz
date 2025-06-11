'use client'

import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertTriangle } from 'lucide-react'
import { InteractiveComponentProps } from './index'
import type { PlaceholderContent } from '@/types'

export const Placeholder = memo(function Placeholder({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) {
  const { message = 'Content failed to load. Please try again.' } = content as PlaceholderContent
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    onInteraction('retry_content', { componentId: id })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span>Content Unavailable</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <p className="text-gray-600 text-center">{message}</p>
        <Button onClick={handleRetry} disabled={retrying || isLoading} className="flex items-center">
          {(retrying || isLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Retry
        </Button>
      </CardContent>
    </Card>
  )
})
