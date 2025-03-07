'use client';

import { FiFileText, FiRefreshCw } from 'react-icons/fi';

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  label: string;
}

export default function GenerateButton({
  onClick,
  isLoading,
  isDisabled,
  label,
}: GenerateButtonProps) {
  return (
    <div>
      <button
        onClick={onClick}
        disabled={isDisabled || isLoading}
        className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-blue-300 disabled:cursor-not-allowed shadow-sm transition-colors"
      >
        {isLoading ? (
          <>
            <FiRefreshCw className="animate-spin mr-2" size={18} />
            Processing...
          </>
        ) : (
          <>
            <FiFileText className="mr-2" size={18} />
            {label}
          </>
        )}
      </button>
      {isDisabled && !isLoading && (
        <p className="mt-2 text-sm text-amber-600 font-medium text-center">
          Please select keywords to generate content
        </p>
      )}
    </div>
  );
} 