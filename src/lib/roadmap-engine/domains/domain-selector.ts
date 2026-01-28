/**
 * DOMAIN SELECTOR
 *
 * Determines which domain playbook to use based on the user's goal.
 * Also detects if clarification is needed for vague goals.
 */

import { DomainPlaybook, DomainMatch, DomainSelectionResult, GENERIC_PLAYBOOK } from './types'
import { ProgrammingDomain } from './programming'
import { LanguagesDomain } from './languages'

// ============================================
// AVAILABLE DOMAINS
// ============================================

const DOMAINS: DomainPlaybook[] = [
  ProgrammingDomain,
  LanguagesDomain,
  // Add more domains as they are created:
  // MusicDomain,
  // BusinessDomain,
  // AcademicsDomain,
]

// ============================================
// VAGUE GOAL PATTERNS
// Goals that need clarification
// ============================================

const VAGUE_PATTERNS = [
  // Too broad
  /^learn\s+(programming|coding|to code)$/i,
  /^learn\s+(a\s+)?language$/i,
  /^learn\s+(something|anything|new)$/i,
  /^get\s+better\s+at\s+\w+$/i,
  /^improve\s+(my\s+)?\w+$/i,

  // No context
  /^learn\s+(react|python|javascript|java|c\+\+)$/i,
  /^learn\s+(english|spanish|french|german|japanese|chinese)$/i,

  // Single word
  /^(programming|coding|design|marketing|writing|music)$/i,
]

// ============================================
// SPECIFIC GOAL PATTERNS
// Goals that can proceed directly
// ============================================

const SPECIFIC_INDICATORS = [
  // Clear purpose
  /for\s+(work|job|interview|career|business|project)/i,
  /to\s+(build|create|make|develop|automate)/i,
  /want\s+to\s+(become|be\s+able|start)/i,

  // Clear level
  /(beginner|intermediate|advanced|expert)\s+level/i,
  /from\s+(scratch|zero|beginning)/i,
  /already\s+(know|have|can)/i,

  // Clear output
  /(website|app|application|portfolio|project)/i,
  /(conversation|speaking|writing|exam|test)/i,

  // Clear constraint
  /in\s+\d+\s+(weeks?|months?|days?)/i,
  /\d+\s+(minutes?|hours?)\s+per\s+day/i,
]

// ============================================
// DOMAIN SELECTOR CLASS
// ============================================

export class DomainSelector {
  private domains: DomainPlaybook[]

  constructor(customDomains?: DomainPlaybook[]) {
    this.domains = customDomains || DOMAINS
  }

  /**
   * Select the best domain for a given goal
   */
  selectDomain(goal: string): DomainSelectionResult {
    const normalizedGoal = goal.toLowerCase().trim()
    const matches: DomainMatch[] = []

    // Score each domain
    for (const domain of this.domains) {
      const match = this.scoreDomain(normalizedGoal, domain)
      if (match.confidence > 0) {
        matches.push(match)
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence)

    // Check if goal is vague
    const isVague = this.isVagueGoal(normalizedGoal)
    const clarificationNeeded = isVague && !this.hasSpecificIndicators(normalizedGoal)

    // Return result
    if (matches.length === 0) {
      // No domain match - use generic
      return {
        primary: {
          domain: 'generic',
          subdomain: null,
          confidence: 0.5,
          matchedKeywords: [],
        },
        alternatives: [],
        isVague,
        clarificationNeeded,
      }
    }

    return {
      primary: matches[0],
      alternatives: matches.slice(1, 3), // Top 2 alternatives
      isVague,
      clarificationNeeded,
    }
  }

  /**
   * Get the playbook for a domain
   */
  getPlaybook(domainName: string): DomainPlaybook | null {
    return this.domains.find(d => d.domain === domainName) || null
  }

  /**
   * Get the generic playbook (fallback)
   */
  getGenericPlaybook() {
    return GENERIC_PLAYBOOK
  }

  /**
   * Score a domain against a goal
   */
  private scoreDomain(goal: string, domain: DomainPlaybook): DomainMatch {
    const matchedKeywords: string[] = []
    let score = 0

    // Check keywords
    for (const keyword of domain.keywords) {
      if (goal.includes(keyword)) {
        matchedKeywords.push(keyword)
        score += keyword.length > 5 ? 2 : 1 // Longer keywords = more specific
      }
    }

    // Check subdomains
    let matchedSubdomain: string | null = null
    for (const subdomain of domain.subdomains) {
      if (goal.includes(subdomain)) {
        matchedSubdomain = subdomain
        score += 3 // Subdomain match is significant
      }
    }

    // Calculate confidence (0-1)
    const maxPossibleScore = domain.keywords.length * 2 + domain.subdomains.length * 3
    const confidence = Math.min(score / 10, 1) // Normalize to 0-1

    return {
      domain: domain.domain,
      subdomain: matchedSubdomain,
      confidence,
      matchedKeywords,
    }
  }

  /**
   * Check if goal matches vague patterns
   */
  private isVagueGoal(goal: string): boolean {
    return VAGUE_PATTERNS.some(pattern => pattern.test(goal))
  }

  /**
   * Check if goal has specific indicators
   */
  private hasSpecificIndicators(goal: string): boolean {
    return SPECIFIC_INDICATORS.some(pattern => pattern.test(goal))
  }

  /**
   * Generate clarifying questions for vague goals
   */
  generateClarifyingQuestions(goal: string, domain: DomainMatch): string[] {
    const questions: string[] = []

    if (domain.domain === 'programming') {
      questions.push(
        'What do you want to build? (e.g., websites, mobile apps, automation scripts)',
        'What is your current programming experience level?',
        'Do you have a specific project or job role in mind?',
      )
    } else if (domain.domain === 'languages') {
      questions.push(
        'Why do you want to learn this language? (travel, work, exams, personal)',
        'What is your current level? (complete beginner, some knowledge, intermediate)',
        'How much time can you commit daily?',
      )
    } else {
      questions.push(
        'What specific outcome are you hoping to achieve?',
        'What is your current experience level with this?',
        'Is there a deadline or goal you are working towards?',
      )
    }

    return questions
  }

  /**
   * Detect subdomain from goal
   */
  detectSubdomain(goal: string, domain: DomainPlaybook): string | null {
    for (const subdomain of domain.subdomains) {
      if (goal.toLowerCase().includes(subdomain)) {
        return subdomain
      }
    }
    // Default to general subdomain
    return domain.subdomains.find(s => s.includes('general')) || domain.subdomains[0]
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let selectorInstance: DomainSelector | null = null

export function getDomainSelector(): DomainSelector {
  if (!selectorInstance) {
    selectorInstance = new DomainSelector()
  }
  return selectorInstance
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get domain context for AI prompt injection
 */
export function getDomainContext(goal: string): {
  domain: string
  subdomain: string | null
  expertPriorities: string[]
  wrongBeliefs: { belief: string; reality: string }[]
  failureModes: { trap: string; consequence: string }[]
  sequenceRules: { prerequisite: string; required_for: string }[]
  isVague: boolean
  clarifyingQuestions: string[]
} {
  const selector = getDomainSelector()
  const result = selector.selectDomain(goal)
  const playbook = selector.getPlaybook(result.primary.domain)

  if (!playbook) {
    // Use generic playbook
    const generic = selector.getGenericPlaybook()
    return {
      domain: 'generic',
      subdomain: null,
      expertPriorities: generic.universalPriorities,
      wrongBeliefs: generic.universalWrongBeliefs.map(wb => ({
        belief: wb.belief,
        reality: wb.reality,
      })),
      failureModes: generic.universalFailures.map(f => ({
        trap: f.trap,
        consequence: f.consequence,
      })),
      sequenceRules: [],
      isVague: result.isVague,
      clarifyingQuestions: selector.generateClarifyingQuestions(goal, result.primary),
    }
  }

  // Get subdomain
  const subdomain = result.primary.subdomain || selector.detectSubdomain(goal, playbook)
  const subdomainKey = subdomain || 'general-programming' // Fallback key

  // Extract relevant content
  const expertPriorities = playbook.expertPriorities[subdomainKey] ||
                          playbook.expertPriorities[Object.keys(playbook.expertPriorities)[0]] || []

  const wrongBeliefs = playbook.wrongBeliefs[subdomainKey] ||
                       playbook.wrongBeliefs[Object.keys(playbook.wrongBeliefs)[0]] || []

  // Flatten failure modes for the subdomain
  const subdomainFailures = playbook.failureModes[subdomainKey] || {}
  const failureModes: { trap: string; consequence: string }[] = []
  for (const topic of Object.keys(subdomainFailures)) {
    for (const failure of subdomainFailures[topic]) {
      failureModes.push({
        trap: failure.trap,
        consequence: failure.consequence,
      })
    }
  }

  const sequenceRules = playbook.sequenceRules[subdomainKey] || []

  return {
    domain: playbook.domain,
    subdomain,
    expertPriorities,
    wrongBeliefs: wrongBeliefs.map(wb => ({
      belief: wb.belief,
      reality: wb.reality,
    })),
    failureModes: failureModes.slice(0, 10), // Limit to avoid prompt bloat
    sequenceRules,
    isVague: result.isVague,
    clarifyingQuestions: result.clarificationNeeded
      ? selector.generateClarifyingQuestions(goal, result.primary)
      : [],
  }
}

export default DomainSelector
