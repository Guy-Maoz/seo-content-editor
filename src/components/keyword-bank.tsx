'use client';

import { FiCheck, FiX, FiLoader, FiThumbsDown } from 'react-icons/fi';
import { Keyword } from '@/types/keyword';

interface KeywordBankProps {
  title: string;
  keywords: Keyword[];
  onToggle: (keyword: Keyword) => void;
  onAddToNegative?: (keyword: Keyword) => void;
  onRemove?: (keyword: Keyword) => void;
  isLoading?: boolean;
  showCheckboxes?: boolean;
  isNegative?: boolean;
}

export default function KeywordBank({
  title,
  keywords,
  onToggle,
  onAddToNegative,
  onRemove,
  isLoading = false,
  showCheckboxes = true,
  isNegative = false
}: KeywordBankProps) {
  // Skeleton loader for metrics
  const MetricsSkeleton = () => (
    <div className="flex items-center space-x-2">
      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-10 animate-pulse"></div>
    </div>
  );

  // Individual keyword item component
  const KeywordItem = ({ keyword }: { keyword: Keyword }) => (
    <div className={`border rounded-md p-3 mb-2 ${keyword.selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          {showCheckboxes && (
            <div 
              className={`mr-3 h-5 w-5 flex items-center justify-center rounded border ${
                keyword.selected 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'border-gray-300 bg-white'
              } cursor-pointer`}
              onClick={() => onToggle(keyword)}
            >
              {keyword.selected && <FiCheck className="h-4 w-4" />}
            </div>
          )}
          <div>
            <div className="font-medium text-gray-800">{keyword.keyword}</div>
            <div className="mt-1 text-xs flex items-center space-x-3">
              {keyword.metricsLoading ? (
                <MetricsSkeleton />
              ) : (
                <>
                  {keyword.volume !== undefined && (
                    <div className="flex items-center" title="Monthly search volume">
                      <span className="text-blue-700 font-medium">{keyword.volume.toLocaleString()}</span>
                      <span className="ml-1 text-gray-500">vol</span>
                    </div>
                  )}
                  {keyword.difficulty !== undefined && (
                    <div className="flex items-center" title="SEO difficulty score">
                      <span 
                        className={`font-medium ${
                          keyword.difficulty < 30 ? 'text-green-600' : 
                          keyword.difficulty < 60 ? 'text-orange-500' : 
                          'text-red-600'
                        }`}
                      >
                        {keyword.difficulty}
                      </span>
                      <span className="ml-1 text-gray-500">diff</span>
                    </div>
                  )}
                  {keyword.cpc !== undefined && (
                    <div className="flex items-center" title="Cost per click">
                      <span className="text-green-600 font-medium">${keyword.cpc.toFixed(2)}</span>
                      <span className="ml-1 text-gray-500">cpc</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          {isNegative ? (
            <button 
              onClick={() => onRemove && onRemove(keyword)}
              className="p-1 text-red-500 hover:bg-red-50 rounded-full"
              title="Remove from negative keywords"
            >
              <FiX className="h-4 w-4" />
            </button>
          ) : (
            <button 
              onClick={() => onAddToNegative && onAddToNegative(keyword)}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-full"
              title="Add to negative keywords"
            >
              <FiThumbsDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="border rounded-md overflow-hidden bg-white shadow-sm">
      <div className="bg-gray-50 border-b px-4 py-3">
        <h2 className="font-medium text-gray-800">{title}</h2>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="flex items-center space-x-2">
              <FiLoader className="animate-spin text-blue-500" />
              <span className="text-gray-500">Loading keywords...</span>
            </div>
          </div>
        ) : keywords.length === 0 ? (
          <div className="py-4 text-center text-gray-500">
            <p>No keywords available</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {keywords.map((keyword) => (
              <KeywordItem key={keyword.keyword} keyword={keyword} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 