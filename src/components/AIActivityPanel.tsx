'use client';

import { useState, useEffect } from 'react';
import { FiInfo, FiCheck, FiLoader, FiAlertCircle, FiActivity, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type AIOperation = {
  id: string;
  type: 'keyword-generation' | 'content-creation' | 'keyword-analysis' | 'info';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message: string;
  detail?: string;
  timestamp: Date;
  progress?: number; // 0-100
};

type AIActivityPanelProps = {
  operations: AIOperation[];
  isOpen?: boolean;
  onToggle?: () => void;
};

const AIActivityPanel = ({ 
  operations = [], 
  isOpen = false, 
  onToggle = () => {} 
}: AIActivityPanelProps) => {
  const [open, setOpen] = useState(isOpen);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  // Check for new operations and set notification indicator
  useEffect(() => {
    if (operations.length > 0 && !open) {
      const hasInProgress = operations.some(op => op.status === 'in-progress');
      const hasRecentComplete = operations.some(op => 
        op.status === 'completed' && 
        (new Date().getTime() - op.timestamp.getTime() < 60000)
      );
      setHasNewActivity(hasInProgress || hasRecentComplete);
    } else {
      setHasNewActivity(false);
    }
  }, [operations, open]);

  const handleToggle = () => {
    setOpen(!open);
    onToggle();
  };

  // Function to determine the icon for each operation type and status
  const getOperationIcon = (operation: AIOperation) => {
    if (operation.status === 'in-progress') {
      return <FiLoader className="animate-spin text-blue-500" />;
    } else if (operation.status === 'completed') {
      return <FiCheck className="text-green-500" />;
    } else if (operation.status === 'failed') {
      return <FiAlertCircle className="text-red-500" />;
    } else {
      return <FiInfo className="text-blue-400" />;
    }
  };

  // Function to get a CSS class based on operation type for visual distinction
  const getOperationClass = (type: AIOperation['type']) => {
    switch (type) {
      case 'keyword-generation':
        return 'border-blue-200 bg-blue-50';
      case 'content-creation':
        return 'border-green-200 bg-green-50';
      case 'keyword-analysis':
        return 'border-purple-200 bg-purple-50';
      case 'info':
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  // Count in-progress operations
  const inProgressCount = operations.filter(op => op.status === 'in-progress').length;

  return (
    <div className={`fixed top-0 right-0 h-full z-10 flex transition-all duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Toggle button on the left edge */}
      <button
        onClick={handleToggle}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full h-24 w-8 
                  bg-indigo-600 text-white rounded-l-md flex items-center justify-center
                  hover:bg-indigo-700 focus:outline-none shadow-md"
        aria-label={open ? "Close AI Activity Panel" : "Open AI Activity Panel"}
      >
        {open ? <FiChevronRight /> : (
          <div className="flex flex-col items-center">
            <FiChevronLeft />
            <span className="writing-mode-vertical text-xs mt-1 font-medium">
              AI Activity
            </span>
            {hasNewActivity && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </div>
        )}
      </button>
      
      {/* Main panel */}
      <div className="w-80 h-full bg-white border-l shadow-xl flex flex-col">
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
          <h2 className="font-semibold flex items-center">
            <FiActivity className="mr-2" /> 
            AI Activity {inProgressCount > 0 && `(${inProgressCount} active)`}
          </h2>
          <button
            onClick={handleToggle}
            className="text-white hover:bg-indigo-700 p-1 rounded-full"
            aria-label="Close panel"
          >
            <FiX />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {operations.length === 0 ? (
            <div className="text-gray-500 text-center p-6 h-full flex flex-col items-center justify-center">
              <FiActivity className="text-gray-400 text-4xl mb-3" />
              <p>No AI activity recorded yet.</p>
              <p className="text-sm mt-2">Activities will appear here when you use AI features.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation) => (
                <div 
                  key={operation.id} 
                  className={`p-3 border rounded-md shadow-sm ${getOperationClass(operation.type)}`}
                >
                  <div className="flex items-start">
                    <div className="mt-1 mr-3 flex-shrink-0">{getOperationIcon(operation)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{operation.message}</div>
                      
                      {operation.detail && (
                        <div className="text-sm text-gray-600 mt-1">{operation.detail}</div>
                      )}
                      
                      {operation.progress !== undefined && operation.status === 'in-progress' && (
                        <div className="mt-2">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${operation.progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 text-right">
                            {operation.progress}% complete
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 mt-2">
                        {operation.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIActivityPanel; 