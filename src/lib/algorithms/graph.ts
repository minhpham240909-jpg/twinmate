/**
 * Graph Algorithms for Social Network Analysis
 * Used for friend-of-friend recommendations and network analysis
 */

export interface UserNode {
  id: string
  connections: string[] // Connected user IDs
}

/**
 * Graph data structure for user network
 * Implements common graph algorithms for social recommendations
 */
export class UserGraph {
  private adjacencyList: Map<string, Set<string>>

  constructor() {
    this.adjacencyList = new Map()
  }

  /**
   * Add a user node to the graph
   */
  addUser(userId: string): void {
    if (!this.adjacencyList.has(userId)) {
      this.adjacencyList.set(userId, new Set())
    }
  }

  /**
   * Add bidirectional connection between two users
   */
  addConnection(userId1: string, userId2: string): void {
    this.addUser(userId1)
    this.addUser(userId2)
    this.adjacencyList.get(userId1)!.add(userId2)
    this.adjacencyList.get(userId2)!.add(userId1)
  }

  /**
   * Remove connection between two users
   */
  removeConnection(userId1: string, userId2: string): void {
    this.adjacencyList.get(userId1)?.delete(userId2)
    this.adjacencyList.get(userId2)?.delete(userId1)
  }

  /**
   * Get all direct connections of a user
   */
  getConnections(userId: string): string[] {
    return Array.from(this.adjacencyList.get(userId) || [])
  }

  /**
   * Find friend-of-friend recommendations
   * Returns users who are 2 connections away, sorted by mutual connections
   *
   * Algorithm: BFS at depth 2 with mutual friend counting
   */
  getFriendOfFriends(userId: string, limit = 10): Array<{ userId: string; mutualCount: number }> {
    const directFriends = this.adjacencyList.get(userId) || new Set()
    const friendOfFriends = new Map<string, number>() // userId -> mutual friend count

    // For each direct friend
    for (const friendId of directFriends) {
      const friendsFriends = this.adjacencyList.get(friendId) || new Set()

      // For each of their friends (friend-of-friend)
      for (const fofId of friendsFriends) {
        // Skip self and direct friends
        if (fofId === userId || directFriends.has(fofId)) continue

        // Count mutual friends
        const count = friendOfFriends.get(fofId) || 0
        friendOfFriends.set(fofId, count + 1)
      }
    }

    // Sort by mutual friend count (descending)
    return Array.from(friendOfFriends.entries())
      .map(([userId, mutualCount]) => ({ userId, mutualCount }))
      .sort((a, b) => b.mutualCount - a.mutualCount)
      .slice(0, limit)
  }

  /**
   * Calculate shortest path between two users (BFS)
   * Returns path length or -1 if not connected
   *
   * Use case: "You are 3 connections away from this user"
   */
  shortestPath(startId: string, endId: string): number {
    if (startId === endId) return 0
    if (!this.adjacencyList.has(startId) || !this.adjacencyList.has(endId)) return -1

    const queue: Array<[string, number]> = [[startId, 0]]
    const visited = new Set<string>([startId])

    while (queue.length > 0) {
      const [currentId, distance] = queue.shift()!
      const neighbors = this.adjacencyList.get(currentId) || new Set()

      for (const neighborId of neighbors) {
        if (neighborId === endId) return distance + 1

        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          queue.push([neighborId, distance + 1])
        }
      }
    }

    return -1 // Not connected
  }

  /**
   * Find all users within N degrees of separation
   *
   * @param userId - Starting user
   * @param maxDegrees - Maximum degrees of separation (1 = direct friends, 2 = friends of friends, etc.)
   * @returns Map of userId -> degree of separation
   */
  getUsersWithinDegrees(userId: string, maxDegrees: number): Map<string, number> {
    const result = new Map<string, number>()
    const queue: Array<[string, number]> = [[userId, 0]]
    const visited = new Set<string>([userId])

    while (queue.length > 0) {
      const [currentId, degree] = queue.shift()!

      if (degree > 0) {
        result.set(currentId, degree)
      }

      if (degree < maxDegrees) {
        const neighbors = this.adjacencyList.get(currentId) || new Set()
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId)
            queue.push([neighborId, degree + 1])
          }
        }
      }
    }

    return result
  }

  /**
   * Calculate network centrality for a user
   * Higher score = more connected user (influencer in the network)
   *
   * Uses degree centrality: number of direct connections
   */
  getCentrality(userId: string): number {
    return (this.adjacencyList.get(userId)?.size || 0)
  }

  /**
   * Find communities/clusters using simple connected components
   * Returns groups of highly connected users
   */
  findCommunities(): string[][] {
    const visited = new Set<string>()
    const communities: string[][] = []

    for (const userId of this.adjacencyList.keys()) {
      if (visited.has(userId)) continue

      // DFS to find connected component
      const community: string[] = []
      const stack = [userId]

      while (stack.length > 0) {
        const current = stack.pop()!
        if (visited.has(current)) continue

        visited.add(current)
        community.push(current)

        const neighbors = this.adjacencyList.get(current) || new Set()
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor)
          }
        }
      }

      if (community.length > 0) {
        communities.push(community)
      }
    }

    return communities.sort((a, b) => b.length - a.length)
  }

  /**
   * Get network statistics
   */
  getStats(): {
    totalUsers: number
    totalConnections: number
    avgConnectionsPerUser: number
    maxConnections: number
    minConnections: number
  } {
    const totalUsers = this.adjacencyList.size
    let totalConnections = 0
    let maxConnections = 0
    let minConnections = Infinity

    for (const connections of this.adjacencyList.values()) {
      const count = connections.size
      totalConnections += count
      maxConnections = Math.max(maxConnections, count)
      minConnections = Math.min(minConnections, count)
    }

    // Each connection counted twice (bidirectional)
    totalConnections = totalConnections / 2

    return {
      totalUsers,
      totalConnections,
      avgConnectionsPerUser: totalUsers > 0 ? totalConnections / totalUsers : 0,
      maxConnections,
      minConnections: minConnections === Infinity ? 0 : minConnections,
    }
  }
}

/**
 * Build graph from database matches
 * Utility function to construct UserGraph from Prisma query results
 */
export function buildGraphFromMatches(matches: Array<{ senderId: string; receiverId: string }>): UserGraph {
  const graph = new UserGraph()

  for (const match of matches) {
    graph.addConnection(match.senderId, match.receiverId)
  }

  return graph
}
