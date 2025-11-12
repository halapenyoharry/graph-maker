import React, { useState, useRef } from 'react';

interface InputAreaProps {
  onAddUrl: (url: string, customPrompt: string) => void;
  onAddFile: (file: File, customPrompt: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onAddUrl, onAddFile }) => {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAddUrl(url.trim(), customPrompt);
      setUrl('');
      setCustomPrompt('');
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        onAddFile(selectedFile, customPrompt);
        setFile(null); // Reset after adding
        setCustomPrompt('');
        if(fileInputRef.current) {
            fileInputRef.current.value = ""; // Clear the file input
        }
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleUrlSubmit} className="space-y-2">
        <label htmlFor="url-input" className="block text-sm font-medium text-gray-300">Add by URL</label>
        <div className="flex gap-2">
            <input
                id="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.gutenberg.org/files/2701/2701-0.txt"
                className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-200"
            />
            <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300 disabled:bg-gray-500"
                disabled={!url.trim()}
            >
                Add URL
            </button>
        </div>
      </form>
      
      <div>
        <label htmlFor="file-input" className="block text-sm font-medium text-gray-300">Or Upload a File</label>
        <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown,application/pdf"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-700 file:text-cyan-100 hover:file:bg-cyan-600"
        />
        <p className="text-xs text-gray-500 mt-1">Now supports PDF, .txt, and .md files. Recommended for accuracy.</p>
      </div>

      <div>
        <label htmlFor="custom-prompt" className="block text-sm font-medium text-gray-300">
          Custom Instructions (Optional)
        </label>
        <textarea
          id="custom-prompt"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., 'Focus on the main characters and their motivations.'"
          rows={3}
          className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-200"
        />
      </div>

    </div>
  );
};

export default InputArea;