/**
 * Search Module - Enterprise-Level Smart Search
 *
 * Provides YouTube-like semantic search for partners and groups.
 * Understands concepts, synonyms, and meaning - not just keywords.
 */

export {
  searchPartnersSmartly,
  searchGroupsSmartly,
  generateProfileEmbedding,
  generateGroupEmbedding,
  batchGenerateProfileEmbeddings,
  batchGenerateGroupEmbeddings,
  type SemanticSearchParams,
  type GroupSearchParams,
  type PartnerSearchResult,
  type GroupSearchResult,
} from './semantic-search-service'
