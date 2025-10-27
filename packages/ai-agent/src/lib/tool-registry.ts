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
    const definitions = this.list().map(tool => {
      const params = this.zodToJsonSchema(tool.inputSchema)
      console.log(`Tool ${tool.name} schema:`, JSON.stringify(params, null, 2))
      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: params,
        },
      }
    })
    console.log(`Generated ${definitions.length} tool definitions`)
    return definitions
  }

  /**
   * Convert Zod schema to JSON Schema for LLM
   * (Simplified - in production use zod-to-json-schema library)
   */
  private zodToJsonSchema(schema: any): any {
    // Simplified implementation - extract description from Zod schema
    // In production, use a proper converter library
    try {
      const shape = schema._def?.shape
      if (!shape) {
        console.warn('Schema has no shape:', schema)
        return {
          type: 'object',
          properties: {},
        }
      }

      const properties: Record<string, any> = {}
      const required: string[] = []

      // Get shape keys
      const shapeObj = typeof shape === 'function' ? shape() : shape

      for (const [key, val] of Object.entries(shapeObj)) {
        const fieldSchema: any = val

        // Check if optional
        const isOptional = fieldSchema._def?.typeName === 'ZodOptional' ||
                          fieldSchema._def?.typeName === 'ZodDefault'

        // Get inner type if optional/default
        const innerType = isOptional ? fieldSchema._def.innerType : fieldSchema

        properties[key] = {
          type: this.inferType(innerType),
          description: innerType._def?.description || fieldSchema._def?.description || '',
        }

        // Add to required if not optional
        if (!isOptional) {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
      }
    } catch (error) {
      console.error('Failed to convert schema to JSON Schema:', error, schema)
      return {
        type: 'object',
        properties: {},
      }
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
