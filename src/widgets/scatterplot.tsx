import React from "react";
import Form from "react-bootstrap/Form";
import {Col, Row, Stack} from "react-bootstrap";
import {CartesianGrid, Label, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis} from "recharts";

const ScatterPlotWidget = ({settings, setter}) => {
  const data = React.useMemo(() =>
    (settings.datax === null || settings.datay === null) ? [] :
    settings.datax.map((x, i) => ({x, y: settings.datay[i]})),
  [settings.datax, settings.datay]);

  return <Stack gap={2}>
    <Form>
          <Form.Group as={Row} >
            <Form.Label column sm={1}>X</Form.Label>
            <Col sm={11}>
            <Form.Select aria-label="Attribute x" id="x"
                         value={settings.x}
                         onChange={(e) => setter({x: e.target.value})}>
              {settings.attrs.map((attr) => <option key={attr}>{attr}</option>)}
            </Form.Select>
            </Col>
          </Form.Group>
          <Form.Group as={Row} >
            <Form.Label column sm={1}>Y</Form.Label>
            <Col sm={11}>
            <Form.Select aria-label="Attribute y" id="x"
                         value={settings.y}
                         onChange={(e) => setter({y: e.target.value})}>
              {settings.attrs.map((attr) => <option key={attr}>{attr}</option>)}
            </Form.Select>
            </Col>
          </Form.Group>
      </Form>
    <hr/>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid />
          <XAxis type="number" dataKey="x" name={settings.x}>
            <Label value={settings.x} position="bottom" offset={0} />
          </XAxis>
          <YAxis type="number" dataKey="y" name={settings.y}>
            <Label value={settings.y} position="insideLeft" style={{textAnchor: "middle"}} angle={-90} offset={0} />
          </YAxis>
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill="#8884d8" />
        </ScatterChart>
      </ResponsiveContainer>
    </Stack>;
};


ScatterPlotWidget.settings = {attrs: [], x: null, y: null, datax: null, datay: null};
ScatterPlotWidget.widgetName = "Scatter Plot";
ScatterPlotWidget.icon = (
  <>
	<circle fill="#333333" cx="29" cy="27.001" r="2.999"/>
	<circle fill="#333333" cx="29" cy="17.003" r="2.999"/>
	<circle fill="#333333" cx="18" cy="29.002" r="2.999"/>
	<circle fill="#333333" cx="23" cy="34.002" r="2.999"/>
	<circle fill="#333333" cx="13" cy="35.002" r="2.999"/>
	<circle fill="#333333" cx="21" cy="21.002" r="2.999"/>
	<circle fill="#333333" cx="38" cy="12.002" r="2.999"/>
	<circle fill="#333333" cx="37" cy="21.003" r="2.999"/>
    <polygon fill="#B2B2B2" points="8,40 8,6 6,6 6,40 6,40 6,42 6,42 8,42 42,42 42,40 "/>
  </>);


export default ScatterPlotWidget;