import React, {CSSProperties} from "react";

import {stopEvent} from "../utils";
import {useWidgetSettings, WidgetProps} from "../components/widget";

const colors = ["red", "green", "blue"];

const paletteStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "10px"
};

const colorButton: CSSProperties = {
  display: "inline",
  width: "20px",
  height: "20px",
  borderWidth: "3px",
  borderStyle: "solid"
}

const Palette = ({color, onColorClicked}) =>
  <div style={paletteStyle}>
    {colors.map((acolor) =>
      <div style={{...colorButton,
                   background: acolor,
                   borderColor: acolor === color ? color : "white"}}
           key={acolor}
           onClick={(event) => {
             event.stopPropagation();
             event.preventDefault();
             onColorClicked(acolor);
           }} /> )}
  </div>;

const PaletteWidget = ({widgetId, connection, x, y, show}: WidgetProps) => {
  const [settings, setter] = useWidgetSettings(
    connection,
    {color: "white", name: widgetId});

  const colorEdited = (color: string) => {
    setter({color});
  };

  return  show && <div className="widget-dialog" style={{left: x - 100, top: y - 100}}
               onMouseUp={stopEvent} onMouseDown={stopEvent}>
    <Palette color={settings.color} onColorClicked={colorEdited}/>
  </div>
};

export default PaletteWidget;