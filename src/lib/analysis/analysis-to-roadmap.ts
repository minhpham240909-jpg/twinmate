/**
 * ANALYSIS TO ROADMAP INTEGRATION
 *
 * Converts deep content analysis into roadmap generation input.
 * Creates intelligent learning paths from analyzed content.
 */

import { DeepAnalysisResult, formatAnalysisForRoadmap } from './deep-content-analyzer'

// ============================================
// TYPES
// ============================================

export interface AnalysisRoadmapInput {
  analysis: DeepAnalysisResult
  userGoal?: string
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
  focusAreas?: string[]
  targetMinutes?: number // User's time budget
}

export interface GeneratedRoadmapData {
  title: string
  goal: string
  subject: string
  overview: string
  estimatedMinutes: number
  steps: {
    order: number
    title: string
    description: string
    timeframe?: string
    method?: string
    avoid?: string
    doneWhen?: string
    duration: number
    resources?: {
      type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
      title: string
      description?: string
      searchQuery?: string
    }[]
  }[]
  pitfalls: string[]
  successLooksLike: string
}

// ============================================
// MAIN CONVERSION
// ============================================

/**
 * Convert deep analysis result into roadmap generation data
 */
export function analysisToRoadmapData(input: AnalysisRoadmapInput): GeneratedRoadmapData {
  const { analysis, userGoal, userLevel = 'intermediate', focusAreas = [], targetMinutes } = input

  // Use analysis data to create roadmap
  const { overview, sections, learningContext, explanations } = analysis

  // Calculate time allocation
  const totalEstimatedMinutes = targetMinutes || learningContext.estimatedStudyMinutes || 60
  const stepCount = Math.max(sections.length, learningContext.keyConcepts.length, 3)
  const minutesPerStep = Math.round(totalEstimatedMinutes / stepCount)

  // Generate steps from analysis
  const steps = generateStepsFromAnalysis(
    analysis,
    stepCount,
    minutesPerStep,
    focusAreas,
    userLevel
  )

  // Build the roadmap data
  return {
    title: `Master: ${overview.mainTopic}`,
    goal: userGoal || `Understand and master ${overview.mainTopic}`,
    subject: overview.subject,
    overview: explanations.summary,
    estimatedMinutes: totalEstimatedMinutes,
    steps,
    pitfalls: explanations.commonMistakes.slice(0, 5),
    successLooksLike: generateSuccessCriteria(analysis, userLevel),
  }
}

/**
 * Generate roadmap steps from analysis
 */
function generateStepsFromAnalysis(
  analysis: DeepAnalysisResult,
  targetStepCount: number,
  minutesPerStep: number,
  focusAreas: string[],
  userLevel: string
): GeneratedRoadmapData['steps'] {
  const steps: GeneratedRoadmapData['steps'] = []
  const { sections, learningContext, overview, diagrams } = analysis

  // Step 1: Prerequisites (if any)
  if (learningContext.prerequisites.length > 0) {
    steps.push({
      order: 1,
      title: 'Review Prerequisites',
      description: `Before diving into ${overview.mainTopic}, make sure you understand these foundational concepts: ${learningContext.prerequisites.join(', ')}`,
      timeframe: 'First',
      method: 'Quick review or refresher on each prerequisite concept. Identify any gaps.',
      avoid: 'Skipping this step if you feel confident - even a quick review helps.',
      doneWhen: 'You can explain each prerequisite concept in your own words.',
      duration: Math.min(minutesPerStep, 15),
      resources: learningContext.prerequisites.slice(0, 3).map(prereq => ({
        type: 'article' as const,
        title: `Review: ${prereq}`,
        description: `Refresh your understanding of ${prereq}`,
        searchQuery: `${prereq} explained simply`,
      })),
    })
  }

  // Step 2: Overview understanding
  steps.push({
    order: steps.length + 1,
    title: `Understand the Big Picture of ${overview.mainTopic}`,
    description: analysis.explanations.summary,
    timeframe: 'Early',
    method: learningContext.suggestedApproach,
    avoid: 'Getting lost in details before understanding the overall structure.',
    doneWhen: 'You can explain what this topic is about and why it matters.',
    duration: minutesPerStep,
    resources: [{
      type: 'article' as const,
      title: `Introduction to ${overview.mainTopic}`,
      searchQuery: `what is ${overview.mainTopic} introduction`,
    }],
  })

  // Steps 3+: Content sections (critical and important first)
  const sortedSections = [...sections].sort((a, b) => {
    const order = { critical: 0, important: 1, supplementary: 2 }
    return order[a.importance] - order[b.importance]
  })

  // Filter to focus areas if specified
  const relevantSections = focusAreas.length > 0
    ? sortedSections.filter(s =>
        focusAreas.some(focus =>
          s.title.toLowerCase().includes(focus.toLowerCase()) ||
          s.concepts.some(c => c.toLowerCase().includes(focus.toLowerCase()))
        )
      )
    : sortedSections

  // Add section-based steps
  const sectionsToInclude = relevantSections.slice(0, targetStepCount - steps.length - 1)

  for (const section of sectionsToInclude) {
    const isAdvanced = section.importance === 'critical' && userLevel === 'advanced'

    steps.push({
      order: steps.length + 1,
      title: section.title,
      description: section.content,
      timeframe: section.importance === 'critical' ? 'Core learning' : 'After core concepts',
      method: getMethodForSection(section, userLevel),
      avoid: getAvoidForSection(section),
      doneWhen: getDoneWhenForSection(section),
      duration: isAdvanced ? minutesPerStep * 1.5 : minutesPerStep,
      resources: section.concepts.slice(0, 2).map(concept => ({
        type: 'article' as const,
        title: concept,
        description: `Deep dive into ${concept}`,
        searchQuery: `${concept} ${overview.mainTopic} explained`,
      })),
    })
  }

  // Add diagram analysis step if there are diagrams
  if (diagrams && diagrams.length > 0) {
    steps.push({
      order: steps.length + 1,
      title: 'Understand Visual Elements',
      description: `Analyze and understand the diagrams and visual content: ${diagrams.map(d => d.type).join(', ')}. Key insights: ${diagrams.flatMap(d => d.keyInsights).slice(0, 3).join('; ')}`,
      timeframe: 'During study',
      method: 'Study each diagram carefully. Trace the relationships between components.',
      avoid: 'Glancing over visuals without truly understanding them.',
      doneWhen: 'You can recreate or explain each diagram from memory.',
      duration: minutesPerStep,
    })
  }

  // Final step: Practice and verify understanding
  steps.push({
    order: steps.length + 1,
    title: 'Practice and Verify Understanding',
    description: `Apply what you learned about ${overview.mainTopic}. Key concepts to verify: ${learningContext.keyConcepts.slice(0, 5).join(', ')}`,
    timeframe: 'Final',
    method: 'Test yourself on key concepts. Try to explain them to someone else or write them down.',
    avoid: 'Assuming you understand without testing yourself.',
    doneWhen: learningContext.learningObjectives.length > 0
      ? `You can: ${learningContext.learningObjectives.slice(0, 3).join(', ')}`
      : `You can confidently explain ${overview.mainTopic} and apply the concepts.`,
    duration: minutesPerStep,
    resources: [{
      type: 'exercise' as const,
      title: 'Self-Assessment',
      description: `Test your understanding of ${overview.mainTopic}`,
      searchQuery: `${overview.mainTopic} practice problems quiz`,
    }],
  })

  return steps
}

/**
 * Generate method suggestion based on section content
 */
function getMethodForSection(
  section: { title: string; content: string; importance: string; concepts: string[] },
  userLevel: string
): string {
  if (section.importance === 'critical') {
    return 'Take detailed notes. Work through examples. Spend extra time on this.'
  }
  if (userLevel === 'beginner') {
    return 'Read carefully. Pause frequently to ensure understanding.'
  }
  return 'Active reading with note-taking. Connect to concepts you already know.'
}

/**
 * Generate avoid suggestion based on section
 */
function getAvoidForSection(
  section: { title: string; content: string; importance: string }
): string {
  if (section.importance === 'critical') {
    return 'Rushing through this section. Take your time - this is essential.'
  }
  if (section.importance === 'supplementary') {
    return 'Spending too much time here at the expense of core concepts.'
  }
  return 'Passive reading without engaging with the material.'
}

/**
 * Generate done-when criteria based on section
 */
function getDoneWhenForSection(
  section: { title: string; concepts: string[] }
): string {
  if (section.concepts.length > 0) {
    return `You can explain: ${section.concepts.slice(0, 3).join(', ')}`
  }
  return `You understand ${section.title} and can explain it in your own words.`
}

/**
 * Generate success criteria based on analysis
 */
function generateSuccessCriteria(analysis: DeepAnalysisResult, userLevel: string): string {
  const { learningContext, overview } = analysis

  if (learningContext.learningObjectives.length > 0) {
    return `Success: You can ${learningContext.learningObjectives[0].toLowerCase()}. You understand ${overview.mainTopic} well enough to apply it.`
  }

  switch (userLevel) {
    case 'beginner':
      return `Success: You understand the fundamentals of ${overview.mainTopic} and can explain the main concepts.`
    case 'advanced':
      return `Success: You have deep understanding of ${overview.mainTopic} and can apply it to complex problems.`
    default:
      return `Success: You can confidently work with ${overview.mainTopic} and explain it to others.`
  }
}

// ============================================
// CONTEXT FORMATTING
// ============================================

/**
 * Format analysis for inclusion in AI roadmap generation prompt
 */
export function formatAnalysisContext(analysis: DeepAnalysisResult): string {
  return formatAnalysisForRoadmap(analysis)
}

/**
 * Create enhanced prompt context from analysis
 */
export function createEnhancedPromptContext(analysis: DeepAnalysisResult): string {
  const { overview, sections, learningContext, explanations, diagrams } = analysis

  let context = `
=== CONTENT ANALYSIS RESULTS ===

TOPIC: ${overview.mainTopic}
SUBJECT: ${overview.subject}
COMPLEXITY: ${overview.complexity}

SUMMARY:
${explanations.summary}

KEY CONCEPTS TO MASTER:
${learningContext.keyConcepts.map(c => `- ${c}`).join('\n')}

PREREQUISITES NEEDED:
${learningContext.prerequisites.length > 0
  ? learningContext.prerequisites.map(p => `- ${p}`).join('\n')
  : '- None identified'}

CONTENT SECTIONS (${sections.length} total):
${sections.map(s => `- [${s.importance.toUpperCase()}] ${s.title}`).join('\n')}

LEARNING OBJECTIVES:
${learningContext.learningObjectives.map(o => `- ${o}`).join('\n')}

SUGGESTED APPROACH:
${learningContext.suggestedApproach}

ESTIMATED STUDY TIME: ${learningContext.estimatedStudyMinutes} minutes
`

  if (diagrams && diagrams.length > 0) {
    context += `
VISUAL CONTENT (${diagrams.length} items):
${diagrams.map(d => `- ${d.type}: ${d.description}`).join('\n')}
`
  }

  if (explanations.commonMistakes.length > 0) {
    context += `
COMMON MISTAKES TO AVOID:
${explanations.commonMistakes.map(m => `! ${m}`).join('\n')}
`
  }

  context += `
=== USE THIS CONTEXT TO CREATE A TARGETED LEARNING ROADMAP ===
`

  return context
}
