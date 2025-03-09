'use client';

import React, { useState, ReactNode } from 'react';
import { FiChevronLeft, FiChevronRight, FiInfo } from 'react-icons/fi';

interface SidePanelProps {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
}

const SidePanel: React.FC<SidePanelProps> = ({ 
  children, 
  title = 'AI Insights', 
  defaultOpen = false 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div 
      className={`fixed top-0 right-0 h-full bg-white shadow-lg transition-all duration-300 z-10 flex ${
        isOpen ? 'w-96' : 'w-12'
      }`}
      style={{ maxWidth: 'calc(100vw - 20px)' }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-0 top-1/2 -translate-x-1/2 transform rounded-full bg-blue-500 text-white p-1 shadow-md z-20 flex items-center justify-center w-8 h-8 hover:bg-blue-600 transition-colors"
        aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
      >
        {isOpen ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
      </button>

      {/* Panel content */}
      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* Header */}
        {isOpen && (
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-medium flex items-center">
              <FiInfo className="mr-2 text-blue-500" />
              {title}
            </h2>
          </div>
        )}

        {/* Content area - only show when open */}
        <div className={`flex-1 overflow-auto ${isOpen ? 'block' : 'hidden'}`}>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidePanel; 