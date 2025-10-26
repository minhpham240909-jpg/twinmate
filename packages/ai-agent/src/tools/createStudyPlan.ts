/**
 * Create Study Plan Tool - Generate personalized weekly study plan with AI
 */

import {
  Tool,
  CreateStudyPlanInputSchema,
  CreateStudyPlanOutputSchema,
  CreateStudyPlanInput,
  CreateStudyPlanOutput,
  AgentContext,
  LLMProvider,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

export function createCreateStudyPlanTool(
  llmProvider: LLMProvider,
  supabase: SupabaseClient
): Tool<CreateStudyPlanInput, CreateStudyPlanOutput> {
  return {
    name: 'createStudyPlan',
    description: 'Generate a personalized multi-week study plan based on goals, available time, and deadline. Uses AI to break down tasks.',
    category: 'productivity',
    inputSchema: CreateStudyPlanInputSchema,
    outputSchema: CreateStudyPlanOutputSchema,
    estimatedLatencyMs: 3000,

    async call(input: CreateStudyPlanInput, ctx: AgentContext): Promise<CreateStudyPlanOutput> {
      const { goals, timePerDayMin, daysPerWeek, deadline } = input

      // Calculate total weeks until deadline
      const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000) // Default: 8 weeks
      const now = new Date()
      const totalWeeks = Math.ceil((deadlineDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
      const weeksToGenerate = Math.max(1, Math.min(totalWeeks, 12)) // Cap at 12 weeks

      // Fetch user profile for context
      const { data: profile } = await supabase
        .from('profile')
        .select('subjects, grade_level, learning_style, preferences')
        .eq('user_id', ctx.userId)
        .single()

      // Fetch learning profile for strengths/weaknesses
      const { data: learningProfile } = await supabase
        .from('learning_profile')
        .select('strengths, weaknesses, recommended_focus')
        .eq('user_id', ctx.userId)
        .single()

      // Build context-aware prompt
      const prompt = `You are a study planning expert. Create a ${weeksToGenerate}-week study plan for a student with these details:

**Goals:** ${goals.join(', ')}
**Available Time:** ${timePerDayMin} minutes/day, ${daysPerWeek} days/week
**Deadline:** ${deadlineDate.toLocaleDateString()}
**Grade Level:** ${profile?.grade_level || 'Not specified'}
**Subjects:** ${profile?.subjects?.join(', ') || 'Not specified'}
**Learning Style:** ${profile?.learning_style || 'Not specified'}
**Strengths:** ${learningProfile?.strengths?.join(', ') || 'Not specified'}
**Weaknesses:** ${learningProfile?.weaknesses?.join(', ') || 'Not specified'}
**Focus Areas:** ${learningProfile?.recommended_focus?.join(', ') || 'Not specified'}

Create a week-by-week breakdown with specific, actionable tasks. Each task should have:
- Clear title (2-5 words)
- Estimated time in minutes
- Optional link to resources (if applicable)

Respond in this JSON format:
{
  "title": "Short plan title (e.g., 'Algebra Mastery Plan')",
  "weekBlocks": [
    {
      "week": 1,
      "focus": "Brief description of week's focus",
      "tasks": [
        { "title": "Task name", "etaMin": 45, "link": "optional_url", "completed": false }
      ]
    }
  ]
}

IMPORTANT:
- Distribute workload evenly across weeks
- Front-load harder topics if student has weaknesses
- Include review/practice sessions
- Total time per week should roughly equal: ${timePerDayMin * daysPerWeek} minutes
- Be specific with task names (not "Study Chapter 1" but "Complete Chapter 1: Linear Equations exercises 1-20")
`

      // Call LLM
      const response = await llmProvider.complete({
        messages: [
          {
            role: 'system',
            content: 'You are an expert study planner who creates structured, achievable study plans. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      })

      // Parse response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON')
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Validate structure
      if (!parsed.title || !Array.isArray(parsed.weekBlocks)) {
        throw new Error('Invalid study plan structure from LLM')
      }

      // Ensure all tasks have required fields
      parsed.weekBlocks.forEach((week: any, weekIdx: number) => {
        if (!Array.isArray(week.tasks)) {
          throw new Error(`Week ${weekIdx + 1} missing tasks array`)
        }
        week.tasks.forEach((task: any, taskIdx: number) => {
          if (!task.title || typeof task.etaMin !== 'number') {
            throw new Error(`Week ${weekIdx + 1}, task ${taskIdx + 1} missing title or etaMin`)
          }
          // Ensure completed field exists
          if (task.completed === undefined) {
            task.completed = false
          }
        })
      })

      // Save to database
      const planId = uuidv4()
      const { error: insertError } = await supabase
        .from('study_plan')
        .insert({
          id: planId,
          user_id: ctx.userId,
          title: parsed.title,
          goals,
          time_per_day_min: timePerDayMin,
          days_per_week: daysPerWeek,
          deadline: deadlineDate.toISOString(),
          week_blocks: parsed.weekBlocks,
          status: 'active',
        })

      if (insertError) {
        throw new Error(`Failed to save study plan: ${insertError.message}`)
      }

      return {
        planId,
        title: parsed.title,
        weekBlocks: parsed.weekBlocks,
      }
    },
  }
}
