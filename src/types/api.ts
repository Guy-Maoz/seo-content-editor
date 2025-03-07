// Type definitions for the OpenAI Assistant tools

export interface ToolCallOutput {
  tool_call_id: string;
  output: string;
}

export interface KeywordMetricsResponse {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  isFallback?: boolean;
  error?: string;
}

export interface AssistantToolResponse {
  answer: string;
  tool_calls: any[]; // This could be more specific depending on your needs
}

// Use this type for Similarweb API response parsing
export interface SimilarwebKeywordMetrics {
  volume: number;
  difficulty: number;
  cpc: number;
  isFallback?: boolean;
} 