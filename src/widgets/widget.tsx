import {useWidgetSettings, WidgetProps} from "../components/widget";
import React from "react";
import {Badge, OverlayTrigger, Stack, Tooltip} from "react-bootstrap";
import { ImEnlarge } from "react-icons/im";

const Mover = ({x, y, onMove, className}) => {
  const start = React.useRef({x: null, y: null});

  const onMouseDown = (e) => {
    const downX = e.clientX;
    const downY = e.clientY;
    start.current = {x, y};
    const onMouseMove = (e) => {
      const {x, y} = start.current;
      onMove({x: e.clientX - downX + x, y: e.clientY - downY + y});
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return <ImEnlarge className={className} onMouseDown={onMouseDown}/>
}

export const Widget = ({connection, x: initX, y: initY, show, widgetType}:  WidgetProps) => {
  const [settings, setter] = useWidgetSettings(
    connection,
    {widget_error: null, ...widgetType.settings});
  const [{x, y}, setPos] = React.useState({x: initX, y: initY});

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
        <Mover className="mover" x={x} y={y} onMove={setPos} />
      </Stack>
      <hr/>
      {child}
    </Stack>
  );
};

export default Widget;