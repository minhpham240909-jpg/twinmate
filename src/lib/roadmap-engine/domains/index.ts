/**
 * DOMAIN INTELLIGENCE - INDEX
 *
 * Export all domain-related types and utilities.
 */

// Types
export * from './types'

// Domain playbooks
export { ProgrammingDomain } from './programming'
export { LanguagesDomain } from './languages'

// Selector
export {
  DomainSelector,
  getDomainSelector,
  getDomainContext,
} from './domain-selector'
