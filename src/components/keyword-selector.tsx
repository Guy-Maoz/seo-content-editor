'use client';

import { useState, useEffect } from 'react';
import { FiCheck, FiLoader, FiInfo } from 'react-icons/fi';

export interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  selected: boolean;
  isLoading?: boolean;
  metricsLoading?: boolean;
  source?: string;
}

interface KeywordSelectorProps {
  topic: string;
  keywords: Keyword[];
  onKeywordsChange: (keywords: Keyword[]) => void;
  isLoading: boolean;
  isEnriching: boolean;
}

export default function KeywordSelector({
  topic,
  keywords,
  onKeywordsChange,
  isLoading,
  isEnriching,
}: KeywordSelectorProps) {
  const toggleKeyword = (index: number) => {
    const updatedKeywords = [...keywords];
    updatedKeywords[index].selected = !updatedKeywords[index].selected;
    onKeywordsChange(updatedKeywords);
  };

  // Skeleton loader for metrics
  const MetricsSkeleton = () => (
    <>
      <div className="col-span-2 text-center">
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse"></div>
      </div>
      <div className="col-span-2 text-center">
        <div className="flex items-center justify-center">
          <div className="w-full bg-gray-200 rounded-full h-1.5 animate-pulse"></div>
          <div className="ml-2 h-4 bg-gray-200 rounded w-6 animate-pulse"></div>
        </div>
      </div>
      <div className="col-span-2 text-center">
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse"></div>
      </div>
    </>
  );

  return (
    <div className="border border-gray-400 rounded-md overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-300 bg-gray-50">
        {topic && (
          <div className="text-sm font-medium text-gray-700">
            Keywords for &quot;{topic}&quot;
          </div>
        )}
        {isLoading && (
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <FiLoader className="animate-spin mr-1 loading-spinner" size={14} />
            <span>Loading...</span>
          </div>
        )}
        {!isLoading && isEnriching && (
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <FiLoader className="animate-spin mr-1 loading-spinner" size={14} />
            <span>Enriching...</span>
          </div>
        )}
      </div>

      {!isLoading && topic && !isEnriching && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-2 text-xs text-gray-900">
          <div className="flex items-start">
            <FiInfo className="text-blue-500 mt-0.5 mr-1 flex-shrink-0" size={12} />
            <p>
              Keywords include monthly search volume, SEO difficulty (0-100), and cost-per-click.
            </p>
          </div>
        </div>
      )}

      {keywords.length > 0 && (
        <div className="space-y-2 mt-2">
          <div className="space-y-1">
            {keywords.map((keyword, index) => (
              <div
                key={index}
                className={`grid grid-cols-12 items-center py-2.5 px-3 text-xs border-t border-gray-200 transition-colors keyword-item ${
                  keyword.selected
                    ? 'selected'
                    : ''
                } ${keyword.source === 'similarweb' ? 'border-r-4 border-r-green-500' : ''}`}
              >
                <div className="col-span-1">
                  <button
                    onClick={() => toggleKeyword(index)}
                    className={`w-5 h-5 rounded-sm flex items-center justify-center border ${
                      keyword.selected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-400 hover:border-gray-600'
                    }`}
                    aria-label={keyword.selected ? 'Unselect keyword' : 'Select keyword'}
                  >
                    {keyword.selected && <FiCheck size={12} />}
                  </button>
                </div>
                <div className="col-span-5 font-medium text-gray-900 truncate" title={keyword.keyword}>
                  {keyword.keyword}
                </div>
                
                {keyword.metricsLoading ? (
                  <MetricsSkeleton />
                ) : (
                  <>
                    <div className="col-span-2 text-center text-gray-900 font-medium keyword-volume">
                      {keyword.volume.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-full difficulty-bar">
                          <div
                            className="difficulty-indicator"
                            style={{ width: `${keyword.difficulty}%` }}
                          ></div>
                        </div>
                        <span className="ml-1 text-gray-900 font-medium">{keyword.difficulty}</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-center text-gray-900 font-medium">
                      ${typeof keyword.cpc === 'number' ? keyword.cpc.toFixed(2) : parseFloat(keyword.cpc).toFixed(2)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 