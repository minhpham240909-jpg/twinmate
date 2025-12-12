/**
 * AI Partner Components
 * Export all AI partner UI components
 *
 * PERFORMANCE NOTE: Heavy components (AIPartnerChat, AIPartnerFlashcards, AIPartnerWhiteboard)
 * should be imported dynamically in pages that use them to reduce initial bundle size.
 *
 * Example usage in a page:
 * ```typescript
 * import dynamic from 'next/dynamic'
 * const AIPartnerChat = dynamic(() => import('@/components/ai-partner/AIPartnerChat'), {
 *   loading: () => <LoadingSkeleton />,
 *   ssr: false
 * })
 * ```
 */

// Direct exports - pages should use dynamic imports for these heavy components
export { default as AIPartnerChat } from './AIPartnerChat'
export { default as AIPartnerFlashcards } from './AIPartnerFlashcards'
export { default as AIPartnerWhiteboard } from './AIPartnerWhiteboard'

// Regular exports for lighter components (used more frequently, smaller bundle impact)
export { default as AIPartnerSessionTimer } from './AIPartnerSessionTimer'
export { default as StartAIPartnerModal } from './StartAIPartnerModal'
export { default as EndSessionModal } from './EndSessionModal'
export { default as AIPartnerSuggestionModal } from './AIPartnerSuggestionModal'
export { default as PartnerAvailableNotification } from './PartnerAvailableNotification'
