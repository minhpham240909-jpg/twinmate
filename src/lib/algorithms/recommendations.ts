/**
 * Recommendation Engine
 * Implements collaborative filtering and content-based recommendations
 */

export interface UserPreferences {
  userId: string
  subjects: string[]
  interests: string[]
  skillLevel?: string
  studyStyle?: string
}

export interface UserInteraction {
  userId: string
  targetUserId: string
  interactionType: 'message' | 'study_session' | 'connection'
  timestamp: Date
  weight?: number // Higher weight = stronger signal
}

/**
 * Recommendation Engine for study partner matching
 * Combines multiple signals to generate personalized recommendations
 */
export class RecommendationEngine {
  /**
   * Content-based filtering
   * Recommends users with similar preferences/attributes
   *
   * @returns Similarity score 0-100
   */
  static contentBasedScore(user1: UserPreferences, user2: UserPreferences): number {
    let score = 0

    // Subject overlap (highest weight - 40 points max)
    const subjectOverlap = this.jaccard(user1.subjects, user2.subjects)
    score += subjectOverlap * 40

    // Interest overlap (30 points max)
    const interestOverlap = this.jaccard(user1.interests, user2.interests)
    score += interestOverlap * 30

    // Skill level exact match (15 points)
    if (user1.skillLevel && user2.skillLevel && user1.skillLevel === user2.skillLevel) {
      score += 15
    }

    // Study style exact match (15 points)
    if (user1.studyStyle && user2.studyStyle && user1.studyStyle === user2.studyStyle) {
      score += 15
    }

    return Math.min(100, Math.round(score))
  }

  /**
   * Collaborative filtering
   * "Users similar to you also connected with..."
   *
   * @param userInteractions - Historical interaction data
   * @param currentUserId - User to generate recommendations for
   * @param limit - Number of recommendations
   */
  static collaborativeFiltering(
    userInteractions: UserInteraction[],
    currentUserId: string,
    limit = 10
  ): Array<{ userId: string; score: number }> {
    // 1. Find users similar to current user (based on interactions)
    const currentUserInteractions = userInteractions.filter(i => i.userId === currentUserId)
    const currentUserTargets = new Set(currentUserInteractions.map(i => i.targetUserId))

    // 2. Find other users who interacted with the same targets
    const similarUsers = new Map<string, number>() // userId -> similarity score

    for (const interaction of userInteractions) {
      if (interaction.userId === currentUserId) continue
      if (currentUserTargets.has(interaction.targetUserId)) {
        const score = similarUsers.get(interaction.userId) || 0
        const weight = this.getInteractionWeight(interaction)
        similarUsers.set(interaction.userId, score + weight)
      }
    }

    // 3. Get targets of similar users that current user hasn't interacted with
    const recommendations = new Map<string, number>() // targetUserId -> score

    for (const [similarUserId, similarity] of similarUsers.entries()) {
      const similarUserInteractions = userInteractions.filter(i => i.userId === similarUserId)

      for (const interaction of similarUserInteractions) {
        // Skip if current user already interacted with this target
        if (currentUserTargets.has(interaction.targetUserId)) continue
        if (interaction.targetUserId === currentUserId) continue

        const weight = this.getInteractionWeight(interaction)
        const score = recommendations.get(interaction.targetUserId) || 0
        recommendations.set(interaction.targetUserId, score + (similarity * weight))
      }
    }

    // 4. Sort and return top recommendations
    return Array.from(recommendations.entries())
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Hybrid recommendation
   * Combines content-based and collaborative filtering
   *
   * @param contentScore - Score from content-based filtering (0-100)
   * @param collaborativeScore - Score from collaborative filtering (0-100)
   * @param contentWeight - Weight for content-based score (0-1)
   */
  static hybridScore(
    contentScore: number,
    collaborativeScore: number,
    contentWeight = 0.6
  ): number {
    const collaborativeWeight = 1 - contentWeight
    return Math.round(
      (contentScore * contentWeight) + (collaborativeScore * collaborativeWeight)
    )
  }

  /**
   * Diversity-aware ranking
   * Re-ranks recommendations to increase diversity
   *
   * Prevents showing only users with same subject/interest
   */
  static diversifyRecommendations<T extends { userId: string }>(
    recommendations: T[],
    getUserAttributes: (userId: string) => string[],
    diversityFactor = 0.3
  ): T[] {
    if (recommendations.length <= 1) return recommendations

    const result: T[] = [recommendations[0]]
    const selectedAttributes = new Set(getUserAttributes(recommendations[0].userId))

    for (let i = 1; i < recommendations.length; i++) {
      let bestCandidate = recommendations[i]
      let bestDiversity = 0

      // Find candidate with most diverse attributes
      for (let j = i; j < Math.min(i + 5, recommendations.length); j++) {
        const candidate = recommendations[j]
        const candidateAttrs = getUserAttributes(candidate.userId)
        const uniqueAttrs = candidateAttrs.filter(attr => !selectedAttributes.has(attr))
        const diversity = uniqueAttrs.length / candidateAttrs.length

        if (diversity > bestDiversity) {
          bestDiversity = diversity
          bestCandidate = candidate
        }
      }

      result.push(bestCandidate)
      getUserAttributes(bestCandidate.userId).forEach(attr => selectedAttributes.add(attr))
    }

    return result
  }

  /**
   * Jaccard similarity coefficient
   * Measures overlap between two sets (0 = no overlap, 1 = identical)
   */
  private static jaccard(set1: string[], set2: string[]): number {
    if (set1.length === 0 && set2.length === 0) return 1

    const s1 = new Set(set1.map(s => s.toLowerCase().trim()))
    const s2 = new Set(set2.map(s => s.toLowerCase().trim()))

    const intersection = new Set([...s1].filter(x => s2.has(x)))
    const union = new Set([...s1, ...s2])

    if (union.size === 0) return 0
    return intersection.size / union.size
  }

  /**
   * Get weight for interaction type
   * Study sessions = strongest signal, messages = medium, connections = baseline
   */
  private static getInteractionWeight(interaction: UserInteraction): number {
    if (interaction.weight !== undefined) return interaction.weight

    switch (interaction.interactionType) {
      case 'study_session':
        return 3.0 // Strongest signal
      case 'message':
        return 2.0 // Medium signal
      case 'connection':
        return 1.0 // Baseline
      default:
        return 1.0
    }
  }

  /**
   * Time decay factor
   * Recent interactions are more valuable than old ones
   *
   * @param interactionDate - Date of interaction
   * @param halfLifeDays - Days until weight is halved (default: 30)
   */
  static timeDecayFactor(interactionDate: Date, halfLifeDays = 30): number {
    const now = new Date()
    const daysSince = (now.getTime() - interactionDate.getTime()) / (1000 * 60 * 60 * 24)
    return Math.pow(0.5, daysSince / halfLifeDays)
  }

  /**
   * Calculate recency-adjusted score
   */
  static applyTimeDecay(score: number, interactionDate: Date): number {
    return score * this.timeDecayFactor(interactionDate)
  }
}
