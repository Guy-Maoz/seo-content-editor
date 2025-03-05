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

  // Skeleton loader for a keyword row
  const KeywordSkeleton = () => (
    <div className="grid grid-cols-12 items-center py-2 px-3 rounded-md bg-gray-50 animate-pulse">
      <div className="col-span-1">
        <div className="w-5 h-5 rounded bg-gray-200"></div>
      </div>
      <div className="col-span-5">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
      <div className="col-span-2 text-center">
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>
      <div className="col-span-2 text-center">
        <div className="flex items-center justify-center">
          <div className="w-full bg-gray-200 rounded-full h-1.5"></div>
          <div className="ml-2 h-4 bg-gray-200 rounded w-6"></div>
        </div>
      </div>
      <div className="col-span-2 text-center">
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Keywords for &quot;{topic}&quot;
        </h2>
        {isLoading && (
          <div className="flex items-center text-blue-500">
            <FiLoader className="animate-spin mr-2" />
            <span>Loading keywords...</span>
          </div>
        )}
        {!isLoading && isEnriching && (
          <div className="flex items-center text-blue-500">
            <FiLoader className="animate-spin mr-2" />
            <span>Enriching with real data...</span>
          </div>
        )}
      </div>

      {!isLoading && topic && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 flex items-start">
          <FiInfo className="text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-gray-900">
            Keywords are generated using AI and enriched with metrics from SimilarWeb when available. 
            Metrics include monthly search volume, SEO difficulty (0-100), and estimated cost-per-click.
            {isEnriching && " Keywords are being enriched with real data..."}
          </p>
        </div>
      )}

      {keywords.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-12 text-sm font-medium text-gray-900 border-b pb-2 mb-2">
            <div className="col-span-1"></div>
            <div className="col-span-5">Keyword</div>
            <div className="col-span-2 text-center">Volume</div>
            <div className="col-span-2 text-center">Difficulty</div>
            <div className="col-span-2 text-center">CPC ($)</div>
          </div>
          {keywords.map((keyword, index) => (
            keyword.isLoading ? (
              <KeywordSkeleton key={`skeleton-${index}`} />
            ) : (
              <div
                key={index}
                className={`grid grid-cols-12 items-center py-2 px-3 rounded-md transition-colors ${
                  keyword.selected
                    ? 'bg-blue-50 border border-blue-100'
                    : 'hover:bg-gray-50'
                } ${keyword.source === 'similarweb' ? 'border-l-4 border-l-green-500' : ''}`}
              >
                <div className="col-span-1">
                  <button
                    onClick={() => toggleKeyword(index)}
                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                      keyword.selected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300'
                    }`}
                    aria-label={keyword.selected ? 'Unselect keyword' : 'Select keyword'}
                  >
                    {keyword.selected && <FiCheck size={14} />}
                  </button>
                </div>
                <div className="col-span-5 font-medium text-gray-900 truncate" title={keyword.keyword}>
                  {keyword.keyword}
                </div>
                <div className="col-span-2 text-center text-gray-900">
                  {keyword.volume.toLocaleString()}
                </div>
                <div className="col-span-2 text-center">
                  <div className="flex items-center justify-center">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{ width: `${keyword.difficulty}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-sm text-gray-900">{keyword.difficulty}</span>
                  </div>
                </div>
                <div className="col-span-2 text-center text-gray-900">
                  ${typeof keyword.cpc === 'number' ? keyword.cpc.toFixed(2) : parseFloat(keyword.cpc).toFixed(2)}
                </div>
              </div>
            )
          ))}
        </div>
      ) : !isLoading ? (
        <div className="text-center py-6 text-gray-900">
          Enter a topic to get keyword suggestions
        </div>
      ) : null}
    </div>
  );
} 