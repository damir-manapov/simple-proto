// Service
export { MdmService } from "./mdm.service.js";
export { MatchingService } from "./matching.service.js";
export { MergeService } from "./merge.service.js";

// Utilities
export {
  levenshteinDistance,
  levenshteinSimilarity,
  soundex,
  soundexMatch,
  soundexSimilarity,
  normalizeString,
  getValueByPath,
  setValueByPath,
} from "./utils.js";
