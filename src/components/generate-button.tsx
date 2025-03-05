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
    <div>
      <button
        onClick={onGenerate}
        disabled={isDisabled}
        className="w-full flex items-center justify-center px-6 py-2.5 border border-transparent text-base font-normal rounded-md text-white bg-blue-400 hover:bg-blue-500 focus:outline-none disabled:bg-blue-300 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <FiRefreshCw className="animate-spin mr-2 loading-spinner" size={18} />
            {isRegenerating ? 'Regenerating Content...' : 'Generating Content...'}
          </>
        ) : (
          <>
            <FiFileText className="mr-2" size={18} />
            {isRegenerating ? 'Regenerate Content' : 'Generate Content'}
          </>
        )}
      </button>
      {!hasSelectedKeywords && hasTopic && (
        <p className="mt-2 text-sm text-amber-600 font-medium">
          Please select at least one keyword to generate content.
        </p>
      )}
      {!hasTopic && (
        <p className="mt-2 text-sm text-amber-600 font-medium">
          Please enter a topic to generate content.
        </p>
      )}
    </div>
  );
} 