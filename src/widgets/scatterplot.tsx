import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Form from "react-bootstrap/Form";
import { Col, Row, Stack } from "react-bootstrap";
import deepEqual from "fast-deep-equal/react";

const ScatterPlotWidget = ({ settings, setter }) => {
  const svgRef = useRef();
  const [selectedPoints, setSelectedPoints] = useState([]);

  const { attrs = [], datax = [], datay = [], x, y, colorAttr } = settings;

  const isColorAttrCategorical = colorAttr?.startsWith("cat_");

  const data = React.useMemo(
    () =>
      datax && datay
        ? datax.map((x, i) => ({
            id: i,
            x,
            y: datay[i],
            colorValue: settings[`datacolor`][i],
          }))
        : [],
    [datax, datay, settings, colorAttr]
  );

  const colorScale = React.useMemo(() => {
    if (isColorAttrCategorical) {
      const uniqueValues = [...new Set(data.map((d) => d.colorValue))];
      return d3.scaleOrdinal(d3.schemeCategory10).domain(uniqueValues);
    } else {
      return d3
        .scaleSequential(d3.interpolateBlues)
        .domain(d3.extent(data, (d) => d.colorValue));
    }
  }, [data, isColorAttrCategorical]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    console.log("the settings are", settings);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.x))
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.y))
      .range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    svg
      .selectAll(".dot")
      .data(data, (d) => d.id)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", 5)
      .style("fill", (d) =>
        selectedPoints.some((point) => point.id === d.id)
          ? "red"
          : colorScale(d.colorValue)
      )
      .style("fill-opacity", 0.75);

    const brush = d3
      .brush()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ])
      .on("end", brushended);

    svg.append("g").attr("class", "brush").call(brush);

    function brushended(event) {
      const selection = event.selection;
      if (!selection) {
        setSelectedPoints([]);
        return;
      }
      const [[x0, y0], [x1, y1]] = selection;
      const selected = data.filter((d) => {
        const cx = xScale(d.x),
          cy = yScale(d.y);
        return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
      });
      setSelectedPoints(selected);
    }

    const legendContainer = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 100}, 20)`);

    const updateLegend = () => {
      legendContainer.selectAll(".legend-entry").remove();

      let legendValues;

      if (isColorAttrCategorical) {
        legendValues = [...new Set(data.map((d) => d.colorValue))];
      } else {
        const extent = d3.extent(data, (d) => d.colorValue);
        legendValues = d3
          .scaleLinear()
          .domain(extent)
          .ticks(6)
          .map((d) => d.toFixed(1));
      }

      const legendEntryHeight = 20;
      const legendWidth = 150;
      const legendHeight = legendValues.length * legendEntryHeight + 10;

      legendContainer
        .append("rect")
        .attr("class", "legend-background")
        .attr("x", -5)
        .attr("y", -legendEntryHeight / 2)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "white")
        .style("opacity", 0.5);

      const legendEntries = legendContainer
        .selectAll(".legend-entry")
        .data(legendValues)
        .enter()
        .append("g")
        .attr("class", "legend-entry")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

      legendEntries
        .append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", (d) =>
          isColorAttrCategorical ? colorScale(d) : colorScale(+d)
        );

      legendEntries
        .append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .text((d) => d);
    };

    updateLegend();
  }, [data, selectedPoints, x, y, colorScale, isColorAttrCategorical]);

  const lastSelectedPointsRef = useRef([]);

  useEffect(() => {
    if (!deepEqual(selectedPoints, lastSelectedPointsRef.current)) {
      setter({
        ...settings,
        selected: selectedPoints.map((point) => point.id),
      });
      lastSelectedPointsRef.current = selectedPoints;
    }
  }, [selectedPoints, settings, setter]);

  return (
    <Stack gap={2}>
      <Form>
        <Form.Group as={Row}>
          <Form.Label column sm={1}>
            X
          </Form.Label>
          <Col sm={11}>
            <Form.Select
              aria-label="Attribute x"
              value={x || ""}
              onChange={(e) => setter({ ...settings, x: e.target.value })}
            >
              {attrs.map((attr) => (
                <option key={attr} value={attr}>
                  {attr}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Form.Group>
        <Form.Group as={Row}>
          <Form.Label column sm={1}>
            Y
          </Form.Label>
          <Col sm={11}>
            <Form.Select
              aria-label="Attribute y"
              value={y || ""}
              onChange={(e) => setter({ ...settings, y: e.target.value })}
            >
              {attrs.map((attr) => (
                <option key={attr} value={attr}>
                  {attr}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Form.Group>
        <Form.Group as={Row}>
          <Form.Label column sm={1}>
            Color
          </Form.Label>
          <Col sm={11}>
            <Form.Select
              aria-label="Color attribute"
              value={colorAttr || ""}
              onChange={(e) =>
                setter({ ...settings, colorAttr: e.target.value })
              }
            >
              <option value="">None</option>
              {attrs.map((attr) => (
                <option key={attr} value={attr}>
                  {attr}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Form.Group>
      </Form>
      <hr />
      <div style={{ width: "700px", height: "500px" }}>
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
    </Stack>
  );
};

ScatterPlotWidget.settings = {
  attrs: [],
  x: null,
  y: null,
  datax: null,
  datay: null,
  colorAttr: null,
};

ScatterPlotWidget.widgetName = "Scatter Plot";
ScatterPlotWidget.icon = (
  <>
    <circle fill="#333333" cx="29" cy="27.001" r="2.999" />
    <circle fill="#333333" cx="29" cy="17.003" r="2.999" />
    <circle fill="#333333" cx="18" cy="29.002" r="2.999" />
    <circle fill="#333333" cx="23" cy="34.002" r="2.999" />
    <circle fill="#333333" cx="13" cy="35.002" r="2.999" />
    <circle fill="#333333" cx="21" cy="21.002" r="2.999" />
    <circle fill="#333333" cx="38" cy="12.002" r="2.999" />
    <circle fill="#333333" cx="37" cy="21.003" r="2.999" />
    <polygon
      fill="#B2B2B2"
      points="8,40 8,6 6,6 6,40 6,40 6,42 6,42 8,42 42,42 42,40 "
    />
  </>
);

export default ScatterPlotWidget;
