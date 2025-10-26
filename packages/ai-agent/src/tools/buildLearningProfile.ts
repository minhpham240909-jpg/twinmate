/**
 * Build Learning Profile Tool - Analyze user performance and compute strengths/weaknesses
 */

import {
  Tool,
  BuildLearningProfileInputSchema,
  BuildLearningProfileOutputSchema,
  BuildLearningProfileInput,
  BuildLearningProfileOutput,
  AgentContext,
  LLMProvider,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createBuildLearningProfileTool(
  llmProvider: LLMProvider,
  supabase: SupabaseClient
): Tool<BuildLearningProfileInput, BuildLearningProfileOutput> {
  return {
    name: 'buildLearningProfile',
    description: 'Analyze student\'s quiz performance and study history to identify strengths, weaknesses, and recommended focus areas.',
    category: 'learning',
    inputSchema: BuildLearningProfileInputSchema,
    outputSchema: BuildLearningProfileOutputSchema,
    estimatedLatencyMs: 2000,

    async call(input: BuildLearningProfileInput, ctx: AgentContext): Promise<BuildLearningProfileOutput> {
      const { forceRebuild } = input

      // Check if profile exists and was recently computed
      const { data: existingProfile } = await supabase
        .from('learning_profile')
        .select('strengths, weaknesses, recommended_focus, analytics, last_computed_at')
        .eq('user_id', ctx.userId)
        .single()

      // If not forcing rebuild and profile is recent (< 7 days), return existing
      if (!forceRebuild && existingProfile && existingProfile.last_computed_at) {
        const lastComputed = new Date(existingProfile.last_computed_at)
        const daysSince = (Date.now() - lastComputed.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince < 7) {
          return {
            strengths: existingProfile.strengths || [],
            weaknesses: existingProfile.weaknesses || [],
            recommendedFocus: existingProfile.recommended_focus || [],
            analytics: existingProfile.analytics || {},
          }
        }
      }

      // Fetch quiz attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempt')
        .select(`
          quiz_id,
          answers,
          score,
          created_at,
          quiz!inner (
            title,
            topic,
            difficulty,
            items
          )
        `)
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(50) // Analyze last 50 attempts

      if (attemptsError) {
        throw new Error(`Failed to fetch quiz attempts: ${attemptsError.message}`)
      }

      if (!attempts || attempts.length === 0) {
        // No data yet - return empty profile
        return {
          strengths: [],
          weaknesses: [],
          recommendedFocus: ['Complete more quizzes to build your learning profile'],
          analytics: { totalAttempts: 0, averageScore: 0 },
        }
      }

      // Compute basic analytics
      const totalAttempts = attempts.length
      const averageScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts

      // Topic performance breakdown
      const topicScores: Record<string, { total: number; count: number; scores: number[] }> = {}

      attempts.forEach(attempt => {
        // quiz is returned as an array from Supabase join
        const quizData = (attempt.quiz as any)?.[0] || attempt.quiz
        const topic = quizData?.topic || quizData?.title || 'Unknown'
        if (!topicScores[topic]) {
          topicScores[topic] = { total: 0, count: 0, scores: [] }
        }
        topicScores[topic].total += attempt.score || 0
        topicScores[topic].count += 1
        topicScores[topic].scores.push(attempt.score || 0)
      })

      const topicAverages = Object.entries(topicScores).map(([topic, data]) => ({
        topic,
        average: data.total / data.count,
        attempts: data.count,
        scores: data.scores,
      }))

      // Sort by average score
      topicAverages.sort((a, b) => b.average - a.average)

      // Identify strengths (top 3 topics with >75% average)
      const strengths = topicAverages
        .filter(t => t.average >= 75 && t.attempts >= 2)
        .slice(0, 3)
        .map(t => t.topic)

      // Identify weaknesses (bottom topics with <60% average)
      const weaknesses = topicAverages
        .filter(t => t.average < 60 && t.attempts >= 2)
        .slice(-3)
        .map(t => t.topic)

      // Use LLM to generate recommended focus areas
      const prompt = `Based on this student's performance data, recommend 3-5 specific focus areas for improvement:

**Overall Stats:**
- Total Quizzes: ${totalAttempts}
- Average Score: ${averageScore.toFixed(1)}%

**Topic Performance:**
${topicAverages.map(t => `- ${t.topic}: ${t.average.toFixed(1)}% (${t.attempts} attempts)`).join('\n')}

**Current Strengths:** ${strengths.length > 0 ? strengths.join(', ') : 'None identified yet'}
**Current Weaknesses:** ${weaknesses.length > 0 ? weaknesses.join(', ') : 'None identified yet'}

Provide 3-5 actionable focus areas as a JSON array of strings. Be specific and constructive.
Example: ["Practice more word problems in Algebra", "Review geometry theorems", "Strengthen mental math skills"]

Respond with only a JSON array: ["focus1", "focus2", "focus3"]
`

      const response = await llmProvider.complete({
        messages: [
          {
            role: 'system',
            content: 'You are an educational advisor who provides specific, actionable learning recommendations. Always respond with a JSON array.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      })

      // Parse recommendations
      const jsonMatch = response.content.match(/\[[\s\S]*?\]/)
      const recommendedFocus = jsonMatch ? JSON.parse(jsonMatch[0]) : [
        'Continue practicing to build your profile',
        'Focus on topics with lower scores',
        'Review quiz mistakes regularly',
      ]

      // Build analytics object
      const analytics = {
        totalAttempts,
        averageScore: parseFloat(averageScore.toFixed(1)),
        topicBreakdown: topicAverages.map(t => ({
          topic: t.topic,
          average: parseFloat(t.average.toFixed(1)),
          attempts: t.attempts,
        })),
        lastUpdated: new Date().toISOString(),
      }

      // Save to database (upsert)
      const { error: upsertError } = await supabase
        .from('learning_profile')
        .upsert({
          user_id: ctx.userId,
          strengths,
          weaknesses,
          recommended_focus: recommendedFocus,
          analytics,
          last_computed_at: new Date().toISOString(),
        })

      if (upsertError) {
        throw new Error(`Failed to save learning profile: ${upsertError.message}`)
      }

      return {
        strengths,
        weaknesses,
        recommendedFocus,
        analytics,
      }
    },
  }
}
