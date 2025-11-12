import { GoogleGenAI, Type } from "@google/genai";
import { GraphData, GraphNode, GraphLink } from '../types';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    entities: {
      type: Type.ARRAY,
      description: "A list of identified entities (people, places, concepts).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "A unique identifier for the entity, typically the name in lowercase and with spaces replaced by underscores."
          },
          label: {
            type: Type.STRING,
            description: "The display name of the entity."
          },
          type: {
            type: Type.STRING,
            description: "The category or type of the entity (e.g., 'Person', 'Location', 'Concept')."
          },
        },
        required: ["id", "label", "type"],
      },
    },
    relationships: {
      type: Type.ARRAY,
      description: "A list of relationships connecting the entities.",
      items: {
        type: Type.OBJECT,
        properties: {
          source: {
            type: Type.STRING,
            description: "The ID of the source entity for the relationship."
          },
          target: {
            type: Type.STRING,
            description: "The ID of the target entity for the relationship."
          },
          label: {
            type: Type.STRING,
            description: "A description of the relationship (e.g., 'knows', 'travels to', 'is a part of')."
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
    const basePrompt = `Based on the following document content, extract the key entities (people, places, major concepts) and their relationships to form a knowledge graph. Identify at least 5-10 key entities and the connections between them.`;
    
    const finalPrompt = `
      ${basePrompt}
      ${customPrompt ? `\n\nFollow these additional user instructions: "${customPrompt}"` : ''}
      
      Document Content: "${documentContent}"
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
    }));

    const links: GraphLink[] = parsedData.relationships.map((r: any) => ({
      source: r.source,
      target: r.target,
      label: r.label,
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