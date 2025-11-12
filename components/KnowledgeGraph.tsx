import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode } from '../types';

interface KnowledgeGraphProps {
  data: GraphData;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || !tooltipRef.current) return;

    const { nodes, links } = data;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    svg.selectAll("*").remove(); // Clear previous graph

    const g = svg.append("g"); // Add a container group for zooming

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // Use a color scale for links based on their group (label)
    const linkColor = d3.scaleOrdinal(d3.schemeCategory10);

    const link = g
      .append("g")
      .attr("stroke-opacity", 0.7)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => linkColor(d.group))
      .attr("stroke-width", 2);

    const nodeColor = d3.scaleOrdinal(d3.schemeAccent);
      
    const node = g
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(drag(simulation));

    // --- Tooltip Logic ---
    node.on("mouseover", (event, d: any) => {
        tooltip.style("opacity", 1)
               .html(`
                  <div class="font-bold text-cyan-400 text-base">${d.label} <span class="text-xs text-gray-400 font-light">(${d.group})</span></div>
                  <div class="mt-2">
                    <strong class="text-gray-300 font-semibold text-sm">Summary:</strong>
                    <p class="text-sm text-gray-300">${d.summary}</p>
                  </div>
                  <div class="mt-2 border-t border-gray-700 pt-2">
                     <strong class="text-gray-400 font-semibold text-xs">Source Text:</strong>
                     <p class="text-xs text-gray-400 italic">"${d.sourceText}"</p>
                  </div>
               `)
               .style("left", `${event.pageX + 15}px`)
               .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    // Draw circles for regular nodes and diamonds for concepts
    node.each(function(d: any) {
        const group = d3.select(this);
        if (d.shape === 'diamond') {
            group.append('path')
                .attr('d', d3.symbol().type(d3.symbolDiamond).size(250))
                .attr('fill', nodeColor(d.group));
        } else {
            group.append("circle")
                .attr("r", 10)
                .attr("fill", nodeColor(d.group));
        }
    });

    node.append("text")
        .attr("x", 15)
        .attr("y", "0.31em")
        .text((d: any) => d.label)
        .style("font-size", "12px")
        .style("fill", "#ddd")
        .attr("stroke", "none")
        .attr("stroke-width", 0);


    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);

    // Drag functionality
    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
        function dragstarted(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: any, d: any) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
    
    return () => {
      simulation.stop();
    };

  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full flex-grow cursor-grab active:cursor-grabbing relative">
      <svg ref={svgRef} className="w-full h-full"></svg>
      <div 
        ref={tooltipRef} 
        className="absolute p-3 bg-gray-900 border border-cyan-700 rounded-md shadow-lg text-gray-200 pointer-events-none transition-opacity duration-300"
        style={{ opacity: 0, maxWidth: '350px' }}
      ></div>
    </div>
  );
};

export default KnowledgeGraph;
