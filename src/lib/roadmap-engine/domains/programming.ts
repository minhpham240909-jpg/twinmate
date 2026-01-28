/**
 * PROGRAMMING DOMAIN PLAYBOOK
 *
 * Expert knowledge for programming-related learning goals.
 * Contains failure modes, wrong beliefs, and sequence constraints
 * that the AI cannot reliably generate.
 */

import { DomainPlaybook } from './types'

export const ProgrammingDomain: DomainPlaybook = {
  domain: 'programming',
  displayName: 'Programming & Software Development',

  subdomains: [
    'javascript',
    'python',
    'web-development',
    'data-science',
    'mobile-development',
    'backend',
    'devops',
    'general-programming',
  ],

  keywords: [
    'code', 'coding', 'programming', 'developer', 'software',
    'javascript', 'python', 'java', 'react', 'node', 'web',
    'frontend', 'backend', 'fullstack', 'app', 'application',
    'database', 'api', 'algorithm', 'data structure',
    'html', 'css', 'typescript', 'vue', 'angular', 'next',
    'django', 'flask', 'express', 'sql', 'mongodb',
  ],

  // ============================================
  // EXPERT PRIORITIES
  // What experts know that beginners don't
  // ============================================
  expertPriorities: {
    javascript: [
      'Master closures and scope before touching React',
      'Understand the event loop before async/await',
      'Debug skills are 10x more valuable than syntax memorization',
      'Read error messages completely - they contain the solution',
      'Build without tutorials to expose real gaps',
      'Functions are first-class citizens - this changes everything',
      'DOM manipulation basics before frameworks',
    ],

    python: [
      'Environment management (venv/conda) is step 0, not optional',
      'List comprehensions are pythonic, not just syntax sugar',
      'Testing mindset from day 1 prevents disaster later',
      'Read the traceback bottom-up, not top-down',
      'PEP 8 style is non-negotiable in professional code',
      'Dictionaries are your best friend - master them',
    ],

    'web-development': [
      'HTML structure matters more than CSS styling initially',
      'CSS Flexbox and Grid solve 90% of layout problems',
      'DevTools is your primary development tool, not your code editor',
      'Responsive design is not optional - mobile first always',
      'Accessibility is not "nice to have" - it is professional standard',
      'Performance affects user experience more than features',
    ],

    'data-science': [
      'Data cleaning takes 80% of real project time',
      'Pandas is non-negotiable - master it before ML',
      'Statistics fundamentals beat fancy algorithms',
      'Visualization skills are underrated but critical',
      'Domain knowledge often matters more than model complexity',
      'Reproducibility is not optional - use notebooks properly',
    ],

    'general-programming': [
      'Version control (Git) is day 1 skill, not "later"',
      'Reading code is as important as writing code',
      'Break problems into smaller problems - always',
      'Error handling is not optional polish',
      'Documentation is for future you, not others',
      'Tests catch bugs before users do',
    ],
  },

  // ============================================
  // WRONG BELIEFS
  // What beginners incorrectly believe
  // ============================================
  wrongBeliefs: {
    javascript: [
      {
        belief: 'I need to learn HTML/CSS completely first',
        reality: 'JS can be learned in parallel. They complement each other.',
        harm: 'Delayed start, artificial separation of skills',
      },
      {
        belief: 'Frameworks (React/Vue) are easier than vanilla JS',
        reality: 'Vanilla fundamentals make framework learning 5x faster',
        harm: 'Framework dependency, cannot debug core issues',
      },
      {
        belief: 'Following tutorials = real learning',
        reality: 'Building without tutorials = actual skill development',
        harm: 'Cannot build anything without step-by-step guidance',
      },
      {
        belief: 'TypeScript makes JavaScript harder',
        reality: 'TypeScript catches bugs before they happen',
        harm: 'Avoiding tools that make professional life easier',
      },
    ],

    python: [
      {
        belief: 'Python is just for scripting/beginners',
        reality: 'Python powers major systems at Google, Netflix, Instagram',
        harm: 'Underestimating what you can build',
      },
      {
        belief: 'I can skip virtual environments',
        reality: 'Dependency hell will destroy your projects eventually',
        harm: 'Broken projects, "works on my machine" syndrome',
      },
      {
        belief: 'Jupyter notebooks are unprofessional',
        reality: 'Notebooks are industry standard for data exploration',
        harm: 'Missing essential tool for data work',
      },
    ],

    'web-development': [
      {
        belief: 'I need to learn a framework first',
        reality: 'HTML/CSS/JS basics make frameworks actually learnable',
        harm: 'Cargo cult coding - copying without understanding',
      },
      {
        belief: 'Design skills are separate from development',
        reality: 'Basic design sense is part of being a good developer',
        harm: 'Building things nobody wants to use',
      },
      {
        belief: 'Backend is harder than frontend',
        reality: 'They are different, not harder. Both have complexity.',
        harm: 'Fear-based avoidance of full-stack understanding',
      },
    ],

    'general-programming': [
      {
        belief: 'Good programmers write code from memory',
        reality: 'Even experts constantly look things up',
        harm: 'Shame about using references, slower learning',
      },
      {
        belief: 'You need a CS degree to be a real programmer',
        reality: 'Skills matter, not credentials. Build things.',
        harm: 'Imposter syndrome, delayed start',
      },
      {
        belief: 'Programming is about typing code fast',
        reality: 'Programming is 90% thinking, 10% typing',
        harm: 'Rushing to code without understanding the problem',
      },
    ],
  },

  // ============================================
  // FAILURE MODES
  // Specific traps per topic
  // ============================================
  failureModes: {
    javascript: {
      variables: [
        {
          trap: 'Memorizing var/let/const rules without using them in real code',
          consequence: 'Confusion when debugging scope issues',
          frequency: 'very_common',
        },
        {
          trap: 'Skipping scope practice exercises',
          consequence: 'Mysterious bugs in functions, closure confusion',
          frequency: 'very_common',
        },
        {
          trap: 'Not understanding hoisting',
          consequence: 'Unexpected undefined values, hard-to-find bugs',
          frequency: 'common',
        },
      ],
      functions: [
        {
          trap: 'Only writing simple single-purpose functions',
          consequence: 'Panic when seeing callbacks or higher-order functions',
          frequency: 'very_common',
        },
        {
          trap: 'Avoiding arrow functions',
          consequence: 'Outdated code style, confusion with "this" keyword',
          frequency: 'common',
        },
        {
          trap: 'Not understanding function return values',
          consequence: 'Chained operations break unexpectedly',
          frequency: 'common',
        },
      ],
      async: [
        {
          trap: 'Jumping to async/await without understanding callbacks first',
          consequence: 'No mental model for asynchronous execution',
          frequency: 'very_common',
        },
        {
          trap: 'Not practicing error handling with try/catch',
          consequence: 'Silent failures in production, unhandled rejections',
          frequency: 'very_common',
        },
        {
          trap: 'Using await in loops incorrectly',
          consequence: 'Sequential execution when parallel was needed (slow code)',
          frequency: 'common',
        },
      ],
      dom: [
        {
          trap: 'Using innerHTML for everything',
          consequence: 'XSS vulnerabilities, performance issues',
          frequency: 'very_common',
        },
        {
          trap: 'Adding event listeners without understanding event delegation',
          consequence: 'Memory leaks, slow apps with many elements',
          frequency: 'common',
        },
      ],
    },

    python: {
      basics: [
        {
          trap: 'Ignoring indentation as "just formatting"',
          consequence: 'Logic errors that are invisible to the eye',
          frequency: 'common',
        },
        {
          trap: 'Using mutable default arguments in functions',
          consequence: 'Shared state bugs that are notoriously hard to debug',
          frequency: 'common',
        },
      ],
      data_structures: [
        {
          trap: 'Using lists when sets or dicts would be faster',
          consequence: 'O(n) operations when O(1) was possible',
          frequency: 'common',
        },
        {
          trap: 'Modifying a list while iterating over it',
          consequence: 'Skipped elements, infinite loops, or crashes',
          frequency: 'very_common',
        },
      ],
    },

    'web-development': {
      html: [
        {
          trap: 'Using divs for everything (div soup)',
          consequence: 'Accessibility issues, SEO problems, harder CSS',
          frequency: 'very_common',
        },
        {
          trap: 'Ignoring semantic HTML elements',
          consequence: 'Screen readers cannot navigate your site',
          frequency: 'very_common',
        },
      ],
      css: [
        {
          trap: 'Using !important to fix specificity issues',
          consequence: 'Unmaintainable stylesheets, specificity wars',
          frequency: 'very_common',
        },
        {
          trap: 'Avoiding Flexbox/Grid and using floats',
          consequence: 'Complex layouts require 3x the code',
          frequency: 'common',
        },
      ],
    },
  },

  // ============================================
  // SEQUENCE RULES
  // What must come before what
  // ============================================
  sequenceRules: {
    javascript: [
      { prerequisite: 'variables', required_for: 'functions', reason: 'Functions use variables' },
      { prerequisite: 'functions', required_for: 'callbacks', reason: 'Callbacks ARE functions' },
      { prerequisite: 'callbacks', required_for: 'promises', reason: 'Promises use callbacks internally' },
      { prerequisite: 'promises', required_for: 'async-await', reason: 'Async/await is syntactic sugar for promises' },
      { prerequisite: 'dom-basics', required_for: 'event-handling', reason: 'Events happen on DOM elements' },
      { prerequisite: 'objects', required_for: 'classes', reason: 'Classes are object blueprints' },
    ],

    python: [
      { prerequisite: 'variables', required_for: 'data-structures', reason: 'Structures hold variables' },
      { prerequisite: 'functions', required_for: 'classes', reason: 'Methods are functions in classes' },
      { prerequisite: 'loops', required_for: 'list-comprehensions', reason: 'Comprehensions are compact loops' },
      { prerequisite: 'files', required_for: 'pandas-basics', reason: 'Pandas reads/writes files' },
    ],

    'web-development': [
      { prerequisite: 'html-structure', required_for: 'css-styling', reason: 'CSS styles HTML elements' },
      { prerequisite: 'css-basics', required_for: 'responsive-design', reason: 'Responsive uses CSS features' },
      { prerequisite: 'javascript-dom', required_for: 'react-basics', reason: 'React abstracts DOM manipulation' },
    ],
  },

  // ============================================
  // IDENTITY STAGES
  // Who users become at each stage
  // ============================================
  identityStages: [
    {
      stage: 1,
      identity: 'Code Reader',
      description: 'Can read and understand basic code. Recognizes patterns.',
    },
    {
      stage: 2,
      identity: 'Code Modifier',
      description: 'Can modify existing code to change behavior. Debugs simple issues.',
    },
    {
      stage: 3,
      identity: 'Code Builder',
      description: 'Can build small projects from scratch. Understands structure.',
    },
    {
      stage: 4,
      identity: 'Independent Developer',
      description: 'Can solve new problems without tutorials. Learns new tech quickly.',
    },
    {
      stage: 5,
      identity: 'Professional Developer',
      description: 'Writes maintainable, tested code. Mentors others. Ships products.',
    },
  ],

  // ============================================
  // TIME ESTIMATES
  // ============================================
  timeEstimates: {
    beginner_to_functional: '2-4 months of consistent practice (1-2 hours/day)',
    functional_to_proficient: '6-12 months of building real projects',
    proficient_to_expert: '2-5 years of professional experience',
  },
}

export default ProgrammingDomain
