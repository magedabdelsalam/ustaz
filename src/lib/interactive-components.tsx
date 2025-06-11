import { StreamInteractiveContent } from '@/types'
import { ConceptCard } from '@/components/interactive/ConceptCard'
import { Explainer } from '@/components/interactive/Explainer'
import { FillInTheBlank } from '@/components/interactive/FillInTheBlank'
import { InteractiveExample } from '@/components/interactive/InteractiveExample'
import { TextHighlighter } from '@/components/interactive/TextHighlighter'

export function renderInteractiveComponent(
  item: StreamInteractiveContent,
  onInteraction: (action: string, data: unknown) => void
) {
  switch (item.content.type) {
    case 'concept-card':
      return <ConceptCard content={item.content.data} onInteraction={onInteraction} id={item.id} />
    case 'explainer':
      return <Explainer content={item.content.data} onInteraction={onInteraction} id={item.id} />
    case 'fill-blank':
      return <FillInTheBlank content={item.content.data} onInteraction={onInteraction} id={item.id} />
    case 'interactive-example':
      return <InteractiveExample content={item.content.data} onInteraction={onInteraction} id={item.id} />
    case 'text-highlighter':
      return <TextHighlighter content={item.content.data} onInteraction={onInteraction} id={item.id} />
    default:
      return null
  }
} 