export interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  selected: boolean;
  metricsLoading?: boolean;
  isLoading?: boolean;
  source?: string;
  error?: boolean;
  isFallback?: boolean;
} 