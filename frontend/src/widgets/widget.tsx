import {useWidgetSettings, WidgetProps} from "../components/widget";
import React from "react";
import {Badge, OverlayTrigger, Stack, Tooltip} from "react-bootstrap";
import { ImCross } from "react-icons/im";

const Head = ({x, y, onMove, title, error, closeWidget}) => {
  const start = React.useRef({x: null, y: null});

  const errorBadge = React.useMemo(() =>
    error && <Badge style={{display: "flex", alignSelf: "flex-start" }} bg={error.type}>{error.text}</Badge>
  ,
  [error]);

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

  return (
    <Stack direction="horizontal" className="justify-content-between widget-head"
    onMouseDown={onMouseDown}>
    <h5 className="widget-title">{title}</h5>
    {error?.details &&
      <OverlayTrigger
        placement="right"
        delay={{ show: 250, hide: 400 }}
        overlay={(props) => (<Tooltip {...props}>
          {error.details}
        </Tooltip>)}>
        { errorBadge }
      </OverlayTrigger>
    }
    <ImCross className="close-button" size={10} stroke="gray"
    onClick={closeWidget}/>
  </Stack>
  );
}

export const Widget = ({connection, x: initX, y: initY, show, widgetType, putOnTop, closeWidget}:  WidgetProps) => {
  const [settings, setter] = useWidgetSettings(
    connection,
    {widget_error: null, ...widgetType.settings});
  const [{x, y}, setPos] = React.useState({x: initX, y: initY});

  // includes further hooks => must be called first
  const child = widgetType({settings, setter});

  const error = settings.widget_error;

  return (show &&
    <Stack gap={1} className="widget-dialog"
           style={{left: x + 50, top: y - 50}}
           onMouseDown={putOnTop}>
      <Head title={widgetType.widgetName}
            error={error}
            x={x} y={y} onMove={setPos} closeWidget={closeWidget}/>
      <hr className="head"/>
      {child}
    </Stack>
  );
};

export default Widget;