import {useWidgetSettings, WidgetProps} from "../components/widget";
import React from "react";
import {Badge, OverlayTrigger, Stack, Tooltip} from "react-bootstrap";

export const Widget = ({widgetId, connection, x, y, show, widgetType}:  WidgetProps) => {
  const [settings, setter] = useWidgetSettings(
    connection,
    {widget_error: null, ...widgetType.settings});

  // includes further hooks => must be called first
  const child = widgetType({settings, setter});

  const error = settings.widget_error;

  return (show &&
    <Stack gap={1} className="widget-dialog" style={{left: x + 50, top: y - 50}}>
      <Stack direction="horizontal" className="justify-content-between">
          <h5 style={{marginBottom: 0}}>{widgetType.widgetName}</h5>
        {error &&
              <OverlayTrigger
                show={!!error.details}
                placement="right"
                delay={{ show: 250, hide: 400 }}
                overlay={(props) => (<Tooltip {...props}>
                  {error.details}
                </Tooltip>)}>
              <Badge style={{display: "flex", alignSelf: "flex-start" }} bg={error.type}>{error.text}</Badge>
              </OverlayTrigger>

      }
      </Stack>
      <hr/>
      {child}
    </Stack>
  );
};

export default Widget;