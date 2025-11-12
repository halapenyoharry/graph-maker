
export enum Status {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
}

export interface QueueItem {
  id: number;
  source: string; // URL or filename
  file?: File;
  status: Status;
  customPrompt?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  group: string; // Type of entity, e.g., 'Person', 'Concept'
  sourceText: string;
  summary: string; // AI-generated interpretation of the node's significance
  shape?: 'circle' | 'diamond'; // Visual representation
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
  group: string; // Used for color-coding relationships
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
