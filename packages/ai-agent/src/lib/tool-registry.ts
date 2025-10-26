/**
 * Tool Registry - Central registry for all AI agent tools
 * Production-grade with validation, categorization, and discovery
 */

import { Tool, ToolRegistry as IToolRegistry } from '../types'

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`)
    }

    // Validate tool structure
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name')
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool '${tool.name}' must have a description`)
    }
    if (!tool.inputSchema || !tool.outputSchema) {
      throw new Error(`Tool '${tool.name}' must have input and output schemas`)
    }
    if (typeof tool.call !== 'function') {
      throw new Error(`Tool '${tool.name}' must have a call function`)
    }

    this.tools.set(tool.name, tool as Tool)
    console.log(`✓ Registered tool: ${tool.name}${tool.category ? ` (${tool.category})` : ''}`)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  listByCategory(category: Tool['category']): Tool[] {
    return this.list().filter(tool => tool.category === category)
  }

  /**
   * Get tool definitions for LLM function calling
   */
  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: any
    }
  }> {
    return this.list().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.inputSchema),
      },
    }))
  }

  /**
   * Convert Zod schema to JSON Schema for LLM
   * (Simplified - in production use zod-to-json-schema library)
   */
  private zodToJsonSchema(schema: any): any {
    // Simplified implementation - extract description from Zod schema
    // In production, use a proper converter library
    try {
      return {
        type: 'object',
        properties: schema._def?.shape ?
          Object.fromEntries(
            Object.entries(schema._def.shape()).map(([key, val]: [string, any]) => [
              key,
              {
                type: this.inferType(val),
                description: val._def?.description || '',
              }
            ])
          ) : {},
        required: schema._def?.shape ? Object.keys(schema._def.shape()) : [],
      }
    } catch (error) {
      console.warn('Failed to convert schema to JSON Schema:', error)
      return { type: 'object' }
    }
  }

  private inferType(zodType: any): string {
    const typeName = zodType._def?.typeName
    if (!typeName) return 'string'

    if (typeName.includes('String')) return 'string'
    if (typeName.includes('Number')) return 'number'
    if (typeName.includes('Boolean')) return 'boolean'
    if (typeName.includes('Array')) return 'array'
    if (typeName.includes('Object')) return 'object'

    return 'string'
  }
}

// Global singleton registry
export const toolRegistry = new ToolRegistry()
