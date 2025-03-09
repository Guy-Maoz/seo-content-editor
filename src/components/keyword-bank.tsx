'use client';

import { useState } from 'react';
import { FiCheck, FiX, FiLoader, FiInfo, FiPlus, FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi';
import { Keyword } from '@/types/keyword';

interface KeywordBankProps {
  suggestedKeywords: Keyword[];
  usedKeywords: Keyword[];
  negativeKeywords: Keyword[];
  onSuggestedKeywordToggle: (keyword: Keyword) => void;
  onAddToNegative: (keyword: Keyword, source: 'suggested' | 'used') => void;
  onRemoveFromNegative: (keyword: Keyword) => void;
  isLoading: boolean;
}

export default function KeywordBank({
  suggestedKeywords,
  usedKeywords,
  negativeKeywords,
  onSuggestedKeywordToggle,
  onAddToNegative,
  onRemoveFromNegative,
  isLoading,
}: KeywordBankProps) {
  const [activeTab, setActiveTab] = useState<'suggested' | 'used' | 'negative'>('suggested');

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
    showCheckbox = false, 
    showRemoveButton = false,
    showNegativeButton = false, 
    onToggle,
    onRemove,
    onNegative
  }: { 
    keyword: Keyword; 
    showCheckbox?: boolean;
    showRemoveButton?: boolean;
    showNegativeButton?: boolean;
    onToggle?: () => void;
    onRemove?: () => void;
    onNegative?: () => void;
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
        {showCheckbox && (
          <button 
            onClick={onToggle}
            className={`p-1.5 rounded-full ${keyword.selected ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-400 hover:text-gray-600'}`}
            title={keyword.selected ? "Deselect keyword" : "Select keyword"}
          >
            <FiCheck size={16} />
          </button>
        )}
        
        {showNegativeButton && (
          <button 
            onClick={onNegative}
            className="p-1.5 rounded-full border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300"
            title="Add to negative keywords"
          >
            <FiThumbsDown size={16} />
          </button>
        )}
        
        {showRemoveButton && (
          <button 
            onClick={onRemove}
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
      <div className="bg-gray-50 border-b border-gray-300 p-3">
        <h3 className="font-medium text-gray-800">Keyword Bank</h3>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-300">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${activeTab === 'suggested' ? 'bg-white text-blue-600 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'}`}
          onClick={() => setActiveTab('suggested')}
        >
          Suggested ({suggestedKeywords.length})
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${activeTab === 'used' ? 'bg-white text-blue-600 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'}`}
          onClick={() => setActiveTab('used')}
        >
          Used ({usedKeywords.length})
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${activeTab === 'negative' ? 'bg-white text-blue-600 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'}`}
          onClick={() => setActiveTab('negative')}
        >
          Negative ({negativeKeywords.length})
        </button>
      </div>
      
      {/* Loading state */}
      {isLoading && activeTab === 'suggested' && (
        <div className="flex items-center justify-center p-6 text-blue-600">
          <FiLoader className="animate-spin mr-2" size={20} />
          <span>Loading keywords...</span>
        </div>
      )}
      
      {/* Empty states */}
      {!isLoading && suggestedKeywords.length === 0 && activeTab === 'suggested' && (
        <div className="flex flex-col items-center justify-center p-6 text-gray-500">
          <FiInfo size={24} className="mb-2" />
          <p className="text-center">Enter a topic to get keyword suggestions</p>
        </div>
      )}
      
      {usedKeywords.length === 0 && activeTab === 'used' && (
        <div className="flex flex-col items-center justify-center p-6 text-gray-500">
          <FiInfo size={24} className="mb-2" />
          <p className="text-center">No keywords have been used yet</p>
        </div>
      )}
      
      {negativeKeywords.length === 0 && activeTab === 'negative' && (
        <div className="flex flex-col items-center justify-center p-6 text-gray-500">
          <FiInfo size={24} className="mb-2" />
          <p className="text-center">No negative keywords added</p>
        </div>
      )}
      
      {/* Keyword lists */}
      <div className="flex-grow overflow-auto">
        {activeTab === 'suggested' && !isLoading && suggestedKeywords.length > 0 && (
          <div>
            <div className="bg-blue-50 p-3 text-xs text-blue-800 border-b border-blue-100">
              <div className="flex items-start">
                <FiInfo className="text-blue-500 mt-0.5 mr-1 flex-shrink-0" size={14} />
                <p>Select keywords to include in your content generation</p>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {suggestedKeywords.map((keyword, index) => (
                <KeywordItem 
                  key={index} 
                  keyword={keyword}
                  showCheckbox={true}
                  showNegativeButton={true}
                  onToggle={() => onSuggestedKeywordToggle(keyword)}
                  onNegative={() => onAddToNegative(keyword, 'suggested')}
                />
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'used' && usedKeywords.length > 0 && (
          <div>
            <div className="bg-green-50 p-3 text-xs text-green-800 border-b border-green-100">
              <div className="flex items-start">
                <FiInfo className="text-green-500 mt-0.5 mr-1 flex-shrink-0" size={14} />
                <p>These keywords are currently used in your content</p>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {usedKeywords.map((keyword, index) => (
                <KeywordItem 
                  key={index} 
                  keyword={keyword}
                  showNegativeButton={true}
                  onNegative={() => onAddToNegative(keyword, 'used')}
                />
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'negative' && negativeKeywords.length > 0 && (
          <div>
            <div className="bg-red-50 p-3 text-xs text-red-800 border-b border-red-100">
              <div className="flex items-start">
                <FiInfo className="text-red-500 mt-0.5 mr-1 flex-shrink-0" size={14} />
                <p>These keywords will be excluded from content generation</p>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {negativeKeywords.map((keyword, index) => (
                <KeywordItem 
                  key={index} 
                  keyword={keyword}
                  showRemoveButton={true}
                  onRemove={() => onRemoveFromNegative(keyword)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 