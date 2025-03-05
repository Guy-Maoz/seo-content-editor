'use client';

import { FiFileText, FiRefreshCw } from 'react-icons/fi';

interface GenerateButtonProps {
  onGenerate: () => void;
  isGenerating: boolean;
  isRegenerating: boolean;
  hasSelectedKeywords: boolean;
  hasTopic: boolean;
}

export default function GenerateButton({
  onGenerate,
  isGenerating,
  isRegenerating,
  hasSelectedKeywords,
  hasTopic,
}: GenerateButtonProps) {
  const isDisabled = isGenerating || !hasSelectedKeywords || !hasTopic;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <button
        onClick={onGenerate}
        disabled={isDisabled}
        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <FiRefreshCw className="animate-spin mr-2" />
            {isRegenerating ? 'Regenerating Content...' : 'Generating Content...'}
          </>
        ) : (
          <>
            <FiFileText className="mr-2" />
            {isRegenerating ? 'Regenerate Content' : 'Generate Content'}
          </>
        )}
      </button>
      {!hasSelectedKeywords && hasTopic && (
        <p className="mt-2 text-sm text-amber-600">
          Please select at least one keyword to generate content.
        </p>
      )}
      {!hasTopic && (
        <p className="mt-2 text-sm text-amber-600">
          Please enter a topic to generate content.
        </p>
      )}
    </div>
  );
} 