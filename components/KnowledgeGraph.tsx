import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types';

interface KnowledgeGraphProps {
  data: GraphData;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const { nodes, links } = data;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);

    svg.selectAll("*").remove(); // Clear previous graph

    const g = svg.append("g"); // Add a container group for zooming

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(35));

    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    const color = d3.scaleOrdinal(d3.schemeCategory10);
      
    const node = g
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(drag(simulation));

    node.append("circle")
      .attr("r", 10)
      .attr("fill", (d: any) => color(d.group));

    node.append("text")
        .attr("x", 12)
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
    <div ref={containerRef} className="w-full h-full flex-grow cursor-grab active:cursor-grabbing">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default KnowledgeGraph;