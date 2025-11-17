'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { sanitizeInput } from '@/lib/security'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface OnboardingStep {
  title: string
  description: string
  fields: Array<{
    name: string
    label: string
    type: 'text' | 'textarea' | 'number' | 'multiselect' | 'select'
    required: boolean
    options?: string[]
    placeholder?: string
  }>
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Clerva! 👋',
    description: 'Let\'s set up your profile in just a few steps.',
    fields: [
      {
        name: 'name',
        label: 'Display Name',
        type: 'text',
        required: true,
        placeholder: 'How should we call you?',
      },
      {
        name: 'age',
        label: 'Age',
        type: 'number',
        required: true,
        placeholder: 'Your age',
      },
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        required: true,
        options: ['Student', 'Graduate Student', 'Professional', 'Teacher', 'Researcher', 'Other'],
      },
    ],
  },
  {
    title: 'Tell us about yourself',
    description: 'Help us find the perfect study partners for you.',
    fields: [
      {
        name: 'bio',
        label: 'Bio',
        type: 'textarea',
        required: true,
        placeholder: 'Tell others about yourself, your goals, and what you\'re passionate about...',
      },
    ],
  },
  {
    title: 'Your learning interests',
    description: 'What subjects are you studying or interested in?',
    fields: [
      {
        name: 'subjects',
        label: 'Subjects',
        type: 'multiselect',
        required: true,
        options: [
          'Mathematics',
          'Physics',
          'Chemistry',
          'Biology',
          'Computer Science',
          'Engineering',
          'Business',
          'Economics',
          'Psychology',
          'History',
          'Literature',
          'Languages',
          'Art',
          'Music',
          'Other',
        ],
      },
      {
        name: 'interests',
        label: 'Interests',
        type: 'multiselect',
        required: true,
        options: [
          'Machine Learning',
          'Web Development',
          'Mobile Apps',
          'Data Science',
          'Game Development',
          'Research',
          'Entrepreneurship',
          'Design',
          'Writing',
          'Teaching',
          'Fitness',
          'Music',
          'Gaming',
          'Reading',
          'Other',
        ],
      },
    ],
  },
]

export default function OnboardingPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    age: '',
    role: '',
    bio: '',
    subjects: [] as string[],
    interests: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Redirect if already completed profile
  useEffect(() => {
    if (!loading && profile) {
      const isComplete =
        profile.bio &&
        profile.age &&
        profile.role &&
        (profile.subjects?.length ?? 0) > 0 &&
        (profile.interests?.length ?? 0) > 0

      if (isComplete) {
        router.push('/dashboard')
      }
    }
  }, [profile, loading, router])

  // Pre-fill existing data
  useEffect(() => {
    if (profile && user) {
      setFormData({
        name: (user as any).name || user.email?.split('@')[0] || '',
        age: profile.age || '',
        role: profile.role || '',
        bio: profile.bio || '',
        subjects: profile.subjects || [],
        interests: profile.interests || [],
      })
    }
  }, [profile, user])

  const validateStep = (): boolean => {
    const step = ONBOARDING_STEPS[currentStep]
    const newErrors: Record<string, string> = {}

    step.fields.forEach((field) => {
      if (field.required) {
        const value = formData[field.name]

        if (field.type === 'multiselect') {
          if (!value || value.length === 0) {
            newErrors[field.name] = `Please select at least one ${field.label.toLowerCase()}`
          }
        } else if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field.name] = `${field.label} is required`
        } else if (field.name === 'age') {
          const age = parseInt(value)
          if (isNaN(age) || age < 13 || age > 120) {
            newErrors[field.name] = 'Please enter a valid age (13-120)'
          }
        } else if (field.name === 'bio' && value.length < 20) {
          newErrors[field.name] = 'Bio must be at least 20 characters'
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validateStep()) return

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Final step - save everything
      await handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setErrors({})
    }
  }

  const handleSubmit = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Update user name if changed
      const currentName = (user as any).name || user.email?.split('@')[0] || ''
      if (formData.name !== currentName) {
        await fetch('/api/profile/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sanitizeInput(formData.name),
          }),
        })
      }

      // Update profile
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: parseInt(formData.age),
          role: sanitizeInput(formData.role),
          bio: sanitizeInput(formData.bio),
          subjects: formData.subjects,
          interests: formData.interests,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      // Mark onboarding as complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingComplete', 'true')
      }

      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving profile:', error)
      setErrors({ submit: 'Failed to save profile. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const toggleMultiSelect = (name: string, option: string) => {
    const current = formData[name] || []
    const updated = current.includes(option)
      ? current.filter((item: string) => item !== option)
      : [...current, option]
    handleFieldChange(name, updated)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/signin')
    return null
  }

  const step = ONBOARDING_STEPS[currentStep]
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Form Card */}
        <FadeIn delay={0.1}>
          <GlowBorder color="#6366f1" intensity="medium" animated={false}  style={{ borderRadius: 16 }}>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <Bounce delay={0.1}>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{step.title}</h2>
              </Bounce>
              <Bounce delay={0.2}>
                <p className="text-gray-600 mb-8">{step.description}</p>
              </Bounce>

          <div className="space-y-6">
            {step.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors[field.name] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    min="13"
                    max="120"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors[field.name] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={5}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none ${
                      errors[field.name] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                )}

                {field.type === 'select' && (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors[field.name] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'multiselect' && (
                  <div className="flex flex-wrap gap-2">
                    {field.options?.map((option) => {
                      const isSelected = (formData[field.name] || []).includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleMultiSelect(field.name, option)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                )}

                {errors[field.name] && (
                  <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {errors.submit && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || saving}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 0 || saving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Back
            </button>

            <Bounce>
              <button
                onClick={handleNext}
                disabled={saving}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : currentStep === ONBOARDING_STEPS.length - 1 ? (
                  'Complete Setup'
                ) : (
                  'Next'
                )}
              </button>
            </Bounce>
          </div>
            </div>
          </GlowBorder>
        </FadeIn>

        {/* Skip option */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
