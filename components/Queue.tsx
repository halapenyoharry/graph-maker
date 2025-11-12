import React from 'react';
import { QueueItem, Status } from '../types';

interface QueueProps {
  queue: QueueItem[];
  onClear: () => void;
  onRemoveItem: (id: number) => void;
  onShowGraph: (id: number) => void;
  displayedGraphId: number | null;
}

const statusStyles = {
  [Status.Pending]: 'bg-gray-600 text-gray-300',
  [Status.Processing]: 'bg-blue-600 text-blue-100 animate-pulse',
  [Status.Completed]: 'bg-green-600 text-green-100',
  [Status.Failed]: 'bg-red-600 text-red-100',
};

const Queue: React.FC<QueueProps> = ({ queue, onClear, onRemoveItem, onShowGraph, displayedGraphId }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex-grow flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-cyan-400">Processing Queue</h2>
        <button
          onClick={onClear}
          className="text-sm bg-red-700 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition-colors duration-300 disabled:bg-gray-600"
          disabled={queue.length === 0}
        >
          Clear All
        </button>
      </div>
      <div className="flex-grow overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 450px)'}}>
        {queue.length === 0 ? (
          <p className="text-gray-500 text-center py-4">The queue is empty.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li
                key={item.id}
                className={`bg-gray-700 p-2 rounded-md flex items-center justify-between text-sm transition-all duration-200 
                            ${item.status === Status.Completed ? 'cursor-pointer hover:bg-gray-600' : ''}
                            ${displayedGraphId === item.id ? 'ring-2 ring-cyan-500' : ''}`}
                onClick={() => item.status === Status.Completed && onShowGraph(item.id)}
              >
                <div className="flex-grow truncate mr-2" title={item.source}>
                  {item.source}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[item.status]}`}
                  >
                    {item.status}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }} className="text-gray-400 hover:text-red-400">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Queue;