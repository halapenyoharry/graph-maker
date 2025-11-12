import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { GraphData, QueueItem, Status, GraphNode, GraphLink } from './types';
import { generateKnowledgeGraph } from './services/geminiService';
import InputArea from './components/InputArea';
import Queue from './components/Queue';
import KnowledgeGraph from './components/KnowledgeGraph';
import { contentSuggestions } from './constants';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source directly to the CDN URL to avoid invalid import syntax
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@^4.4.168/build/pdf.worker.mjs';


const MAX_CONCURRENT_JOBS = 3;
const CHUNK_SIZE = 7000; // Keep it safely under the model's context limit
const OVERLAP_SIZE = 500; // Overlap to maintain context between chunks

// Helper function to split text into manageable chunks
const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  if (text.length <= chunkSize) {
    return [text];
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += chunkSize - overlap;
    if (i >= text.length && end === text.length) break;
  }
  return chunks;
};

// Helper function to merge multiple graph data objects
const mergeGraphData = (graphs: GraphData[]): GraphData => {
  const mergedNodes = new Map<string, GraphNode>();
  const mergedLinks = new Map<string, GraphLink>();

  for (const graph of graphs) {
    if (!graph) continue;
    
    graph.nodes.forEach(node => {
      if (!mergedNodes.has(node.id)) {
        mergedNodes.set(node.id, node);
      }
    });

    graph.links.forEach(link => {
      const linkKey = `${link.source}-${link.target}-${link.label}`;
      if (!mergedLinks.has(linkKey)) {
        mergedLinks.set(linkKey, link);
      }
    });
  }

  const finalNodes = Array.from(mergedNodes.values());
  const nodeIds = new Set(finalNodes.map(n => n.id));
  
  const validLinks = Array.from(mergedLinks.values()).filter(
    link => nodeIds.has(link.source) && nodeIds.has(link.target)
  );

  return { nodes: finalNodes, links: validLinks };
};

// Helper function to extract text from a PDF file
const getTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n';
    }
    return fullText;
};


const App: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [graphs, setGraphs] = useState<{ [key: number]: GraphData }>({});
  const [displayedGraphId, setDisplayedGraphId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [autoFill, setAutoFill] = useState(true);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  const processItem = useCallback(async (itemToProcess: QueueItem) => {
    try {
      if (!process.env.API_KEY) {
        setIsApiKeyMissing(true);
        throw new Error("API Key is not configured.");
      }
      setIsApiKeyMissing(false);
      
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Processing } : item));
      setError(null);
      setIsLoadingGraph(true);

      let documentContent: string;
      if (itemToProcess.file) {
        if (itemToProcess.file.type === 'application/pdf') {
            documentContent = await getTextFromPdf(itemToProcess.file);
        } else {
            documentContent = await itemToProcess.file.text();
        }
      } else {
        try {
          const proxyUrl = 'https://api.allorigins.win/raw?url=';
          const response = await fetch(`${proxyUrl}${encodeURIComponent(itemToProcess.source)}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
          }
          if (itemToProcess.source.endsWith('.txt')) {
             documentContent = await response.text();
          } else {
            const htmlContent = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            documentContent = doc.body.textContent || 'Could not extract text content from URL.';
          }
          
          if (documentContent.trim().length < 200) {
             throw new Error(`Extracted text is too short. Please provide a direct link to a text file or upload one.`);
          }

        } catch (fetchError) {
          console.error('URL Fetching Error:', fetchError);
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'An unknown fetch error occurred.';
          throw new Error(`Failed to fetch or parse content from ${itemToProcess.source}. Error: ${errorMessage}`);
        }
      }

      const chunks = chunkText(documentContent, CHUNK_SIZE, OVERLAP_SIZE);
      
      const graphPromises = chunks.map(chunk =>
        generateKnowledgeGraph(chunk, itemToProcess.customPrompt).catch(e => {
          console.warn(`A chunk failed to process for ${itemToProcess.source}:`, e);
          return null; // Return null for failed chunks so Promise.all doesn't fail
        })
      );
      
      const chunkGraphs = await Promise.all(graphPromises);
      const validGraphs = chunkGraphs.filter((g): g is GraphData => g !== null);

      if (validGraphs.length === 0) {
        throw new Error("All chunks failed to process. Could not generate graph. This often happens with URLs that don't point to raw text.");
      }

      const mergedGraphData = mergeGraphData(validGraphs);
      
      setGraphs(prev => ({ ...prev, [itemToProcess.id]: mergedGraphData }));
      setDisplayedGraphId(itemToProcess.id);
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Completed } : item));

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process ${itemToProcess.source}: ${errorMessage}`);
      setQueue(prev => prev.map(item => item.id === itemToProcess.id ? { ...item, status: Status.Failed } : item));
    } finally {
        setIsLoadingGraph(false);
    }
  }, []);

  useEffect(() => {
    const processingCount = queue.filter(item => item.status === Status.Processing).length;
    const pendingItems = queue.filter(item => item.status === Status.Pending);

    if (autoFill && pendingItems.length === 0 && processingCount === 0 && queue.every(item => item.status === Status.Completed || item.status === Status.Failed)) {
      const existingSources = new Set(queue.map(item => item.source));
      const suggestionsToAdd = contentSuggestions
        .filter(url => !existingSources.has(url))
        .map(url => ({ id: Date.now() + Math.random(), source: url, status: Status.Pending, customPrompt: '' }));
      
      if (suggestionsToAdd.length > 0) {
        setQueue(prev => [...prev, suggestionsToAdd[0]]);
        return;
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

  const handleDownloadJson = () => {
    if (displayedGraphId && graphs[displayedGraphId]) {
      const currentItem = queue.find(item => item.id === displayedGraphId);
      const sourceName = currentItem ? currentItem.source.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'knowledge_graph';
      const filename = `${sourceName}.json`;

      const dataStr = JSON.stringify(graphs[displayedGraphId], null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = filename;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col md:flex-row p-4 gap-4">
      <div className="md:w-1/3 flex flex-col gap-4">
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">Knowledge Graph Generator</h1>
          <p className="text-sm text-gray-400 mb-4">
            Enter a URL to a plain text file (.txt) or upload a document (.txt, .md, .pdf). For books or complex documents, uploading a file is the most reliable method.
          </p>
          <InputArea onAddUrl={addUrlToQueue} onAddFile={addFileToQueue} />
          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="auto-fill-toggle" className="flex items-center cursor-pointer">
              <span className="mr-3 text-sm font-medium text-gray-300">Auto-fill with classic literature</span>
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
        {isLoadingGraph ? (
             <div className="flex-grow flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <svg className="animate-spin h-10 w-10 text-cyan-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-lg">Generating Knowledge Graph...</p>
                    <p className="text-sm">This may take a moment, especially for large documents.</p>
                </div>
            </div>
        ) : displayedGraphId && graphs[displayedGraphId] ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-cyan-400 truncate" title={queue.find(item => item.id === displayedGraphId)?.source}>
                Graph for: {queue.find(item => item.id === displayedGraphId)?.source}
              </h2>
              <button
                onClick={handleDownloadJson}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300 text-sm"
              >
                Download .json
              </button>
            </div>
            <KnowledgeGraph data={graphs[displayedGraphId]} />
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-gray-500">
            <div className="text-center">
               <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75c0 3.142-2.558 5.75-5.75 5.75S5.75 9.892 5.75 6.75c0-3.142 2.558-5.75 5.75-5.75s5.75 2.608 5.75 5.75zM17.25 6.75L19.5 9M17.25 6.75L15 9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 12.75c0 3.142-2.558 5.75-5.75 5.75S0 15.892 0 12.75c0-3.142 2.558-5.75 5.75-5.75s5.75 2.608 5.75 5.75z" transform="translate(5.75 5.25)" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 12.75L8 15M5.75 12.75L3.5 15" transform="translate(5.75 5.25)"/>
              </svg>
              <p className="mt-2">The knowledge graph will appear here.</p>
              <p className="text-sm">Add a file or URL to the queue to get started.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;