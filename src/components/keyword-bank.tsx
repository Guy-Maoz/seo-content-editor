'use client';

import { useState } from 'react';
import { FiCheck, FiX, FiLoader, FiInfo, FiPlus, FiMinus, FiThumbsDown, FiThumbsUp, FiRefreshCw } from 'react-icons/fi';
import { Keyword } from '@/types/keyword';

interface KeywordBankProps {
  title: string;
  keywords: Keyword[];
  onToggle: (keyword: Keyword) => void;
  onRemove: (keyword: Keyword) => void;
  isLoading: boolean;
  emptyMessage: string;
  loadingMessage?: string;
  variant?: 'default' | 'negative';
  onMoreKeywords?: () => Promise<void>;
  isLoadingMore?: boolean;
}

export default function KeywordBank({
  title,
  keywords,
  onToggle,
  onRemove,
  isLoading,
  emptyMessage,
  loadingMessage = "Loading keywords...",
  variant = 'default',
  onMoreKeywords,
  isLoadingMore = false
}: KeywordBankProps) {
  // Skeleton loader for metrics
  const MetricsSkeleton = () => (
    <div className="flex items-center space-x-2">
      <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-10 animate-pulse"></div>
    </div>
  );

  // Render a single keyword with metrics
  const KeywordItem = ({ 
    keyword,
    onToggle,
    onRemove,
  }: { 
    keyword: Keyword; 
    onToggle: (keyword: Keyword) => void;
    onRemove: (keyword: Keyword) => void;
  }) => (
    <div className={`flex items-center p-3 border-b border-gray-200 text-sm ${keyword.selected ? 'bg-blue-50' : ''}`}>
      <div className="flex-grow">
        <div className="font-medium text-gray-800">{keyword.keyword}</div>
        
        {keyword.metricsLoading ? (
          <MetricsSkeleton />
        ) : (
          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
            <span title="Search Volume">Vol: {keyword.volume.toLocaleString()}</span>
            <span className="text-gray-300">|</span>
            <span title="SEO Difficulty">
              Diff: <span className={`font-medium ${keyword.difficulty < 30 ? 'text-green-500' : keyword.difficulty < 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                {keyword.difficulty.toFixed(0)}
              </span>
            </span>
            <span className="text-gray-300">|</span>
            <span title="Cost Per Click">CPC: ${keyword.cpc.toFixed(2)}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {variant === 'default' && (
          <>
            <button 
              onClick={() => onToggle(keyword)}
              className={`p-1.5 rounded-full ${keyword.selected ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-400 hover:text-gray-600'}`}
              title={keyword.selected ? "Deselect keyword" : "Select keyword"}
            >
              <FiCheck size={16} />
            </button>
            
            <button 
              onClick={() => onRemove(keyword)}
              className="p-1.5 rounded-full border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300"
              title="Add to negative keywords"
            >
              <FiThumbsDown size={16} />
            </button>
          </>
        )}
        
        {variant === 'negative' && (
          <button 
            onClick={() => onRemove(keyword)}
            className="p-1.5 rounded-full border border-gray-300 text-gray-400 hover:text-blue-500 hover:border-blue-300"
            title="Remove from negative keywords"
          >
            <FiThumbsUp size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden h-full flex flex-col">
      <div className="bg-gray-50 border-b border-gray-300 p-3 flex justify-between items-center">
        <h3 className="font-medium text-gray-800">{title}</h3>
        <span className="text-xs text-gray-500">{keywords.length} keywords</span>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center p-6 text-blue-600">
          <FiLoader className="animate-spin mr-2" size={20} />
          <span>{loadingMessage}</span>
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && keywords.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 text-gray-500">
          <FiInfo size={24} className="mb-2" />
          <p className="text-center">{emptyMessage}</p>
        </div>
      )}
      
      {/* Keyword list */}
      {!isLoading && keywords.length > 0 && (
        <div className="flex-grow overflow-auto">
          <div className="divide-y divide-gray-200">
            {keywords.map((keyword, index) => (
              <KeywordItem 
                key={index} 
                keyword={keyword}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </div>
          
          {/* More keywords button */}
          {onMoreKeywords && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => onMoreKeywords()}
                disabled={isLoadingMore}
                className="w-full py-2 px-4 text-sm border border-blue-300 text-blue-600 rounded-md flex items-center justify-center hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <FiLoader className="animate-spin mr-2" size={16} />
                    Loading more keywords...
                  </>
                ) : (
                  <>
                    <FiRefreshCw className="mr-2" size={16} />
                    Find more keywords
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 