/**
 * RESOURCE RESEARCH PHASE
 *
 * NEW Phase in the multi-phase AI pipeline.
 * Runs BEFORE execution to research real, specific resources for any topic.
 *
 * This phase:
 * 1. Takes the user's goal/topic
 * 2. Uses AI's knowledge to identify REAL resources that exist
 * 3. Returns specific resource names, platforms, and search queries
 * 4. These resources are then injected into the execution phase
 */

// ============================================
// TYPES
// ============================================

export interface ResourceItem {
  type: 'video' | 'article' | 'course' | 'book' | 'tool' | 'exercise' | 'community'
  title: string                    // Specific name: "Corey Schafer's Python Tutorials"
  platform: string                 // Platform name: "YouTube", "Coursera", "Official Docs"
  url?: string                     // Direct URL if known (optional)
  description: string              // Why this resource is good
  searchQuery: string              // How to find it if URL not provided
  credibility: string              // Why this is trustworthy: "2M subscribers", "Official docs"
  bestFor: string                  // Who should use this: "beginners", "visual learners"
}

export interface ResourceResearchResult {
  topic: string                    // The analyzed topic
  category: string                 // "programming", "data-science", "design", etc.

  // Official/Primary source
  officialDocs?: ResourceItem      // Official documentation if exists

  // Learning resources by type
  videos: ResourceItem[]           // YouTube tutorials, course previews
  articles: ResourceItem[]         // Blog posts, documentation, guides
  courses: ResourceItem[]          // Coursera, Udemy, free courses
  books: ResourceItem[]            // Recommended books
  tools: ResourceItem[]            // IDEs, software, practice platforms
  exercises: ResourceItem[]        // Practice sites, coding challenges
  communities: ResourceItem[]      // Reddit, Discord, forums

  // Quick start recommendation
  startWith: {
    resource: ResourceItem
    reason: string                 // "Best for beginners because..."
  }

  // Pro tips for this specific topic
  proTips: string[]                // "For Python, always use official docs first"
}

// ============================================
// RESOURCE RESEARCH PROMPT
// ============================================

export const RESOURCE_RESEARCH_PROMPT = `You are a senior educator and professional mentor who knows the REAL learning resources for any topic. Your job is to identify ACTUAL, EXISTING resources that professionals use.

=== YOUR TASK ===
Given a learning topic, research and return REAL, SPECIFIC resources that exist and are highly regarded in that field.

=== CRITICAL RULES ===

1. ONLY REAL RESOURCES: Every resource you mention MUST actually exist. No made-up names.
   - BAD: "Python Basics Tutorial" (generic, could be anything)
   - GOOD: "Corey Schafer's Python Tutorial Series" (specific, real person)

2. USE REAL NAMES: Include actual YouTuber names, course instructor names, book authors
   - BAD: "A popular Python course on Udemy"
   - GOOD: "Jose Portilla's 'Complete Python Bootcamp' on Udemy"

3. REAL PLATFORMS: Use actual platform names
   - For programming: docs.python.org, developer.mozilla.org, react.dev
   - For videos: YouTube (with channel names), Coursera, Udemy, LinkedIn Learning
   - For practice: LeetCode, HackerRank, Exercism, Codewars, freeCodeCamp

4. CREDIBILITY MARKERS: Include why each resource is trustworthy
   - Subscriber counts, star ratings, "official docs", author credentials

=== CATEGORY-SPECIFIC KNOWLEDGE ===

For PROGRAMMING topics, you should know:
- Python: docs.python.org, Real Python, Corey Schafer, Sentdex, Automate the Boring Stuff
- JavaScript: MDN Web Docs, javascript.info, Traversy Media, Web Dev Simplified, Kyle Cook (Web Dev Simplified)
- React: react.dev, Jack Herrington, Theo Browne, Kent C. Dodds, Epic React
- Node.js: nodejs.org docs, The Net Ninja, Traversy Media
- CSS: CSS-Tricks, Kevin Powell, MDN CSS
- General: freeCodeCamp, The Odin Project, Codecademy

For DATA SCIENCE topics:
- Python for DS: Kaggle Learn, DataCamp, sentdex
- ML: Andrew Ng's Coursera course, fast.ai, StatQuest with Josh Starmer
- Math: 3Blue1Brown, Khan Academy, MIT OpenCourseWare

For DESIGN topics:
- UI/UX: Figma tutorials, DesignCourse, Flux Academy, Nielsen Norman Group
- Tools: Figma, Adobe XD, Sketch
- Resources: Dribbble, Behance, Laws of UX

For BUSINESS/MARKETING topics:
- Marketing: HubSpot Academy, Google Digital Garage, Neil Patel
- Analytics: Google Analytics Academy, Coursera Business courses
- Tools: Google Analytics, Semrush, Ahrefs, Mailchimp

=== OUTPUT FORMAT ===
{
  "topic": "The exact topic analyzed",
  "category": "programming | data-science | design | business | music | language | other",

  "officialDocs": {
    "type": "article",
    "title": "Python Official Documentation",
    "platform": "docs.python.org",
    "url": "https://docs.python.org/3/tutorial/",
    "description": "The authoritative source for Python, maintained by Python core developers",
    "searchQuery": "python official documentation tutorial",
    "credibility": "Official source, maintained by Python Software Foundation",
    "bestFor": "Reference and deep understanding"
  },

  "videos": [
    {
      "type": "video",
      "title": "Corey Schafer's Python Tutorial for Beginners",
      "platform": "YouTube",
      "url": "https://www.youtube.com/c/Coreyms",
      "description": "Comprehensive Python series covering basics to advanced topics",
      "searchQuery": "Corey Schafer Python tutorial beginner",
      "credibility": "1M+ subscribers, industry professional, clear explanations",
      "bestFor": "Visual learners, beginners who want thorough explanations"
    }
  ],

  "articles": [...],
  "courses": [...],
  "books": [...],
  "tools": [...],
  "exercises": [...],
  "communities": [...],

  "startWith": {
    "resource": { ... the best starting resource ... },
    "reason": "Best for beginners because it's free, well-structured, and covers all fundamentals"
  },

  "proTips": [
    "Always start with official docs for Python - they're surprisingly readable",
    "Use Exercism for practice - you get real code reviews from mentors",
    "Join r/learnpython on Reddit for community support"
  ]
}

=== IMPORTANT ===
- Return at least 2-3 resources per category that applies to this topic
- If a category doesn't apply (e.g., no "official docs" for general life skills), omit it
- Prioritize FREE resources first, then paid options
- Include a mix of formats (video, text, interactive) for different learning styles

Output valid JSON only.`

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse and validate resource research response from AI
 */
export function parseResourceResearchResponse(response: string): ResourceResearchResult | null {
  try {
    const parsed = JSON.parse(response)

    // Validate required fields
    if (!parsed.topic || !parsed.category) {
      console.error('[ResourceResearch] Missing topic or category')
      return null
    }

    // Ensure arrays exist with defaults
    parsed.videos = parsed.videos || []
    parsed.articles = parsed.articles || []
    parsed.courses = parsed.courses || []
    parsed.books = parsed.books || []
    parsed.tools = parsed.tools || []
    parsed.exercises = parsed.exercises || []
    parsed.communities = parsed.communities || []

    // Ensure proTips exists
    parsed.proTips = parsed.proTips || []

    return parsed as ResourceResearchResult
  } catch (error) {
    console.error('[ResourceResearch] Failed to parse response:', error)
    return null
  }
}

/**
 * Create fallback resources if AI fails
 * Uses generic but real resources that work for most topics
 */
export function createFallbackResources(topic: string): ResourceResearchResult {
  return {
    topic,
    category: 'other',

    videos: [
      {
        type: 'video',
        title: `${topic} - Complete Beginner Guide`,
        platform: 'YouTube',
        description: 'Search for highly-rated beginner tutorials',
        searchQuery: `${topic} complete beginner tutorial ${new Date().getFullYear()}`,
        credibility: 'Look for videos with high view counts and positive comments',
        bestFor: 'Visual learners who prefer video content',
      },
      {
        type: 'video',
        title: `freeCodeCamp ${topic} Course`,
        platform: 'YouTube - freeCodeCamp',
        description: 'freeCodeCamp offers free, comprehensive courses on many topics',
        searchQuery: `freeCodeCamp ${topic} full course`,
        credibility: '7M+ subscribers, non-profit education organization',
        bestFor: 'Those who want structured, complete courses',
      },
    ],

    articles: [
      {
        type: 'article',
        title: `${topic} - Getting Started Guide`,
        platform: 'Google Search',
        description: 'Find official documentation or authoritative guides',
        searchQuery: `${topic} official documentation getting started`,
        credibility: 'Prioritize .org, .edu, or official product sites',
        bestFor: 'Those who prefer reading and reference material',
      },
    ],

    courses: [
      {
        type: 'course',
        title: `${topic} Course on Coursera`,
        platform: 'Coursera',
        description: 'University-backed courses with certificates',
        searchQuery: `${topic} Coursera course`,
        credibility: 'Courses from top universities, often free to audit',
        bestFor: 'Those who want structured learning with credentials',
      },
    ],

    books: [],

    tools: [],

    exercises: [
      {
        type: 'exercise',
        title: `Practice ${topic}`,
        platform: 'Various',
        description: 'Hands-on practice is essential for mastery',
        searchQuery: `${topic} practice exercises online free`,
        credibility: 'Look for interactive platforms with feedback',
        bestFor: 'Those who learn by doing',
      },
    ],

    communities: [
      {
        type: 'community',
        title: `r/learn${topic.replace(/\s+/g, '')}`,
        platform: 'Reddit',
        description: 'Reddit communities for learners',
        searchQuery: `reddit learn ${topic}`,
        credibility: 'Active communities with peer support',
        bestFor: 'Getting answers to questions and staying motivated',
      },
    ],

    startWith: {
      resource: {
        type: 'video',
        title: `${topic} - Beginner Tutorial`,
        platform: 'YouTube',
        description: 'Start with a well-rated video tutorial',
        searchQuery: `${topic} beginner tutorial ${new Date().getFullYear()}`,
        credibility: 'Choose videos with high engagement',
        bestFor: 'Getting started quickly',
      },
      reason: 'Videos are great for getting an overview before diving deeper into documentation or courses',
    },

    proTips: [
      'Start with one resource and complete it before jumping to another',
      'Take notes in your own words to reinforce learning',
      'Practice what you learn immediately - don\'t just watch/read passively',
    ],
  }
}

/**
 * Format resources for injection into execution prompt
 */
export function formatResourcesForExecution(resources: ResourceResearchResult): string {
  const sections: string[] = []

  sections.push(`=== RESEARCHED RESOURCES FOR: ${resources.topic} ===`)
  sections.push(`Category: ${resources.category}`)
  sections.push('')

  // Official docs
  if (resources.officialDocs) {
    sections.push(`OFFICIAL DOCUMENTATION:`)
    sections.push(`- ${resources.officialDocs.title} (${resources.officialDocs.platform})`)
    sections.push(`  ${resources.officialDocs.description}`)
    if (resources.officialDocs.url) {
      sections.push(`  URL: ${resources.officialDocs.url}`)
    }
    sections.push('')
  }

  // Videos
  if (resources.videos.length > 0) {
    sections.push(`VIDEO RESOURCES:`)
    resources.videos.forEach(v => {
      sections.push(`- ${v.title} on ${v.platform}`)
      sections.push(`  ${v.description}`)
      sections.push(`  Credibility: ${v.credibility}`)
      if (v.url) sections.push(`  URL: ${v.url}`)
    })
    sections.push('')
  }

  // Articles
  if (resources.articles.length > 0) {
    sections.push(`ARTICLES/DOCUMENTATION:`)
    resources.articles.forEach(a => {
      sections.push(`- ${a.title} (${a.platform})`)
      sections.push(`  ${a.description}`)
      if (a.url) sections.push(`  URL: ${a.url}`)
    })
    sections.push('')
  }

  // Courses
  if (resources.courses.length > 0) {
    sections.push(`COURSES:`)
    resources.courses.forEach(c => {
      sections.push(`- ${c.title} on ${c.platform}`)
      sections.push(`  ${c.description}`)
      sections.push(`  Credibility: ${c.credibility}`)
    })
    sections.push('')
  }

  // Exercises
  if (resources.exercises.length > 0) {
    sections.push(`PRACTICE PLATFORMS:`)
    resources.exercises.forEach(e => {
      sections.push(`- ${e.title} (${e.platform})`)
      sections.push(`  ${e.description}`)
    })
    sections.push('')
  }

  // Tools
  if (resources.tools.length > 0) {
    sections.push(`TOOLS TO USE:`)
    resources.tools.forEach(t => {
      sections.push(`- ${t.title} (${t.platform})`)
      sections.push(`  ${t.description}`)
    })
    sections.push('')
  }

  // Starting recommendation
  if (resources.startWith) {
    sections.push(`RECOMMENDED STARTING POINT:`)
    sections.push(`${resources.startWith.resource.title}`)
    sections.push(`Reason: ${resources.startWith.reason}`)
    sections.push('')
  }

  // Pro tips
  if (resources.proTips.length > 0) {
    sections.push(`PRO TIPS FOR THIS TOPIC:`)
    resources.proTips.forEach(tip => {
      sections.push(`- ${tip}`)
    })
  }

  return sections.join('\n')
}
