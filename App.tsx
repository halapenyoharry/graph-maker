
import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { GraphData, QueueItem, Status } from './types';
import { generateKnowledgeGraph } from './services/geminiService';
import InputArea from './components/InputArea';
import Queue from './components/Queue';
import KnowledgeGraph from './components/KnowledgeGraph';
import { internetArchiveSuggestions } from './constants';

const MAX_CONCURRENT_JOBS = 3;

const App: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [graphs, setGraphs] = useState<{ [key: number]: GraphData }>({});
  const [displayedGraphId, setDisplayedGraphId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [autoFill, setAutoFill] = useState(true);

  const processItem = useCallback(async (itemToProcess: QueueItem) => {
    try {
      if (!process.env.API_KEY) {
        setIsApiKeyMissing(true);
        throw new Error("API Key is not configured.");
      }
      setIsApiKeyMissing(false);
      
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Processing } : item));
      setError(null);

      let documentContent: string;
      if (itemToProcess.file) {
        documentContent = await itemToProcess.file.text();
      } else {
        documentContent = `Simulated content for ${itemToProcess.source}. File uploads provide accurate content for analysis.`;
      }

      const graphData = await generateKnowledgeGraph(documentContent, itemToProcess.customPrompt);
      
      setGraphs(prev => ({ ...prev, [itemToProcess.id]: graphData }));
      setDisplayedGraphId(itemToProcess.id);
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Completed } : item));

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process ${itemToProcess.source}: ${errorMessage}`);
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Failed } : item));
    }
  }, []);

  useEffect(() => {
    const processingCount = queue.filter(item => item.status === Status.Processing).length;
    const pendingItems = queue.filter(item => item.status === Status.Pending);

    if (autoFill && pendingItems.length === 0 && processingCount === 0 && queue.every(item => item.status === Status.Completed || item.status === Status.Failed)) {
      const existingSources = new Set(queue.map(item => item.source));
      const suggestionsToAdd = internetArchiveSuggestions
        .filter(url => !existingSources.has(url))
        .map(url => ({ id: Date.now() + Math.random(), source: url, status: Status.Pending }));
      
      if (suggestionsToAdd.length > 0) {
        setQueue(prev => [...prev, ...suggestionsToAdd]);
        return; // Let the next useEffect run handle processing
      }
    }

    if (pendingItems.length > 0 && processingCount < MAX_CONCURRENT_JOBS) {
      const itemsToStart = pendingItems.slice(0, MAX_CONCURRENT_JOBS - processingCount);
      for (const item of itemsToStart) {
        processItem(item);
      }
    }
  }, [queue, processItem, autoFill]);

  const addUrlToQueue = (url: string, customPrompt: string) => {
    if (url && !queue.find(item => item.source === url)) {
      setQueue(prev => [...prev, { id: Date.now(), source: url, status: Status.Pending, customPrompt }]);
    }
  };
  
  const addFileToQueue = (file: File, customPrompt: string) => {
    if (file && !queue.find(item => item.source === file.name)) {
      setQueue(prev => [...prev, { id: Date.now(), source: file.name, file, status: Status.Pending, customPrompt }]);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setGraphs({});
    setDisplayedGraphId(null);
    setError(null);
  };
  
  const removeItemFromQueue = (id: number) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    setGraphs(prev => {
        const newGraphs = { ...prev };
        delete newGraphs[id];
        return newGraphs;
    });
    if (displayedGraphId === id) {
        setDisplayedGraphId(null);
    }
  };

  const handleShowGraph = (id: number) => {
    if (graphs[id]) {
        setDisplayedGraphId(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col md:flex-row p-4 gap-4">
      <div className="md:w-1/3 flex flex-col gap-4">
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">Knowledge Graph Generator</h1>
          <p className="text-sm text-gray-400 mb-4">
            Upload a plain text file (.txt, .md) or enter a URL to generate a knowledge graph. The app can process up to 3 items concurrently.
          </p>
          <InputArea onAddUrl={addUrlToQueue} onAddFile={addFileToQueue} />
          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="auto-fill-toggle" className="flex items-center cursor-pointer">
              <span className="mr-3 text-sm font-medium text-gray-300">Auto-fill from Internet Archive</span>
              <div className="relative">
                <input type="checkbox" id="auto-fill-toggle" className="sr-only" checked={autoFill} onChange={() => setAutoFill(!autoFill)} />
                <div className={`block w-10 h-6 rounded-full ${autoFill ? 'bg-cyan-600' : 'bg-gray-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoFill ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
           {isApiKeyMissing && (
              <div className="mt-4 bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-md" role="alert">
                <strong className="font-bold">Missing API Key!</strong>
                <span className="block sm:inline"> Please configure your Gemini API key to proceed.</span>
              </div>
            )}
        </div>
        <Queue 
          queue={queue} 
          onClear={clearQueue} 
          onRemoveItem={removeItemFromQueue}
          onShowGraph={handleShowGraph}
          displayedGraphId={displayedGraphId}
        />
      </div>
      <main className="md:w-2/3 bg-gray-800 p-4 rounded-lg shadow-lg flex-grow flex flex-col">
        {error && (
          <div className="bg-red-800 text-red-200 p-3 rounded-md mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}
        {displayedGraphId && graphs[displayedGraphId] ? (
          <KnowledgeGraph data={graphs[displayedGraphId]} />
        ) : (
          <div className="flex-grow flex items-center justify-center text-gray-500">
            <div className="text-center">
               <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75c0 3.142-2.558 5.75-5.75 5.75S5.75 9.892 5.75 6.75c0-3.142 2.558-5.75 5.75-5.75s5.75 2.608 5.75 5.75zM17.25 6.75L19.5 9M17.25 6.75L15 9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 12.75c0 3.142-2.558 5.75-5.75 5.75S0 15.892 0 12.75c0-3.142 2.558-5.75 5.75-5.75s5.75 2.608 5.75 5.75z" transform="translate(5.75 5.25)" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 12.75L8 15M5.75 12.75L3.5 15" transform="translate(5.75 5.25)"