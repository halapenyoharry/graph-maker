import { GoogleGenAI, Type } from "@google/genai";
import { GraphData, GraphNode, GraphLink } from '../types';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    entities: {
      type: Type.ARRAY,
      description: "A list of key entities (people, places, objects) and abstract concepts/themes.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "A unique identifier for the entity, lowercase with underscores (e.g., 'captain_ahab')."
          },
          label: {
            type: Type.STRING,
            description: "The display name of the entity (e.g., 'Captain Ahab')."
          },
          type: {
            type: Type.STRING,
            description: "The category of the entity. Use 'Person', 'Location', 'Object' for concrete things, and 'Concept' for abstract themes or ideas."
          },
          sourceText: {
            type: Type.STRING,
            description: "A brief, verbatim text snippet from the document that introduces or defines this entity. This grounds the entity in the source."
          },
          summary: {
            type: Type.STRING,
            description: "A concise, 1-2 sentence interpretation of this entity's role, significance, or motivation within the document. Explain WHY it is important."
          }
        },
        required: ["id", "label", "type", "sourceText", "summary"],
      },
    },
    relationships: {
      type: Type.ARRAY,
      description: "A list of meaningful relationships connecting the entities.",
      items: {
        type: Type.OBJECT,
        properties: {
          source: {
            type: Type.STRING,
            description: "The ID of the source entity."
          },
          target: {
            type: Type.STRING,
            description: "The ID of the target entity."
          },
          label: {
            type: Type.STRING,
            description: "A concise description of the relationship (e.g., 'is obsessed with', 'symbolizes', 'conflicts with'). Avoid simple verbs like 'is' or 'has'."
          },
        },
        required: ["source", "target", "label"],
      },
    },
  },
  required: ["entities", "relationships"],
};

export const generateKnowledgeGraph = async (documentContent: string, customPrompt?: string): Promise<GraphData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Gemini API calls will fail.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const basePrompt = `You are a sophisticated analyst. Your task is to read the following document and transform it into a knowledge graph by interpreting its core themes, characters, and their connections. Do not just extract data; provide an analysis.

    Instructions:
    1.  Identify the main entities (people, places) AND the central abstract concepts/themes.
    2.  For each entity and concept, provide a brief, verbatim 'sourceText' snippet from the document.
    3.  Crucially, for each entity and concept, write a 1-2 sentence 'summary' that interprets its significance, role, or motivation.
    4.  Define meaningful relationships between these entities and concepts. Use descriptive labels that explain the nature of the connection (e.g., 'driven by', 'conflicts with', 'symbolizes').
    5.  Structure your entire output according to the provided JSON schema.`;
    
    const finalPrompt = `
      ${basePrompt}
      ${customPrompt ? `\n\nFollow these additional user instructions: "${customPrompt}"` : ''}
      
      Document Content to Analyze: "${documentContent}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);

    if (!parsedData.entities || !parsedData.relationships) {
        throw new Error("AI response did not contain 'entities' or 'relationships' fields.");
    }

    const nodes: GraphNode[] = parsedData.entities.map((e: any) => ({
      id: e.id,
      label: e.label,
      group: e.type,
      sourceText: e.sourceText || "No context provided.",
      summary: e.summary || "No interpretation provided.",
      shape: e.type === 'Concept' ? 'diamond' : 'circle',
    }));

    const links: GraphLink[] = parsedData.relationships.map((r: any) => ({
      source: r.source,
      target: r.target,
      label: r.label,
      group: r.label, // Use label for color grouping
    }));

    // Ensure all link sources/targets exist as nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    return { nodes, links: validLinks };
  } catch (error) {
    console.error("Error generating knowledge graph:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error("The provided Gemini API key is not valid. Please check your configuration.");
    }
    throw new Error("Failed to parse the response from the AI model.");
  }
};
