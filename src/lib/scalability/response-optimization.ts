/**
 * Response Optimization
 *
 * Utilities for optimizing API responses for high-concurrency scenarios.
 * Reduces payload sizes and improves response times.
 *
 * SCALABILITY: Essential for handling 1000-3000 concurrent users
 *
 * Features:
 * - Field selection (return only needed fields)
 * - Response truncation
 * - Pagination helpers
 * - Content compression hints
 */

import { SCALABILITY_CONFIG } from './config'

export interface OptimizationOptions {
  // Fields to include in response
  includeFields?: string[]

  // Fields to exclude from response
  excludeFields?: string[]

  // Maximum array items to return
  maxArrayItems?: number

  // Maximum string length for text fields
  maxStringLength?: number

  // Enable deep optimization (nested objects)
  deepOptimize?: boolean
}

/**
 * Optimize a response object by selecting/excluding fields and truncating content
 */
export function optimizeResponse<T extends Record<string, unknown>>(
  data: T,
  options: OptimizationOptions = {}
): Partial<T> {
  const {
    includeFields,
    excludeFields = [],
    maxArrayItems,
    maxStringLength,
    deepOptimize = true,
  } = options

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    // Skip excluded fields
    if (excludeFields.includes(key)) {
      continue
    }

    // Only include specified fields if provided
    if (includeFields && !includeFields.includes(key)) {
      continue
    }

    // Optimize the value
    result[key] = optimizeValue(value, {
      maxArrayItems,
      maxStringLength,
      deepOptimize,
    })
  }

  return result as Partial<T>
}

/**
 * Optimize a single value based on its type
 */
function optimizeValue(
  value: unknown,
  options: {
    maxArrayItems?: number
    maxStringLength?: number
    deepOptimize?: boolean
  }
): unknown {
  const { maxArrayItems, maxStringLength, deepOptimize } = options

  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle strings - truncate if needed
  if (typeof value === 'string') {
    if (maxStringLength && value.length > maxStringLength) {
      return value.slice(0, maxStringLength) + '...'
    }
    return value
  }

  // Handle arrays - limit size
  if (Array.isArray(value)) {
    let optimizedArray = value

    // Limit array size
    if (maxArrayItems && value.length > maxArrayItems) {
      optimizedArray = value.slice(0, maxArrayItems)
    }

    // Deep optimize array items
    if (deepOptimize) {
      optimizedArray = optimizedArray.map((item) =>
        typeof item === 'object' && item !== null
          ? optimizeValue(item, options)
          : item
      )
    }

    return optimizedArray
  }

  // Handle objects - recursively optimize
  if (typeof value === 'object' && deepOptimize) {
    const optimizedObject: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      optimizedObject[key] = optimizeValue(val, options)
    }
    return optimizedObject
  }

  // Return other types as-is
  return value
}

/**
 * Check if response should be compressed
 */
export function shouldCompress(data: unknown): boolean {
  if (!SCALABILITY_CONFIG.api.enableCompression) {
    return false
  }

  const jsonString = JSON.stringify(data)
  return jsonString.length > 1024 // Compress if larger than 1KB
}

/**
 * Get compression hints for response headers
 */
export function compressResponse(data: unknown): {
  data: unknown
  headers: Record<string, string>
} {
  const jsonString = JSON.stringify(data)
  const shouldGzip = jsonString.length > 1024

  return {
    data,
    headers: {
      'Content-Type': 'application/json',
      ...(shouldGzip ? { 'Content-Encoding': 'gzip' } : {}),
      'Cache-Control': 'private, no-cache',
    },
  }
}

/**
 * Paginate an array with offset/limit
 */
export function paginateArray<T>(
  items: T[],
  options: {
    page?: number
    limit?: number
    offset?: number
  }
): {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
} {
  const { page = 1, limit = 20, offset } = options

  const startIndex = offset !== undefined ? offset : (page - 1) * limit
  const paginatedItems = items.slice(startIndex, startIndex + limit)

  return {
    items: paginatedItems,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
      hasMore: startIndex + limit < items.length,
    },
  }
}

/**
 * Select only specified fields from an object
 */
export function selectFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {}

  for (const field of fields) {
    if (field in data) {
      result[field] = data[field]
    }
  }

  return result
}

/**
 * Truncate text content to specified length
 */
export function truncateContent(
  content: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (content.length <= maxLength) {
    return content
  }

  return content.slice(0, maxLength - suffix.length) + suffix
}

/**
 * Calculate response size in bytes
 */
export function calculateResponseSize(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length
}

/**
 * Check if response exceeds maximum size
 */
export function exceedsMaxSize(data: unknown): boolean {
  const size = calculateResponseSize(data)
  return size > SCALABILITY_CONFIG.api.maxResponseSize
}

/**
 * Create an optimized API response with proper headers
 */
export function createOptimizedResponse<T>(
  data: T,
  options: {
    status?: number
    cacheControl?: string
    includeFields?: string[]
    excludeFields?: string[]
    maxArrayItems?: number
  } = {}
): {
  body: Partial<T> | T
  status: number
  headers: Record<string, string>
} {
  const {
    status = 200,
    cacheControl = 'private, max-age=0',
    includeFields,
    excludeFields,
    maxArrayItems,
  } = options

  // Optimize if options provided
  const optimizedData =
    includeFields || excludeFields || maxArrayItems
      ? optimizeResponse(data as Record<string, unknown>, {
          includeFields,
          excludeFields,
          maxArrayItems,
        })
      : data

  const responseSize = calculateResponseSize(optimizedData)

  return {
    body: optimizedData as Partial<T> | T,
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'X-Response-Size': responseSize.toString(),
      ...(responseSize > 10240 ? { 'X-Large-Response': 'true' } : {}),
    },
  }
}

export default {
  optimizeResponse,
  compressResponse,
  paginateArray,
  selectFields,
  truncateContent,
  calculateResponseSize,
  exceedsMaxSize,
  createOptimizedResponse,
}
