/**
 * CLERVA SMART GOAL ANALYZER
 *
 * Analyzes user goals and converts ANY goal into a learnable educational path.
 *
 * PHILOSOPHY:
 * - The app is educational - it teaches skills and knowledge
 * - ANY goal can be converted to something learnable
 * - Vague goals get clarified with options
 * - Long-term goals get broken into phases
 * - Non-educational requests (tracking, management) get converted to learning paths
 *   with a "coming soon" message for the tracking features
 *
 * GOAL TYPES:
 * - Direct Educational: "Learn Python" → Generate roadmap directly
 * - Vague Educational: "Get better at coding" → Ask for specifics
 * - Career/Life Goal: "Become CEO" → Convert to learnable skills
 * - Long-term: "4-year degree" → Multi-phase roadmap
 * - Non-Educational: "Track my calories" → Convert to learning + show coming soon
 */

import OpenAI from 'openai'

// ============================================
// TYPES
// ============================================

export type GoalType =
  | 'direct_educational'    // Clear learning goal - can generate immediately
  | 'vague_educational'     // Needs clarification on what specifically to learn
  | 'career_goal'           // Career aspiration - convert to skills
  | 'life_goal'             // Life aspiration - convert to skills
  | 'long_term'             // Multi-year goal - needs phase breakdown
  | 'short_term'            // Days/weeks - standard roadmap
  | 'medium_term'           // 1-6 months - standard roadmap
  | 'non_educational'       // Not a learning request - convert + show coming soon

export type TimelineType = 'immediate' | 'short' | 'medium' | 'long' | 'multi_year'

// Domain categories for non-educational requests
export type NonEducationalDomain =
  | 'fitness'       // Workout tracking, calorie counting, etc.
  | 'productivity'  // Task management, timers, scheduling
  | 'finance'       // Budget tracking, expense logging
  | 'lifestyle'     // Meal planning, habit tracking
  | 'social'        // Chat, entertainment requests
  | 'utility'       // Calculations, conversions, bookings

export interface GoalAnalysis {
  originalGoal: string
  goalType: GoalType
  timelineType: TimelineType
  estimatedDuration: {
    min: number  // in days
    max: number  // in days
    display: string  // "2-4 weeks", "1-2 years", etc.
  }
  isDirectlyLearnable: boolean  // Can we generate a roadmap immediately?
  needsClarification: boolean   // Should we ask for more details?
  isNonEducational: boolean     // Is this a non-learning request?
  nonEducationalDomain?: NonEducationalDomain  // Which domain it belongs to
  featureComingSoon?: string    // Message about upcoming feature
  educationalAlternatives?: ClarificationOption[]  // Learning alternatives to offer
  clarificationOptions?: ClarificationOption[]  // Options to show user
  suggestedFocus?: string  // If we can guess what they want
  convertedGoal?: string   // The educational version of their goal
  phases?: GoalPhase[]     // For long-term goals
  confidence: 'high' | 'medium' | 'low'
  reasoning: string  // Why we analyzed it this way
}

export interface ClarificationOption {
  id: string
  label: string
  description: string
  icon?: string
  convertedGoal: string  // What the goal becomes if they pick this
}

export interface GoalPhase {
  order: number
  title: string
  timeframe: string  // "Year 1", "Semester 1", "Month 1-3"
  focus: string      // Main focus of this phase
  milestones: string[]
}

// ============================================
// CONFIGURATION
// ============================================

const OPENAI_TIMEOUT_MS = 12000
const MAX_GOAL_LENGTH = 500

// Singleton OpenAI client
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 1,
    })
  }
  return openaiClient
}

// ============================================
// PATTERN DETECTION (Fast, no AI needed)
// ============================================

const PATTERNS = {
  // Time indicators
  immediate: [
    /tomorrow/i, /today/i, /tonight/i, /this week/i, /next (few )?days/i,
    /asap/i, /urgent/i, /quickly/i, /fast/i, /right now/i
  ],
  shortTerm: [
    /\d+\s*(days?|weeks?)/i, /this month/i, /next week/i, /in a week/i,
    /next month/i, /few weeks/i
  ],
  mediumTerm: [
    /\d+\s*months?/i, /this semester/i, /this quarter/i, /next quarter/i,
    /this year/i, /few months/i, /half year/i, /6 months/i
  ],
  longTerm: [
    /\d+\s*years?/i, /college/i, /university/i, /degree/i, /graduate/i,
    /long.?term/i, /career/i, /eventually/i, /someday/i
  ],

  // Direct educational (can generate immediately)
  directEducational: [
    /^learn\s+/i, /^study\s+/i, /^understand\s+/i, /^master\s+/i,
    /^prepare\s+for/i, /^pass\s+(my\s+)?/i, /^ace\s+(my\s+)?/i,
    /^improve\s+(my\s+)?(knowledge|skills?|understanding)/i,
    /^practice\s+/i, /^get\s+better\s+at/i,
    /tutorial/i, /course/i, /basics/i, /fundamentals/i, /introduction/i
  ],

  // Career/life goals (need conversion)
  careerGoal: [
    /become\s+(a\s+)?/i, /get\s+a\s+job/i, /land\s+a\s+job/i,
    /start\s+(a\s+)?career/i, /work\s+(as|at|for)/i, /get\s+hired/i,
    /promotion/i, /raise/i, /manager/i, /director/i, /ceo/i, /cto/i,
    /president/i, /executive/i, /leader/i, /entrepreneur/i, /founder/i
  ],
  lifeGoal: [
    /rich/i, /wealthy/i, /millionaire/i, /successful/i, /famous/i,
    /happy/i, /better\s+life/i, /change\s+my\s+life/i, /transform/i,
    /retire/i, /financial\s+freedom/i
  ],

  // Vague indicators (need clarification)
  vagueIndicators: [
    /better/i, /improve/i, /good\s+at/i, /more/i, /enhance/i,
    /^how\s+to/i, /^what\s+/i, /^help\s+/i
  ],

  // Specific subjects (indicates direct educational)
  specificSubjects: [
    // Programming
    /python/i, /javascript/i, /java(?!script)/i, /typescript/i, /react/i,
    /node\.?js/i, /sql/i, /html/i, /css/i, /coding/i, /programming/i,
    /web\s*dev/i, /mobile\s*dev/i, /app\s*dev/i, /software/i,
    // Math/Science
    /math/i, /algebra/i, /calculus/i, /geometry/i, /statistics/i,
    /physics/i, /chemistry/i, /biology/i, /science/i,
    // Languages
    /english/i, /spanish/i, /french/i, /german/i, /chinese/i,
    /japanese/i, /korean/i, /language/i,
    // Business
    /marketing/i, /sales/i, /accounting/i, /finance/i, /economics/i,
    /business/i, /management/i, /excel/i, /powerpoint/i,
    // Creative
    /guitar/i, /piano/i, /music/i, /drawing/i, /painting/i, /art/i,
    /photography/i, /video/i, /design/i, /writing/i,
    // Academic
    /sat/i, /act/i, /gre/i, /gmat/i, /mcat/i, /lsat/i, /exam/i, /test/i,
    // Fitness/Health (as learning topics)
    /nutrition/i, /anatomy/i, /physiology/i, /kinesiology/i,
    /sports\s*science/i, /exercise\s*science/i,
  ],

  // ============================================
  // NON-EDUCATIONAL PATTERNS
  // These are requests for tracking/management features, NOT learning
  // IMPORTANT: Learning indicators override these!
  // ============================================

  // Fitness tracking (NOT learning)
  fitnessTracking: [
    /^track\s+(my\s+)?(calories|meals?|food|weight|sleep|steps|workouts?|exercises?|runs?|miles?|water|hydration)/i,
    /^log\s+(my\s+)?(calories|meals?|food|weight|sleep|steps|workouts?|exercises?|runs?|miles?|water|hydration)/i,
    /^record\s+(my\s+)?(calories|meals?|food|weight|sleep|steps|workouts?|exercises?|runs?|miles?|water|hydration)/i,
    /^monitor\s+(my\s+)?(calories|meals?|food|weight|sleep|steps|workouts?|exercises?|heart\s*rate|blood\s*pressure|health)/i,
    /^count\s+(my\s+)?(calories|steps|macros)/i,
  ],

  // Productivity/task management (NOT learning)
  productivityTracking: [
    /^manage\s+(my\s+)?(tasks?|to-?dos?|schedule|calendar|appointments?)/i,
    /^organize\s+(my\s+)?(tasks?|to-?dos?|schedule|calendar|life|day|week)/i,
    /^schedule\s+(my\s+)?(day|week|appointments?|meetings?|tasks?)/i,
    /^remind\s+(me|myself)\s+(to|about)/i,
    /^set\s+(a\s+)?(reminder|alarm|timer|pomodoro)/i,
    /^start\s+(a\s+)?(timer|pomodoro|focus\s*session)/i,
  ],

  // Finance tracking (NOT learning)
  financeTracking: [
    /^track\s+(my\s+)?(spending|expenses?|budget|money|income|savings?)/i,
    /^log\s+(my\s+)?(spending|expenses?|purchases?|transactions?)/i,
    /^manage\s+(my\s+)?(finances?|money|budget|bills?|subscriptions?)/i,
    /^record\s+(my\s+)?(expenses?|spending|purchases?)/i,
  ],

  // Lifestyle/planning (NOT learning)
  lifestyleRequests: [
    /^(create|make|build|generate)\s+(a\s+)?(meal\s*plan|diet\s*plan|workout\s*plan|exercise\s*plan|fitness\s*plan|budget|shopping\s*list|grocery\s*list|to-?do\s*list|task\s*list|packing\s*list)/i,
    /^plan\s+(my\s+)?(day|week|month|meals?|menu|trip|vacation|wedding|party|event)/i,
  ],

  // Social/chat requests (NOT learning)
  socialRequests: [
    /^(just\s+)?(chat|talk|converse|hang\s*out)\s*(with\s+me)?$/i,
    /^(tell\s+me\s+)?(a\s+)?(joke|story|fun\s*fact)$/i,
    /^(play\s+)?(a\s+)?(game|trivia|quiz)\s*(with\s+me)?$/i,
    /^(be\s+my\s+)?(friend|companion|buddy)$/i,
    /^(entertain|amuse)\s+me$/i,
  ],

  // Utility requests (NOT learning)
  utilityRequests: [
    /^(find|search|look\s*for|recommend)\s+(a\s+)?(restaurant|hotel|flight|doctor|dentist|mechanic|plumber|recipe|movie|show)/i,
    /^(book|reserve|order)\s+(a\s+)?(table|room|flight|ticket|appointment|ride|uber|lyft|food|delivery)/i,
    /^(buy|purchase|shop\s+for|order)\s+/i,
    /^(calculate|convert)\s+(my\s+)?(bmi|calories|tip|currency|units?|temperature)/i,
  ],

  // IMPORTANT: Words that indicate LEARNING even if combined with fitness/productivity
  // These OVERRIDE non-educational detection
  learningIndicators: [
    /learn\s+(about|how|to|the)/i,
    /study\s+(the|about|for)/i,
    /understand\s+(how|what|the|why)/i,
    /teach\s+(me|yourself)/i,
    /course\s+(on|about|in|for)/i,
    /tutorial\s+(on|about|for)?/i,
    /fundamentals?\s+(of|in|about)/i,
    /basics?\s+(of|in|about)/i,
    /theory\s+(of|behind|about)/i,
    /science\s+(of|behind|about)/i,
    /principles?\s+(of|in|about)/i,
    /how\s+(does|do|is|are)\s+.*\s+work/i,
    /what\s+is\s+(the|a)/i,
    /explain\s+(how|what|the|why)/i,
    /introduction\s+to/i,
    /beginner'?s?\s+guide/i,
    /master(ing)?\s+(the|a)?/i,
    /certification\s+(in|for)/i,
    /degree\s+in/i,
    /deep\s*dive/i,
    /comprehensive/i,
  ]
}

// ============================================
// EDUCATIONAL ALTERNATIVES FOR NON-EDUCATIONAL REQUESTS
// When user asks to track/manage, offer learning paths instead
// ============================================

const EDUCATIONAL_ALTERNATIVES: Record<NonEducationalDomain, {
  comingSoonMessage: string
  alternatives: ClarificationOption[]
}> = {
  fitness: {
    comingSoonMessage: 'Fitness tracking is planned for a future update.',
    alternatives: [
      { id: 'nutrition_science', label: 'Nutrition Science', description: 'Learn how food affects your body', icon: '🥗', convertedGoal: 'Learn nutrition science and dietary principles' },
      { id: 'exercise_physiology', label: 'Exercise Physiology', description: 'Understand how exercise affects your body', icon: '💪', convertedGoal: 'Learn exercise physiology and training principles' },
      { id: 'sports_science', label: 'Sports Science', description: 'Scientific approach to athletic performance', icon: '🏃', convertedGoal: 'Learn sports science fundamentals' },
      { id: 'anatomy', label: 'Human Anatomy', description: 'Understand how your body works', icon: '🫀', convertedGoal: 'Learn human anatomy and physiology basics' },
    ]
  },
  productivity: {
    comingSoonMessage: 'Productivity tools are planned for a future update.',
    alternatives: [
      { id: 'time_management', label: 'Time Management', description: 'Learn proven time management systems', icon: '⏰', convertedGoal: 'Learn time management systems and techniques' },
      { id: 'productivity_systems', label: 'Productivity Systems', description: 'GTD, Pomodoro, and other frameworks', icon: '📋', convertedGoal: 'Learn productivity systems like GTD and Pomodoro' },
      { id: 'focus_science', label: 'Science of Focus', description: 'How attention and concentration work', icon: '🎯', convertedGoal: 'Learn the science of focus and deep work' },
      { id: 'habit_formation', label: 'Habit Formation', description: 'Build lasting habits that stick', icon: '🔄', convertedGoal: 'Learn the psychology of habit formation' },
    ]
  },
  finance: {
    comingSoonMessage: 'Finance tracking is planned for a future update.',
    alternatives: [
      { id: 'personal_finance', label: 'Personal Finance', description: 'Budgeting, saving, and investing basics', icon: '💰', convertedGoal: 'Learn personal finance fundamentals' },
      { id: 'investing', label: 'Investing Fundamentals', description: 'Stocks, bonds, and portfolio basics', icon: '📈', convertedGoal: 'Learn investing fundamentals' },
      { id: 'budgeting', label: 'Budgeting Methods', description: 'Different approaches to managing money', icon: '📊', convertedGoal: 'Learn budgeting methods and financial planning' },
      { id: 'financial_literacy', label: 'Financial Literacy', description: 'Understanding money and markets', icon: '🏦', convertedGoal: 'Learn financial literacy and money management' },
    ]
  },
  lifestyle: {
    comingSoonMessage: 'Lifestyle planning tools are planned for a future update.',
    alternatives: [
      { id: 'meal_planning', label: 'Meal Planning Skills', description: 'Learn to plan nutritious meals', icon: '🍽️', convertedGoal: 'Learn meal planning and nutrition basics' },
      { id: 'organization', label: 'Organization Systems', description: 'Methods for organizing your life', icon: '📁', convertedGoal: 'Learn organization systems and methods' },
      { id: 'lifestyle_design', label: 'Lifestyle Design', description: 'Intentional living principles', icon: '✨', convertedGoal: 'Learn lifestyle design principles' },
    ]
  },
  social: {
    comingSoonMessage: 'Clerva focuses on learning and education.',
    alternatives: [
      { id: 'communication', label: 'Communication Skills', description: 'Improve how you connect with others', icon: '💬', convertedGoal: 'Learn effective communication skills' },
      { id: 'social_skills', label: 'Social Intelligence', description: 'Understanding social dynamics', icon: '🤝', convertedGoal: 'Learn social intelligence and interpersonal skills' },
      { id: 'public_speaking', label: 'Public Speaking', description: 'Speak confidently in any setting', icon: '🎤', convertedGoal: 'Learn public speaking and presentation skills' },
    ]
  },
  utility: {
    comingSoonMessage: 'Clerva focuses on learning and education.',
    alternatives: [
      { id: 'research_skills', label: 'Research Skills', description: 'Find information effectively', icon: '🔍', convertedGoal: 'Learn research and information literacy skills' },
      { id: 'critical_thinking', label: 'Critical Thinking', description: 'Analyze and evaluate information', icon: '🧠', convertedGoal: 'Learn critical thinking and analysis skills' },
    ]
  }
}

// ============================================
// CLARIFICATION OPTIONS DATABASE
// ============================================

const CLARIFICATION_OPTIONS: Record<string, ClarificationOption[]> = {
  // For career goals
  'become_executive': [
    { id: 'leadership', label: 'Leadership & Management', description: 'Lead teams and make strategic decisions', icon: '👥', convertedGoal: 'Learn leadership and management skills for executive roles' },
    { id: 'business_strategy', label: 'Business Strategy', description: 'Strategic thinking and business planning', icon: '📊', convertedGoal: 'Learn business strategy and strategic planning' },
    { id: 'communication', label: 'Executive Communication', description: 'Public speaking, negotiation, influence', icon: '🎤', convertedGoal: 'Master executive communication and public speaking' },
    { id: 'finance', label: 'Financial Acumen', description: 'Understand business finances and metrics', icon: '💰', convertedGoal: 'Learn business finance and financial analysis' },
  ],
  'become_developer': [
    { id: 'web_frontend', label: 'Frontend Web Development', description: 'Build user interfaces with HTML, CSS, JavaScript', icon: '🎨', convertedGoal: 'Learn frontend web development (HTML, CSS, JavaScript, React)' },
    { id: 'web_backend', label: 'Backend Development', description: 'Build servers and APIs', icon: '⚙️', convertedGoal: 'Learn backend development (Node.js, databases, APIs)' },
    { id: 'mobile', label: 'Mobile App Development', description: 'Build iOS and Android apps', icon: '📱', convertedGoal: 'Learn mobile app development' },
    { id: 'fullstack', label: 'Full Stack Development', description: 'Build complete applications end-to-end', icon: '🚀', convertedGoal: 'Learn full stack web development' },
  ],
  'improve_business': [
    { id: 'marketing', label: 'Marketing & Customer Acquisition', description: 'Attract and convert customers', icon: '📢', convertedGoal: 'Learn marketing strategies and customer acquisition' },
    { id: 'operations', label: 'Operations & Efficiency', description: 'Streamline processes and reduce costs', icon: '⚡', convertedGoal: 'Learn business operations and process optimization' },
    { id: 'sales', label: 'Sales & Revenue', description: 'Close more deals and increase revenue', icon: '💵', convertedGoal: 'Learn sales techniques and revenue growth strategies' },
    { id: 'team', label: 'Team & Leadership', description: 'Build and lead high-performing teams', icon: '👥', convertedGoal: 'Learn team building and leadership for business' },
    { id: 'product', label: 'Product Development', description: 'Improve your product or service', icon: '🛠️', convertedGoal: 'Learn product development and improvement strategies' },
  ],
  'political_career': [
    { id: 'political_science', label: 'Political Science & Government', description: 'Understand how governments work', icon: '🏛️', convertedGoal: 'Learn political science and government systems' },
    { id: 'public_speaking', label: 'Public Speaking & Rhetoric', description: 'Persuade and inspire audiences', icon: '🎤', convertedGoal: 'Master public speaking and rhetorical skills' },
    { id: 'law', label: 'Law & Policy', description: 'Understand legal frameworks and policy making', icon: '⚖️', convertedGoal: 'Learn law and public policy fundamentals' },
    { id: 'campaign', label: 'Campaign Strategy', description: 'Run effective political campaigns', icon: '📊', convertedGoal: 'Learn political campaign strategy and management' },
  ],
  'vague_coding': [
    { id: 'web', label: 'Web Development', description: 'Build websites and web applications', icon: '🌐', convertedGoal: 'Learn web development from scratch' },
    { id: 'python', label: 'Python Programming', description: 'Versatile language for data, AI, automation', icon: '🐍', convertedGoal: 'Learn Python programming fundamentals' },
    { id: 'mobile', label: 'Mobile Apps', description: 'Build apps for phones and tablets', icon: '📱', convertedGoal: 'Learn mobile app development' },
    { id: 'data', label: 'Data Science', description: 'Analyze data and build ML models', icon: '📊', convertedGoal: 'Learn data science and machine learning' },
  ],
  'vague_improve': [
    { id: 'skills', label: 'Specific Skill', description: 'Tell us what skill you want to improve', icon: '🎯', convertedGoal: '' },
    { id: 'subject', label: 'Academic Subject', description: 'A school/college subject', icon: '📚', convertedGoal: '' },
    { id: 'career', label: 'Career/Job Skills', description: 'Skills for work or career growth', icon: '💼', convertedGoal: '' },
    { id: 'hobby', label: 'Hobby/Interest', description: 'Something you enjoy doing', icon: '🎨', convertedGoal: '' },
  ],
}

// ============================================
// NON-EDUCATIONAL DETECTION
// ============================================

/**
 * Check if the goal has learning indicators that override non-educational patterns
 */
function hasLearningIndicators(goal: string): boolean {
  return PATTERNS.learningIndicators.some(p => p.test(goal))
}

/**
 * Detect if goal is a non-educational request and which domain it belongs to
 */
function detectNonEducational(goal: string): { isNonEducational: boolean; domain?: NonEducationalDomain } {
  const lower = goal.toLowerCase()

  // FIRST: Check if there are learning indicators - these OVERRIDE non-educational detection
  if (hasLearningIndicators(lower)) {
    return { isNonEducational: false }
  }

  // Check fitness tracking
  if (PATTERNS.fitnessTracking.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'fitness' }
  }

  // Check productivity tracking
  if (PATTERNS.productivityTracking.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'productivity' }
  }

  // Check finance tracking
  if (PATTERNS.financeTracking.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'finance' }
  }

  // Check lifestyle requests
  if (PATTERNS.lifestyleRequests.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'lifestyle' }
  }

  // Check social requests
  if (PATTERNS.socialRequests.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'social' }
  }

  // Check utility requests
  if (PATTERNS.utilityRequests.some(p => p.test(lower))) {
    return { isNonEducational: true, domain: 'utility' }
  }

  return { isNonEducational: false }
}

// ============================================
// FAST PATTERN ANALYSIS (No AI)
// ============================================

function detectTimeline(goal: string): TimelineType {
  const lower = goal.toLowerCase()

  if (PATTERNS.immediate.some(p => p.test(lower))) return 'immediate'
  if (PATTERNS.shortTerm.some(p => p.test(lower))) return 'short'
  if (PATTERNS.mediumTerm.some(p => p.test(lower))) return 'medium'
  if (PATTERNS.longTerm.some(p => p.test(lower))) return 'long'

  // Check for multi-year indicators
  const yearMatch = lower.match(/(\d+)\s*years?/i)
  if (yearMatch && parseInt(yearMatch[1]) >= 2) return 'multi_year'

  // Default to medium for unspecified
  return 'medium'
}

function isDirectlyLearnable(goal: string): boolean {
  const lower = goal.toLowerCase()

  // Has specific subject + educational verb = directly learnable
  const hasSubject = PATTERNS.specificSubjects.some(p => p.test(lower))
  const hasEducationalVerb = PATTERNS.directEducational.some(p => p.test(lower))

  return hasSubject || hasEducationalVerb
}

function detectGoalCategory(goal: string): 'career' | 'life' | 'educational' | 'vague' {
  const lower = goal.toLowerCase()

  if (PATTERNS.careerGoal.some(p => p.test(lower))) return 'career'
  if (PATTERNS.lifeGoal.some(p => p.test(lower))) return 'life'
  if (isDirectlyLearnable(goal)) return 'educational'

  return 'vague'
}

function estimateDuration(timeline: TimelineType): { min: number; max: number; display: string } {
  switch (timeline) {
    case 'immediate':
      return { min: 1, max: 7, display: '1-7 days' }
    case 'short':
      return { min: 7, max: 30, display: '1-4 weeks' }
    case 'medium':
      return { min: 30, max: 180, display: '1-6 months' }
    case 'long':
      return { min: 180, max: 365, display: '6-12 months' }
    case 'multi_year':
      return { min: 365, max: 1825, display: '1-5 years' }
    default:
      return { min: 30, max: 90, display: '1-3 months' }
  }
}

// ============================================
// AI-POWERED DEEP ANALYSIS
// ============================================

async function aiAnalyzeGoal(goal: string, isNonEducational: boolean = false): Promise<{
  clarificationCategory?: string
  suggestedFocus?: string
  convertedGoal?: string
  phases?: GoalPhase[]
  reasoning: string
}> {
  const openai = getOpenAI()

  const systemPrompt = isNonEducational
    ? `You are an expert educational advisor. The user has asked for something that isn't directly about learning (like tracking, management, or planning). Your job is to convert their request into a learnable educational path.

For example:
- "Track my calories" → "Learn nutrition science and dietary tracking methods"
- "Manage my tasks" → "Learn productivity systems and task management frameworks"
- "Create a workout plan" → "Learn exercise programming and workout design principles"

RESPOND IN JSON:
{
  "convertedGoal": "the educational version of their request",
  "suggestedFocus": "what specific learning topic you recommend",
  "reasoning": "brief explanation of why this learning path helps them"
}`
    : `You are an expert educational advisor. Analyze the user's goal and help convert it into a learnable educational path.

Your job is to:
1. Understand what they REALLY want to achieve
2. Identify what SKILLS/KNOWLEDGE they need to learn
3. If the goal is vague, identify what category of clarification to show
4. If it's a long-term goal, break it into phases

CLARIFICATION CATEGORIES (use these exact IDs):
- "become_executive" - CEO, president, executive, leader roles
- "become_developer" - programmer, developer, coder, software engineer
- "improve_business" - business improvement, make business better
- "political_career" - president of country, politician, government
- "vague_coding" - learn to code, programming, without specifics
- "vague_improve" - improve/get better without saying what

RESPOND IN JSON:
{
  "needsClarification": true/false,
  "clarificationCategory": "category_id or null",
  "suggestedFocus": "if you can guess what they want, suggest it",
  "convertedGoal": "the educational version of their goal",
  "isLongTerm": true/false,
  "phases": [
    { "order": 1, "title": "Phase name", "timeframe": "Year 1", "focus": "Main focus", "milestones": ["Milestone 1"] }
  ],
  "reasoning": "brief explanation of your analysis"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Goal: "${goal}"` }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })

    const response = JSON.parse(completion.choices[0]?.message?.content || '{}')

    return {
      clarificationCategory: response.needsClarification ? response.clarificationCategory : undefined,
      suggestedFocus: response.suggestedFocus,
      convertedGoal: response.convertedGoal,
      phases: response.isLongTerm ? response.phases : undefined,
      reasoning: response.reasoning || 'AI analysis completed'
    }
  } catch (error) {
    console.error('[Goal Analyzer] AI analysis failed:', error)
    return {
      reasoning: 'Fallback to pattern-based analysis'
    }
  }
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Analyze a user's goal and determine how to handle it.
 *
 * @param goal - The user's input goal
 * @param useAI - Whether to use AI for deep analysis (default: true)
 * @returns GoalAnalysis with all the information needed to proceed
 */
export async function analyzeGoal(
  goal: string,
  useAI: boolean = true
): Promise<GoalAnalysis> {
  const trimmedGoal = goal.trim().slice(0, MAX_GOAL_LENGTH)

  // Step 1: Check for non-educational requests FIRST
  const nonEduCheck = detectNonEducational(trimmedGoal)

  if (nonEduCheck.isNonEducational && nonEduCheck.domain) {
    // This is a non-educational request - convert to learning path
    const domainData = EDUCATIONAL_ALTERNATIVES[nonEduCheck.domain]

    // Use AI to get a better converted goal if enabled
    let convertedGoal: string | undefined
    let reasoning = `Non-educational request detected (${nonEduCheck.domain}). Converting to learning path.`

    if (useAI) {
      const aiResult = await aiAnalyzeGoal(trimmedGoal, true)
      convertedGoal = aiResult.convertedGoal
      reasoning = aiResult.reasoning || reasoning
    }

    return {
      originalGoal: trimmedGoal,
      goalType: 'non_educational',
      timelineType: 'medium',
      estimatedDuration: { min: 30, max: 90, display: '1-3 months' },
      isDirectlyLearnable: false,
      needsClarification: true,
      isNonEducational: true,
      nonEducationalDomain: nonEduCheck.domain,
      featureComingSoon: domainData.comingSoonMessage,
      educationalAlternatives: domainData.alternatives,
      clarificationOptions: domainData.alternatives,
      convertedGoal,
      confidence: 'high',
      reasoning
    }
  }

  // Step 2: Fast pattern-based analysis for educational goals
  const timeline = detectTimeline(trimmedGoal)
  const category = detectGoalCategory(trimmedGoal)
  const directlyLearnable = isDirectlyLearnable(trimmedGoal)
  const duration = estimateDuration(timeline)

  // Determine initial goal type
  let goalType: GoalType
  if (category === 'career') {
    goalType = timeline === 'multi_year' ? 'long_term' : 'career_goal'
  } else if (category === 'life') {
    goalType = 'life_goal'
  } else if (category === 'vague') {
    goalType = 'vague_educational'
  } else {
    goalType = timeline === 'multi_year' ? 'long_term' :
               timeline === 'long' ? 'medium_term' :
               timeline === 'medium' ? 'medium_term' : 'short_term'
  }

  // Step 3: AI deep analysis (if enabled)
  let aiResult: Awaited<ReturnType<typeof aiAnalyzeGoal>> | null = null
  if (useAI && (category === 'career' || category === 'life' || category === 'vague' || timeline === 'multi_year')) {
    aiResult = await aiAnalyzeGoal(trimmedGoal, false)
  }

  // Step 4: Build clarification options if needed
  let clarificationOptions: ClarificationOption[] | undefined
  if (aiResult?.clarificationCategory && CLARIFICATION_OPTIONS[aiResult.clarificationCategory]) {
    clarificationOptions = CLARIFICATION_OPTIONS[aiResult.clarificationCategory]
  }

  // Step 5: Determine if we need clarification
  const needsClarification = !directlyLearnable && (
    category === 'career' ||
    category === 'life' ||
    category === 'vague' ||
    !!clarificationOptions
  )

  // Step 6: Build final analysis
  const analysis: GoalAnalysis = {
    originalGoal: trimmedGoal,
    goalType,
    timelineType: timeline,
    estimatedDuration: duration,
    isDirectlyLearnable: directlyLearnable,
    needsClarification,
    isNonEducational: false,
    clarificationOptions,
    suggestedFocus: aiResult?.suggestedFocus,
    convertedGoal: aiResult?.convertedGoal,
    phases: aiResult?.phases,
    confidence: directlyLearnable ? 'high' : aiResult ? 'medium' : 'low',
    reasoning: aiResult?.reasoning || `Pattern analysis: ${category} goal, ${timeline} timeline`
  }

  return analysis
}

// ============================================
// HELPER: Get friendly message for goal type
// ============================================

export function getGoalMessage(analysis: GoalAnalysis): {
  title: string
  message: string
  subMessage?: string  // For "coming soon" notices
  tone: 'positive' | 'helpful' | 'encouraging' | 'informative'
} {
  // Handle non-educational requests with coming soon message
  if (analysis.isNonEducational && analysis.featureComingSoon) {
    return {
      title: 'Learning Path Available',
      message: 'Clerva focuses on education and learning. Select a related learning topic below.',
      subMessage: analysis.featureComingSoon,
      tone: 'informative'
    }
  }

  if (analysis.isDirectlyLearnable) {
    return {
      title: 'Goal Accepted',
      message: 'Generating roadmap.',
      tone: 'positive'
    }
  }

  if (analysis.goalType === 'career_goal' || analysis.goalType === 'life_goal') {
    return {
      title: 'Clarification Needed',
      message: `"${analysis.originalGoal}" requires specific skills. Select a focus area below.`,
      tone: 'helpful'
    }
  }

  if (analysis.goalType === 'vague_educational') {
    return {
      title: 'Specify Focus Area',
      message: 'Select a specific area to generate an effective roadmap.',
      tone: 'encouraging'
    }
  }

  if (analysis.goalType === 'long_term') {
    return {
      title: 'Long-term Goal Detected',
      message: 'This goal will be broken into phases for structured progress tracking.',
      tone: 'encouraging'
    }
  }

  return {
    title: 'Goal Accepted',
    message: 'Generating roadmap.',
    tone: 'positive'
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  CLARIFICATION_OPTIONS,
  EDUCATIONAL_ALTERNATIVES,
  detectTimeline,
  detectGoalCategory,
  detectNonEducational,
  hasLearningIndicators,
  isDirectlyLearnable,
  estimateDuration
}
