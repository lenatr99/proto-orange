import "./widgets.css";

import React from "react";
import Form from 'react-bootstrap/Form';
import {Button, Stack} from "react-bootstrap";

import { TiArrowRightThick } from "react-icons/ti";
import {useWidgetSettings, WidgetProps} from "../components/widget";

const DataSetWidget = ({connection, x, y, show}: WidgetProps) => {
  const [settings, setter] = useWidgetSettings(
    connection,
    {url: ""});
  const [url, setUrl] = React.useState(settings.url);

  return (show &&
    <div className="widget-dialog" style={{left: x - 100, top: y - 100}}>
      <Form.Label htmlFor="url">URL</Form.Label>
      <Stack direction="horizontal" gap={2}>
      <Form.Control
        type="text"
        id="urlEnter"
        as="input"
        value={url}
        onChange={(e) => { setUrl(e.target.value); }}
        onKeyDown = {(e) => {
            if (e.key === 'Enter' && settings.url !== url) {
              setter({url})
            }
            else if (e.key === 'Escape') {
              setUrl(settings.url);
            }
        }}
      />
      { settings.url !== url &&
      <Button onClick={() => setter({url})} variant="outline-primary"><TiArrowRightThick /></Button>
      }
      </Stack>
    </div>
      );
};


export default DataSetWidget;