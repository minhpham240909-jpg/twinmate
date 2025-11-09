/**
 * Pagination Utility
 * Provides safe pagination calculations with configurable limits
 */

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResult {
  limit: number
  offset: number
  page: number
}

/**
 * Calculate pagination offset and limit with safety checks
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Pagination parameters
 */
export function getPagination(
  page: number = 1,
  limit: number = 20,
  maxLimit: number = 100
): PaginationResult {
  // Ensure page is at least 1
  const safePage = Math.max(1, Math.floor(page))
  
  // Ensure limit is between 1 and maxLimit
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), maxLimit)
  
  // Calculate offset (0-indexed)
  const offset = (safePage - 1) * safeLimit
  
  return {
    limit: safeLimit,
    offset,
    page: safePage,
  }
}

/**
 * Parse pagination params from query string or request body
 * @param params - Raw pagination parameters
 * @param defaults - Default values
 * @returns Parsed pagination result
 */
export function parsePaginationParams(
  params: Record<string, unknown>,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationResult {
  const page = typeof params.page === 'number' 
    ? params.page 
    : typeof params.page === 'string' 
    ? parseInt(params.page, 10) 
    : defaults.page ?? 1
    
  const limit = typeof params.limit === 'number'
    ? params.limit
    : typeof params.limit === 'string'
    ? parseInt(params.limit, 10)
    : defaults.limit ?? 20
    
  return getPagination(page, limit, defaults.maxLimit)
}

/**
 * Calculate total pages from total items
 * @param totalItems - Total number of items
 * @param limit - Items per page
 * @returns Total number of pages
 */
export function getTotalPages(totalItems: number, limit: number): number {
  return Math.ceil(totalItems / limit)
}

/**
 * Check if there's a next page
 * @param page - Current page
 * @param totalItems - Total number of items
 * @param limit - Items per page
 * @returns True if there's a next page
 */
export function hasNextPage(page: number, totalItems: number, limit: number): boolean {
  return page < getTotalPages(totalItems, limit)
}

/**
 * Check if there's a previous page
 * @param page - Current page
 * @returns True if there's a previous page
 */
export function hasPreviousPage(page: number): boolean {
  return page > 1
}

/**
 * Generate pagination metadata for API responses
 * @param page - Current page
 * @param limit - Items per page
 * @param totalItems - Total number of items
 * @returns Pagination metadata
 */
export function getPaginationMetadata(
  page: number,
  limit: number,
  totalItems: number
) {
  const totalPages = getTotalPages(totalItems, limit)
  
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: hasNextPage(page, totalItems, limit),
    hasPreviousPage: hasPreviousPage(page),
  }
}
