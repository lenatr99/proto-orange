import React from "react";
import {useWidgetSettings, WidgetProps} from "../components/widget";

const InfoWidget = ({widgetId, connection, x, y, show}: WidgetProps) => {
  const [settings] = useWidgetSettings(
    connection,
    {instances: null, attributes: null});

  return (
    show &&
    <div className="widget-dialog" style={{position: "absolute", left: x, top: y}}>
      {settings.instances === null ? "No data." :
      `Data set with ${settings.instances} instances and ${settings.attributes} attributes.`}
    </div>
  );
};

InfoWidget.widgetName = "Info";

export default InfoWidget;