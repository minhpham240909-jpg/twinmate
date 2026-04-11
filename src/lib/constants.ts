export const APP_NAME = 'Clerva'

// Core niches — optimized AI, primary marketing focus
export const CORE_NICHES = [
  { value: 'web-design', label: 'Web Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'seo', label: 'SEO' },
  { value: 'development', label: 'Software Development' },
] as const

// Secondary niches — supported but not primary focus
export const SECONDARY_NICHES = [
  { value: 'branding', label: 'Branding & Design' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
] as const

// All niches for the UI (core first, then secondary)
export const NICHES = [...CORE_NICHES, ...SECONDARY_NICHES] as const

export const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
] as const

export const ONBOARDING_STEPS = {
  SLACK: 1,
  PROFILE: 2,
  EMAIL: 3,
} as const
