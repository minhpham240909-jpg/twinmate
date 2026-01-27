/**
 * VERIFIED LEARNING PLATFORMS DATABASE
 *
 * Curated list of high-quality, free/freemium educational platforms
 * with accurate URLs and subject mappings.
 *
 * Each platform is verified to be:
 * - Currently active and accessible
 * - Free or has substantial free content
 * - High quality and well-regarded
 */

export interface Platform {
  id: string
  name: string
  description: string
  url: string
  searchUrl?: string // URL pattern for searching (use {query} placeholder)
  icon: string // Emoji or icon identifier
  color: string // Brand color for UI
  subjects: string[] // What subjects this platform covers
  features: string[] // Key features
  pricing: 'free' | 'freemium' | 'paid'
  quality: number // 1-5 rating
}

// Comprehensive platform database
export const PLATFORMS: Platform[] = [
  // === MATH ===
  {
    id: 'khan_academy',
    name: 'Khan Academy',
    description: 'Free world-class education with practice exercises and videos',
    url: 'https://www.khanacademy.org',
    searchUrl: 'https://www.khanacademy.org/search?search_again=1&page_search_query={query}',
    icon: '📚',
    color: '#14BF96',
    subjects: ['math', 'algebra', 'geometry', 'calculus', 'statistics', 'trigonometry', 'pre-algebra', 'arithmetic', 'linear algebra', 'differential equations', 'science', 'physics', 'chemistry', 'biology', 'economics', 'finance', 'computing', 'history', 'grammar'],
    features: ['Video lessons', 'Practice exercises', 'Progress tracking', 'Personalized learning'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'desmos',
    name: 'Desmos',
    description: 'Beautiful, free graphing calculator and math tools',
    url: 'https://www.desmos.com/calculator',
    icon: '📈',
    color: '#2E7D32',
    subjects: ['math', 'algebra', 'calculus', 'geometry', 'trigonometry', 'graphing', 'functions'],
    features: ['Graphing calculator', 'Geometry tool', 'Interactive activities'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'wolfram_alpha',
    name: 'Wolfram Alpha',
    description: 'Computational knowledge engine for math and science',
    url: 'https://www.wolframalpha.com',
    searchUrl: 'https://www.wolframalpha.com/input?i={query}',
    icon: '🔬',
    color: '#DD1100',
    subjects: ['math', 'calculus', 'algebra', 'statistics', 'physics', 'chemistry', 'engineering'],
    features: ['Step-by-step solutions', 'Computation engine', 'Data analysis'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'mathway',
    name: 'Mathway',
    description: 'Math problem solver with step-by-step explanations',
    url: 'https://www.mathway.com',
    icon: '🧮',
    color: '#1976D2',
    subjects: ['math', 'algebra', 'calculus', 'trigonometry', 'statistics', 'pre-algebra'],
    features: ['Problem solver', 'Step-by-step solutions', 'Multiple math topics'],
    pricing: 'freemium',
    quality: 4,
  },
  {
    id: 'brilliant',
    name: 'Brilliant',
    description: 'Interactive problem-solving for math and science',
    url: 'https://brilliant.org',
    icon: '💡',
    color: '#000000',
    subjects: ['math', 'algebra', 'geometry', 'calculus', 'statistics', 'logic', 'computer science', 'physics', 'data science'],
    features: ['Interactive courses', 'Problem-solving focus', 'Visual learning'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'pauls_math',
    name: "Paul's Online Math Notes",
    description: 'Comprehensive math notes and tutorials',
    url: 'https://tutorial.math.lamar.edu',
    icon: '📝',
    color: '#4A148C',
    subjects: ['math', 'algebra', 'calculus', 'differential equations', 'linear algebra'],
    features: ['Detailed notes', 'Practice problems', 'Cheat sheets'],
    pricing: 'free',
    quality: 5,
  },

  // === PROGRAMMING / CODING ===
  {
    id: 'freecodecamp',
    name: 'freeCodeCamp',
    description: 'Learn to code for free with hands-on projects',
    url: 'https://www.freecodecamp.org',
    searchUrl: 'https://www.freecodecamp.org/news/search/?query={query}',
    icon: '⚡',
    color: '#0A0A23',
    subjects: ['coding', 'programming', 'web development', 'javascript', 'python', 'html', 'css', 'react', 'node.js', 'data science', 'machine learning'],
    features: ['Interactive coding', 'Projects', 'Certifications', 'Community'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'codecademy',
    name: 'Codecademy',
    description: 'Interactive coding courses for beginners to advanced',
    url: 'https://www.codecademy.com',
    searchUrl: 'https://www.codecademy.com/search?query={query}',
    icon: '💻',
    color: '#1F4056',
    subjects: ['coding', 'programming', 'python', 'javascript', 'html', 'css', 'sql', 'java', 'c++', 'ruby', 'go', 'swift', 'data science'],
    features: ['Interactive lessons', 'Projects', 'Career paths', 'Skill assessments'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'leetcode',
    name: 'LeetCode',
    description: 'Coding interview preparation and practice',
    url: 'https://leetcode.com',
    searchUrl: 'https://leetcode.com/problemset/all/?search={query}',
    icon: '🏆',
    color: '#FFA116',
    subjects: ['coding', 'algorithms', 'data structures', 'programming', 'interview prep', 'competitive programming'],
    features: ['Coding challenges', 'Contest mode', 'Company-specific problems'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'replit',
    name: 'Replit',
    description: 'Browser-based IDE to code in any language',
    url: 'https://replit.com',
    icon: '🔧',
    color: '#F26207',
    subjects: ['coding', 'programming', 'python', 'javascript', 'web development', 'game development'],
    features: ['Online IDE', 'Collaboration', 'Hosting', 'AI assistance'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Code hosting and collaboration platform',
    url: 'https://github.com',
    searchUrl: 'https://github.com/search?q={query}',
    icon: '🐙',
    color: '#24292E',
    subjects: ['coding', 'programming', 'open source', 'version control', 'collaboration'],
    features: ['Code hosting', 'Version control', 'Collaboration', 'Open source'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'w3schools',
    name: 'W3Schools',
    description: 'Web development tutorials and references',
    url: 'https://www.w3schools.com',
    searchUrl: 'https://www.w3schools.com/search/search.asp?searchString={query}',
    icon: '🌐',
    color: '#04AA6D',
    subjects: ['web development', 'html', 'css', 'javascript', 'sql', 'python', 'php', 'java'],
    features: ['Tutorials', 'Try it yourself', 'References', 'Exercises'],
    pricing: 'free',
    quality: 4,
  },
  {
    id: 'mdn',
    name: 'MDN Web Docs',
    description: 'Comprehensive web development documentation',
    url: 'https://developer.mozilla.org',
    searchUrl: 'https://developer.mozilla.org/en-US/search?q={query}',
    icon: '📖',
    color: '#000000',
    subjects: ['web development', 'html', 'css', 'javascript', 'web apis', 'http'],
    features: ['Documentation', 'Tutorials', 'Browser compatibility', 'Best practices'],
    pricing: 'free',
    quality: 5,
  },

  // === SCIENCE ===
  {
    id: 'physics_classroom',
    name: 'The Physics Classroom',
    description: 'Physics tutorials and interactive simulations',
    url: 'https://www.physicsclassroom.com',
    icon: '⚛️',
    color: '#1565C0',
    subjects: ['physics', 'mechanics', 'waves', 'electricity', 'magnetism', 'light', 'science'],
    features: ['Tutorials', 'Simulations', 'Practice problems', 'Concept builders'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'phet',
    name: 'PhET Simulations',
    description: 'Interactive science and math simulations',
    url: 'https://phet.colorado.edu',
    searchUrl: 'https://phet.colorado.edu/en/simulations/filter?subjects=all&type=all&sort=alpha&view=grid&q={query}',
    icon: '🔭',
    color: '#6EC6F7',
    subjects: ['physics', 'chemistry', 'biology', 'math', 'earth science', 'science'],
    features: ['Interactive simulations', 'Visual learning', 'Lab activities'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'organic_chemistry_tutor',
    name: 'Organic Chemistry Tutor',
    description: 'YouTube channel with excellent science/math tutorials',
    url: 'https://www.youtube.com/@TheOrganicChemistryTutor',
    searchUrl: 'https://www.youtube.com/@TheOrganicChemistryTutor/search?query={query}',
    icon: '🎬',
    color: '#FF0000',
    subjects: ['chemistry', 'physics', 'math', 'biology', 'organic chemistry', 'calculus', 'algebra'],
    features: ['Video tutorials', 'Clear explanations', 'Practice problems'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'byjus',
    name: 'BYJU\'S',
    description: 'Visual learning app for science and math',
    url: 'https://byjus.com',
    icon: '🎯',
    color: '#7C3AED',
    subjects: ['math', 'physics', 'chemistry', 'biology', 'science'],
    features: ['Video lessons', 'Animated content', 'Practice tests'],
    pricing: 'freemium',
    quality: 4,
  },

  // === LANGUAGES ===
  {
    id: 'duolingo',
    name: 'Duolingo',
    description: 'Gamified language learning platform',
    url: 'https://www.duolingo.com',
    icon: '🦉',
    color: '#58CC02',
    subjects: ['language', 'spanish', 'french', 'german', 'japanese', 'korean', 'chinese', 'italian', 'portuguese', 'english', 'esl'],
    features: ['Gamification', 'Daily streaks', 'Speaking practice', 'Stories'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'busuu',
    name: 'Busuu',
    description: 'Language learning with native speaker feedback',
    url: 'https://www.busuu.com',
    icon: '🗣️',
    color: '#FF6F00',
    subjects: ['language', 'spanish', 'french', 'german', 'japanese', 'chinese', 'english', 'esl'],
    features: ['Native speaker corrections', 'Grammar lessons', 'Vocabulary'],
    pricing: 'freemium',
    quality: 4,
  },
  {
    id: 'grammarly',
    name: 'Grammarly',
    description: 'Writing assistant and grammar checker',
    url: 'https://www.grammarly.com',
    icon: '✍️',
    color: '#15C39A',
    subjects: ['english', 'writing', 'grammar', 'essay writing', 'esl'],
    features: ['Grammar check', 'Style suggestions', 'Plagiarism detection'],
    pricing: 'freemium',
    quality: 5,
  },

  // === GENERAL LEARNING ===
  {
    id: 'coursera',
    name: 'Coursera',
    description: 'University courses from top institutions',
    url: 'https://www.coursera.org',
    searchUrl: 'https://www.coursera.org/search?query={query}',
    icon: '🎓',
    color: '#0056D2',
    subjects: ['all', 'computer science', 'business', 'data science', 'health', 'social sciences', 'arts', 'engineering'],
    features: ['University courses', 'Certificates', 'Degrees', 'Professional courses'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'edx',
    name: 'edX',
    description: 'Free online courses from top universities',
    url: 'https://www.edx.org',
    searchUrl: 'https://www.edx.org/search?q={query}',
    icon: '🏛️',
    color: '#02262B',
    subjects: ['all', 'computer science', 'business', 'data science', 'engineering', 'humanities', 'science'],
    features: ['University courses', 'MicroMasters', 'Professional certificates'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'udemy',
    name: 'Udemy',
    description: 'Marketplace for online courses on any topic',
    url: 'https://www.udemy.com',
    searchUrl: 'https://www.udemy.com/courses/search/?q={query}',
    icon: '📺',
    color: '#A435F0',
    subjects: ['all', 'programming', 'business', 'design', 'marketing', 'music', 'photography'],
    features: ['Video courses', 'Lifetime access', 'Wide variety'],
    pricing: 'paid',
    quality: 4,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Free video tutorials on any subject',
    url: 'https://www.youtube.com',
    searchUrl: 'https://www.youtube.com/results?search_query={query}+tutorial',
    icon: '▶️',
    color: '#FF0000',
    subjects: ['all'],
    features: ['Free videos', 'All topics', 'Community'],
    pricing: 'free',
    quality: 4,
  },
  {
    id: 'quizlet',
    name: 'Quizlet',
    description: 'Flashcards and study sets for any subject',
    url: 'https://quizlet.com',
    searchUrl: 'https://quizlet.com/search?query={query}&type=sets',
    icon: '🃏',
    color: '#4255FF',
    subjects: ['all', 'vocabulary', 'languages', 'science', 'history', 'test prep'],
    features: ['Flashcards', 'Study games', 'Practice tests', 'Learn mode'],
    pricing: 'freemium',
    quality: 4,
  },
  {
    id: 'anki',
    name: 'Anki',
    description: 'Spaced repetition flashcard app',
    url: 'https://apps.ankiweb.net',
    icon: '🧠',
    color: '#0077CC',
    subjects: ['all', 'languages', 'medical', 'vocabulary', 'memorization'],
    features: ['Spaced repetition', 'Custom decks', 'Community decks'],
    pricing: 'free',
    quality: 5,
  },

  // === TEST PREP ===
  {
    id: 'collegeboard',
    name: 'College Board',
    description: 'Official SAT and AP practice',
    url: 'https://www.collegeboard.org',
    icon: '📋',
    color: '#1E3D6F',
    subjects: ['sat', 'ap', 'test prep', 'college prep'],
    features: ['Official practice tests', 'AP resources', 'College planning'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'act',
    name: 'ACT',
    description: 'Official ACT preparation resources',
    url: 'https://www.act.org/content/act/en/products-and-services/the-act/test-preparation.html',
    icon: '📝',
    color: '#ED1B24',
    subjects: ['act', 'test prep', 'college prep'],
    features: ['Practice tests', 'Study guides', 'Test tips'],
    pricing: 'free',
    quality: 5,
  },

  // === MUSIC ===
  {
    id: 'musictheory',
    name: 'musictheory.net',
    description: 'Free music theory lessons and exercises',
    url: 'https://www.musictheory.net',
    icon: '🎵',
    color: '#2196F3',
    subjects: ['music', 'music theory', 'piano', 'guitar'],
    features: ['Interactive lessons', 'Exercises', 'Tools'],
    pricing: 'free',
    quality: 5,
  },
  {
    id: 'simply_piano',
    name: 'Simply Piano',
    description: 'Learn piano with interactive lessons',
    url: 'https://www.joytunes.com/simply-piano',
    icon: '🎹',
    color: '#FF5722',
    subjects: ['music', 'piano'],
    features: ['Interactive lessons', 'Song library', 'Progress tracking'],
    pricing: 'freemium',
    quality: 4,
  },
  {
    id: 'yousician',
    name: 'Yousician',
    description: 'Learn guitar, piano, bass, and ukulele',
    url: 'https://yousician.com',
    icon: '🎸',
    color: '#00BFA5',
    subjects: ['music', 'guitar', 'piano', 'bass', 'ukulele'],
    features: ['Real-time feedback', 'Songs', 'Lessons'],
    pricing: 'freemium',
    quality: 4,
  },

  // === ART & DESIGN ===
  {
    id: 'skillshare',
    name: 'Skillshare',
    description: 'Creative classes in design, illustration, and more',
    url: 'https://www.skillshare.com',
    searchUrl: 'https://www.skillshare.com/search?query={query}',
    icon: '🎨',
    color: '#00FF84',
    subjects: ['art', 'design', 'illustration', 'photography', 'video', 'writing', 'animation'],
    features: ['Video classes', 'Projects', 'Community'],
    pricing: 'paid',
    quality: 4,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Collaborative design tool for UI/UX',
    url: 'https://www.figma.com',
    icon: '🖌️',
    color: '#F24E1E',
    subjects: ['design', 'ui design', 'ux design', 'graphic design', 'prototyping'],
    features: ['Design tool', 'Collaboration', 'Prototyping', 'Free tier'],
    pricing: 'freemium',
    quality: 5,
  },
  {
    id: 'canva',
    name: 'Canva',
    description: 'Easy graphic design for everyone',
    url: 'https://www.canva.com',
    icon: '🖼️',
    color: '#00C4CC',
    subjects: ['design', 'graphic design', 'presentations', 'social media'],
    features: ['Templates', 'Easy editor', 'Collaboration'],
    pricing: 'freemium',
    quality: 4,
  },
]

/**
 * Get platforms relevant to a subject/topic
 */
export function getPlatformsForSubject(subject: string, limit: number = 3): Platform[] {
  const normalizedSubject = subject.toLowerCase().trim()

  // Score platforms based on relevance
  const scored = PLATFORMS.map(platform => {
    let score = 0

    // Direct subject match (highest priority)
    if (platform.subjects.some(s => s === normalizedSubject)) {
      score += 100
    }

    // Partial match in subjects
    if (platform.subjects.some(s => s.includes(normalizedSubject) || normalizedSubject.includes(s))) {
      score += 50
    }

    // Match in name or description
    if (platform.name.toLowerCase().includes(normalizedSubject)) {
      score += 30
    }
    if (platform.description.toLowerCase().includes(normalizedSubject)) {
      score += 20
    }

    // "all" subjects means it covers everything (lower priority)
    if (platform.subjects.includes('all') && score === 0) {
      score += 10
    }

    // Quality bonus
    score += platform.quality * 2

    // Free platforms get a small bonus
    if (platform.pricing === 'free') {
      score += 5
    }

    return { platform, score }
  })

  // Sort by score and return top matches
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.platform)
}

/**
 * Get platforms by specific IDs
 */
export function getPlatformsByIds(ids: string[]): Platform[] {
  return ids
    .map(id => PLATFORMS.find(p => p.id === id))
    .filter((p): p is Platform => p !== undefined)
}

/**
 * Get platform by ID
 */
export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find(p => p.id === id)
}

/**
 * Generate a direct link to search on a platform
 */
export function getPlatformSearchUrl(platform: Platform, query: string): string {
  if (platform.searchUrl) {
    return platform.searchUrl.replace('{query}', encodeURIComponent(query))
  }
  return platform.url
}

/**
 * Subject category mappings for better matching
 */
export const SUBJECT_CATEGORIES: Record<string, string[]> = {
  math: ['algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'pre-algebra', 'arithmetic', 'linear algebra', 'differential equations', 'pre-calculus', 'discrete math'],
  science: ['physics', 'chemistry', 'biology', 'earth science', 'astronomy', 'environmental science'],
  coding: ['programming', 'web development', 'javascript', 'python', 'java', 'html', 'css', 'react', 'node.js', 'sql', 'algorithms', 'data structures'],
  language: ['english', 'spanish', 'french', 'german', 'japanese', 'korean', 'chinese', 'italian', 'portuguese', 'esl', 'grammar', 'writing'],
  'test prep': ['sat', 'act', 'gre', 'gmat', 'ap', 'ielts', 'toefl'],
  music: ['piano', 'guitar', 'music theory', 'drums', 'violin', 'singing'],
  art: ['drawing', 'painting', 'illustration', 'graphic design', 'ui design', 'ux design', 'animation'],
}

/**
 * Detect the main category from a goal/topic
 */
export function detectCategory(text: string): string | null {
  const normalizedText = text.toLowerCase()

  for (const [category, keywords] of Object.entries(SUBJECT_CATEGORIES)) {
    if (normalizedText.includes(category)) {
      return category
    }
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        return category
      }
    }
  }

  return null
}
