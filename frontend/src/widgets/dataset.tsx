import "./widgets.css";

import React from "react";
import Form from 'react-bootstrap/Form';
import {Button, Stack} from "react-bootstrap";

import { TiArrowRightThick } from "react-icons/ti";

const DataSetWidget = ({settings, setter}) => {
  const [url, setUrl] = React.useState(settings.url);

  return (
      <Stack direction="horizontal" gap={2}>
      <Form.Control
        type="text"
        id="urlEnter"
        as="input"
        value={url}
        placeholder="Enter data set URL..."
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
  )
};


DataSetWidget.settings = {url: ""}
DataSetWidget.widgetName = "Data Set";
DataSetWidget.icon = (<>
<g>
  <path fill="#FFFFFF" d="M24.999,8.001H13.001V40h21.998V17.001c0-4.123-8-1-8-1C27.999,12.001,26.999,8.001,24.999,8.001z"/>
  <path fill="#333333" d="M27.999,6.001H13.001h-2v2V40v2h2h21.998h2v-2V16.001v-2L27.999,6.001z M34.999,40H13.001V8.001h11.998
		c2,0,3,4,2,8c0,0,8-3.123,8,1V40z"/>
</g>
<polyline fill="none" stroke="#333333" strokeWidth="2" strokeMiterlimit="10" points="17,29.088 17,35 31,35 31,29.088 "/>
<g>
  <g>
    <polygon fill="#333333" points="22.402,18.84 22.396,25.174 19.565,25.171 23.992,31.47 28.436,25.181 25.603,25.178
			25.612,18.844 		"/>
  </g>
</g></>);

export default DataSetWidget;