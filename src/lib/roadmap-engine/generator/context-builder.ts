/**
 * CONTEXT BUILDER
 *
 * Builds the context that gets injected into AI prompts.
 * This transforms the Clerva Doctrine and Domain Playbooks
 * into prompt-ready format.
 */

import { ClervaDoctrine, ClervaPromises, ClervaRefuses, StepRequirements } from '../standards/clerva-doctrine'
import { getDomainContext } from '../domains'

// ============================================
// TYPES
// ============================================

export interface GenerationContext {
  /** The Clerva Standard - philosophy and rules */
  standard: string

  /** Domain-specific knowledge */
  domain: {
    name: string
    subdomain: string | null
    expertPriorities: string
    wrongBeliefs: string
    failureModes: string
    sequenceRules: string
  }

  /** Step structure requirements */
  stepRequirements: string

  /** Voice and tone guidelines */
  voice: string

  /** Whether clarification is needed */
  needsClarification: boolean

  /** Clarifying questions if needed */
  clarifyingQuestions: string[]
}

// ============================================
// CONTEXT BUILDER
// ============================================

export class ContextBuilder {
  /**
   * Build full context for roadmap generation
   */
  buildContext(goal: string): GenerationContext {
    const domainContext = getDomainContext(goal)

    return {
      standard: this.buildStandardContext(),
      domain: {
        name: domainContext.domain,
        subdomain: domainContext.subdomain,
        expertPriorities: this.formatExpertPriorities(domainContext.expertPriorities),
        wrongBeliefs: this.formatWrongBeliefs(domainContext.wrongBeliefs),
        failureModes: this.formatFailureModes(domainContext.failureModes),
        sequenceRules: this.formatSequenceRules(domainContext.sequenceRules),
      },
      stepRequirements: this.buildStepRequirements(),
      voice: this.buildVoiceGuidelines(),
      needsClarification: domainContext.isVague && domainContext.clarifyingQuestions.length > 0,
      clarifyingQuestions: domainContext.clarifyingQuestions,
    }
  }

  /**
   * Build the Clerva Standard section
   */
  private buildStandardContext(): string {
    return `
## CLERVA STANDARD (Non-Negotiable)

### Core Philosophy
${Object.entries(ClervaDoctrine.philosophy).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

### Quality Rules
- NO VAGUE VERBS: Never use ${ClervaDoctrine.qualityRules.noVagueVerbs.slice(0, 5).join(', ')} in titles or actions
- REQUIRED FIELDS: Every step MUST have ${ClervaDoctrine.qualityRules.requiredFields.join(', ')}
- MINIMUM MISTAKES: Each step needs at least ${ClervaDoctrine.qualityRules.minimumMistakes} specific mistakes with consequences
- MINIMUM ABILITIES: Each step unlocks at least ${ClervaDoctrine.qualityRules.minimumAbilities} ability
- CONSEQUENCES: Every warning MUST have a real-world consequence

### Clerva Promises
${Object.values(ClervaPromises).map(p => `- ${p}`).join('\n')}

### Clerva Refuses
${Object.values(ClervaRefuses).map(r => `- ${r}`).join('\n')}

### Forbidden Patterns (NEVER use these)
${ClervaDoctrine.forbidden.slice(0, 10).map(p => `- "${p}"`).join('\n')}
`.trim()
  }

  /**
   * Build step requirements section
   */
  private buildStepRequirements(): string {
    return `
## STEP STRUCTURE REQUIREMENTS

Every step MUST include:

1. **title** (REQUIRED)
   - Use action verb (never "understand", "learn", "know")
   - Format: "[Verb] [Specific Object]"
   - Example: "Build a REST API endpoint" NOT "Learn about APIs"

2. **whyFirst** (REQUIRED)
   - Explain why THIS step comes NOW, not later
   - Reference failure prevention
   - Minimum 50 characters

3. **description** (REQUIRED)
   - Clear directive, not suggestion
   - What to DO, not what to think about

4. **duration** (REQUIRED)
   - Specific minutes, not vague ranges
   - "15 min" or "20 min", NOT "1-2 hours"

5. **commonMistakes** (REQUIRED, minimum 2)
   - Each must be an object with:
     - trap: What user does wrong
     - consequence: What happens as a result
   - NOT just a list of strings

6. **selfTest** (REQUIRED)
   - challenge: Specific task to prove mastery
   - passCriteria: Clear, measurable pass condition
   - failCriteria: What failure looks like (optional but encouraged)

7. **abilities** (REQUIRED, minimum 1)
   - What user CAN DO after this step
   - Phrase as capabilities, not knowledge
   - Example: "Debug scope errors in JavaScript" NOT "Understand scope"
`.trim()
  }

  /**
   * Build voice guidelines
   */
  private buildVoiceGuidelines(): string {
    return `
## VOICE & TONE

Style: ${ClervaDoctrine.voice.style}

AVOID:
${ClervaDoctrine.voice.avoid.map(a => `- ${a}`).join('\n')}

PREFER:
${ClervaDoctrine.voice.prefer.map(p => `- ${p}`).join('\n')}
`.trim()
  }

  /**
   * Format expert priorities for prompt
   */
  private formatExpertPriorities(priorities: string[]): string {
    if (priorities.length === 0) return 'No specific expert priorities for this domain.'
    return `
## EXPERT PRIORITIES (What experts know that beginners don't)

${priorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

IMPORTANT: These priorities should influence step ordering and emphasis.
`.trim()
  }

  /**
   * Format wrong beliefs for prompt
   */
  private formatWrongBeliefs(beliefs: { belief: string; reality: string }[]): string {
    if (beliefs.length === 0) return 'No specific wrong beliefs identified for this domain.'
    return `
## COMMON WRONG BELIEFS (Address these in the roadmap)

${beliefs.map(b => `- BELIEF: "${b.belief}"\n  REALITY: ${b.reality}`).join('\n\n')}

IMPORTANT: The roadmap should correct these beliefs explicitly.
`.trim()
  }

  /**
   * Format failure modes for prompt
   */
  private formatFailureModes(modes: { trap: string; consequence: string }[]): string {
    if (modes.length === 0) return 'No specific failure modes identified for this domain.'
    return `
## KNOWN FAILURE MODES (Design steps to prevent these)

${modes.map(m => `- TRAP: ${m.trap}\n  CONSEQUENCE: ${m.consequence}`).join('\n\n')}

IMPORTANT: Each relevant failure mode should be addressed in commonMistakes of appropriate steps.
`.trim()
  }

  /**
   * Format sequence rules for prompt
   */
  private formatSequenceRules(rules: { prerequisite: string; required_for: string }[]): string {
    if (rules.length === 0) return 'No specific sequence constraints for this domain.'
    return `
## SEQUENCE CONSTRAINTS (These orderings are mandatory)

${rules.map(r => `- ${r.prerequisite} → ${r.required_for}`).join('\n')}

IMPORTANT: Violating these sequences will cause learning failure. Enforce strictly.
`.trim()
  }

  /**
   * Build the full prompt injection section
   */
  buildFullPromptInjection(goal: string): string {
    const context = this.buildContext(goal)

    return `
# CLERVA CONTENT GENERATION RULES

You are generating a Clerva roadmap. This is NOT a typical tutorial.
Clerva installs decision-making systems, not knowledge.

${context.standard}

---

## DOMAIN INTELLIGENCE: ${context.domain.name}${context.domain.subdomain ? ` (${context.domain.subdomain})` : ''}

${context.domain.expertPriorities}

${context.domain.wrongBeliefs}

${context.domain.failureModes}

${context.domain.sequenceRules}

---

${context.stepRequirements}

---

${context.voice}

---

## FINAL CHECKLIST (Verify before completing)

Before finalizing, verify:
1. [ ] No vague verbs in any title
2. [ ] Every step has whyFirst explaining why NOW
3. [ ] Every step has 2+ mistakes with trap AND consequence
4. [ ] Every step has selfTest with passCriteria
5. [ ] Every step unlocks at least 1 ability
6. [ ] Expert priorities are reflected in step order
7. [ ] Known failure modes are addressed in commonMistakes
8. [ ] Sequence constraints are respected
9. [ ] No forbidden patterns appear anywhere
10. [ ] Voice is calm, direct, slightly strict - no cheerleading
`.trim()
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let builderInstance: ContextBuilder | null = null

export function getContextBuilder(): ContextBuilder {
  if (!builderInstance) {
    builderInstance = new ContextBuilder()
  }
  return builderInstance
}

export default ContextBuilder
