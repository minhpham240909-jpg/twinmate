/**
 * LANGUAGES DOMAIN PLAYBOOK
 *
 * Expert knowledge for language learning goals.
 * Contains failure modes, wrong beliefs, and sequence constraints
 * that the AI cannot reliably generate.
 */

import { DomainPlaybook } from './types'

export const LanguagesDomain: DomainPlaybook = {
  domain: 'languages',
  displayName: 'Language Learning',

  subdomains: [
    'english',
    'spanish',
    'french',
    'german',
    'japanese',
    'chinese',
    'korean',
    'general-language',
  ],

  keywords: [
    'language', 'speak', 'speaking', 'english', 'spanish', 'french',
    'german', 'japanese', 'chinese', 'korean', 'fluent', 'fluency',
    'conversation', 'vocabulary', 'grammar', 'pronunciation',
    'accent', 'listening', 'reading', 'writing', 'ielts', 'toefl',
    'communication', 'foreign language', 'second language',
  ],

  // ============================================
  // EXPERT PRIORITIES
  // What experts know that beginners don't
  // ============================================
  expertPriorities: {
    english: [
      'Speaking practice from day 1, not after "learning enough"',
      'Pronunciation patterns matter more than perfect accent',
      'Conversation scaffolds beat vocabulary lists',
      'Listening comprehension is the bottleneck - train it early',
      'Grammar emerges from patterns, not rules memorization',
      'Mistakes are data, not failures - embrace corrections',
      'Real content (movies, podcasts) beats textbook materials',
    ],

    spanish: [
      'Verb conjugation patterns, not individual forms',
      'Subjunctive is not optional - native speakers hear it immediately',
      'Regional differences matter - pick one variant early',
      'Listening to native speed from the start, not slowed down',
      'False cognates trip up English speakers consistently',
    ],

    japanese: [
      'Hiragana and Katakana before anything else - no romaji shortcuts',
      'Particle mastery unlocks sentence comprehension',
      'Pitch accent exists and matters for natural sound',
      'Kanji readings depend on context - learn words, not characters',
      'Keigo (formal speech) is non-negotiable for real-world use',
    ],

    chinese: [
      'Tones are not optional - wrong tone = wrong word',
      'Pinyin is training wheels, not permanent crutch',
      'Character components reveal meaning patterns',
      'Measure words are mandatory, not extra',
      'Listening to tones in context, not isolation',
    ],

    'general-language': [
      'Output (speaking/writing) is harder than input (reading/listening) - start early',
      'Consistent 15 minutes beats occasional 2 hours',
      'Comprehensible input is the engine of acquisition',
      'Translation habit slows down fluency - think in target language',
      'Awkward silence is normal - push through it',
      'Perfect grammar is not required for communication',
    ],
  },

  // ============================================
  // WRONG BELIEFS
  // What beginners incorrectly believe
  // ============================================
  wrongBeliefs: {
    english: [
      {
        belief: 'I need to learn grammar rules before speaking',
        reality: 'Grammar emerges from speaking practice. Rules come after patterns.',
        harm: 'Delayed speaking, permanent hesitation habit',
      },
      {
        belief: 'I need a large vocabulary first',
        reality: '1000 words cover 85% of daily conversation',
        harm: 'Vocabulary hoarding, never actually using words',
      },
      {
        belief: 'Native accent is necessary for being understood',
        reality: 'Clarity beats accent. Most successful speakers have accents.',
        harm: 'Perfectionism paralysis, avoiding speaking',
      },
      {
        belief: 'Making mistakes damages my English',
        reality: 'Mistakes are how the brain learns. Avoiding them stops progress.',
        harm: 'Fear of speaking, slow progress',
      },
      {
        belief: 'I need to understand 100% before responding',
        reality: 'Native speakers often understand 70% and infer the rest',
        harm: 'Listening anxiety, slow conversation speed',
      },
    ],

    spanish: [
      {
        belief: 'Subjunctive is advanced and can wait',
        reality: 'Subjunctive is used constantly in basic conversation',
        harm: 'Obvious non-native patterns, limited expression',
      },
      {
        belief: 'Spain Spanish and Latin American Spanish are very different',
        reality: 'Core language is the same. Differences are like British vs American.',
        harm: 'Paralysis about which to learn',
      },
    ],

    japanese: [
      {
        belief: 'I can learn with romaji first, then switch to kana',
        reality: 'Romaji creates pronunciation habits that are hard to break',
        harm: 'Foreign accent locked in, reading speed capped',
      },
      {
        belief: 'Anime Japanese is real Japanese',
        reality: 'Anime uses exaggerated, informal, and sometimes fictional speech',
        harm: 'Sounding strange or rude in real situations',
      },
    ],

    chinese: [
      {
        belief: 'Tones can be fixed later after learning words',
        reality: 'Wrong tones from day 1 fossilize and are nearly impossible to fix',
        harm: 'Permanent intelligibility problems',
      },
      {
        belief: 'I should learn simplified and traditional characters',
        reality: 'Pick one system. Switching later is easier than parallel learning.',
        harm: 'Divided attention, slower progress on both',
      },
    ],

    'general-language': [
      {
        belief: 'Apps like Duolingo will make me fluent',
        reality: 'Apps build recognition. Fluency requires human interaction.',
        harm: 'False confidence, inability to actually converse',
      },
      {
        belief: 'I am too old to learn a language',
        reality: 'Adults learn faster than children in many aspects. Consistency is key.',
        harm: 'Not starting at all',
      },
      {
        belief: 'I need to live in the country to learn',
        reality: 'Immersion helps but is not required. Many learn remotely.',
        harm: 'Waiting for perfect conditions that never come',
      },
    ],
  },

  // ============================================
  // FAILURE MODES
  // Specific traps per topic
  // ============================================
  failureModes: {
    english: {
      speaking: [
        {
          trap: 'Mentally translating from native language before speaking',
          consequence: 'Slow, unnatural speech. Noticeable pauses. Brain overload.',
          frequency: 'very_common',
        },
        {
          trap: 'Waiting to "feel ready" before speaking practice',
          consequence: 'Speaking anxiety compounds. Never feels ready.',
          frequency: 'very_common',
        },
        {
          trap: 'Avoiding difficult sounds instead of practicing them',
          consequence: 'Fossilized pronunciation errors. Decreased intelligibility.',
          frequency: 'common',
        },
      ],
      listening: [
        {
          trap: 'Only listening to slowed-down, clear materials',
          consequence: 'Cannot understand native speed. Real conversations feel too fast.',
          frequency: 'very_common',
        },
        {
          trap: 'Relying on subtitles permanently',
          consequence: 'Reading, not listening. Audio comprehension never develops.',
          frequency: 'very_common',
        },
        {
          trap: 'Trying to understand every word instead of main ideas',
          consequence: 'Listening exhaustion. Missing context by focusing on details.',
          frequency: 'common',
        },
      ],
      vocabulary: [
        {
          trap: 'Learning words in isolation without context',
          consequence: 'Cannot recall words when needed. Passive but not active vocab.',
          frequency: 'very_common',
        },
        {
          trap: 'Focusing on rare/advanced words before basics',
          consequence: 'Impressive vocabulary, cannot order coffee.',
          frequency: 'common',
        },
      ],
      grammar: [
        {
          trap: 'Memorizing rules without pattern practice',
          consequence: 'Knows rules, cannot apply them in real-time.',
          frequency: 'very_common',
        },
        {
          trap: 'Focusing on exceptions before mastering regular patterns',
          consequence: 'Confusion about what is normal, what is exceptional.',
          frequency: 'common',
        },
      ],
    },

    spanish: {
      pronunciation: [
        {
          trap: 'Pronouncing Spanish with English vowel sounds',
          consequence: 'Words are not recognized by native speakers.',
          frequency: 'very_common',
        },
        {
          trap: 'Ignoring the rolled R until later',
          consequence: 'Major fluency marker missing. Obvious foreigner signal.',
          frequency: 'common',
        },
      ],
    },

    japanese: {
      writing: [
        {
          trap: 'Learning kanji by rote without mnemonics',
          consequence: 'Slow memorization, quick forgetting. 2000+ characters is overwhelming.',
          frequency: 'very_common',
        },
        {
          trap: 'Neglecting handwriting practice in digital age',
          consequence: 'Cannot fill forms, write notes, or remember characters.',
          frequency: 'common',
        },
      ],
    },

    'general-language': {
      practice: [
        {
          trap: 'Studying instead of practicing',
          consequence: 'Head knowledge without skill. Freezes in real situations.',
          frequency: 'very_common',
        },
        {
          trap: 'Only consuming content, never producing',
          consequence: 'Comprehension develops, production does not.',
          frequency: 'very_common',
        },
      ],
    },
  },

  // ============================================
  // SEQUENCE RULES
  // What must come before what
  // ============================================
  sequenceRules: {
    english: [
      {
        prerequisite: 'basic-pronunciation',
        required_for: 'speaking-practice',
        reason: 'Bad pronunciation fossilizes quickly once speaking starts',
      },
      {
        prerequisite: 'high-frequency-vocabulary',
        required_for: 'conversation-practice',
        reason: 'Need minimum vocabulary to form sentences',
      },
      {
        prerequisite: 'listening-comprehension',
        required_for: 'natural-conversation',
        reason: 'Cannot respond if you cannot understand',
      },
      {
        prerequisite: 'basic-sentence-patterns',
        required_for: 'complex-grammar',
        reason: 'Complex structures build on basic ones',
      },
    ],

    japanese: [
      {
        prerequisite: 'hiragana',
        required_for: 'katakana',
        reason: 'Same sounds, hiragana more common',
      },
      {
        prerequisite: 'katakana',
        required_for: 'kanji',
        reason: 'Kanji readings use kana',
      },
      {
        prerequisite: 'basic-particles',
        required_for: 'sentence-construction',
        reason: 'Particles define sentence meaning',
      },
    ],

    chinese: [
      {
        prerequisite: 'tone-system',
        required_for: 'vocabulary',
        reason: 'Wrong tones = different words entirely',
      },
      {
        prerequisite: 'pinyin',
        required_for: 'character-learning',
        reason: 'Need pronunciation reference for characters',
      },
    ],
  },

  // ============================================
  // IDENTITY STAGES
  // Who users become at each stage
  // ============================================
  identityStages: [
    {
      stage: 1,
      identity: 'Silent Learner',
      description: 'Understands some, cannot speak. Recognizes patterns.',
    },
    {
      stage: 2,
      identity: 'Limited Speaker',
      description: 'Can produce basic sentences. Still translating mentally.',
    },
    {
      stage: 3,
      identity: 'Functional Speaker',
      description: 'Can handle daily situations. Makes mistakes but is understood.',
    },
    {
      stage: 4,
      identity: 'Confident Communicator',
      description: 'Converses naturally. Thinks in target language. Errors are minor.',
    },
    {
      stage: 5,
      identity: 'Fluent Speaker',
      description: 'Natural speech patterns. Cultural nuance understood. Can work in language.',
    },
  ],

  // ============================================
  // TIME ESTIMATES
  // ============================================
  timeEstimates: {
    beginner_to_functional: '3-6 months of daily practice (30-60 min/day)',
    functional_to_proficient: '1-2 years of consistent immersion/practice',
    proficient_to_expert: '3-5 years of deep engagement with language',
  },
}

export default LanguagesDomain
