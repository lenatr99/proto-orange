import React from "react";
import {useSyncedReducer} from "../hooks";
import {stopEvent} from "../utils";

export const widgetR = 30;

const useWidgetSettings = ({socket, sessionId, widgetId}, initialState: {[index: string]: any}) =>
    useSyncedReducer(
        (state, changes: {[setting: string]: any}) => ({...state, ...changes}),
        initialState, socket, sessionId, `widget-settings-${widgetId}`);


const Ear = ({x, y, side, onMouseDown }) => {
    const start = side === "right" ? Math.PI / 5 : Math.PI * 6 / 5;
    const end = start - Math.PI / 2.5;
    const rr = widgetR * 1.25;
    const sx = x + rr * Math.cos(start);
    const sy = y + rr * Math.sin(start);
    const ex = x + rr * Math.cos(end);
    const ey = y + rr * Math.sin(end);
    return <g className="widget-ear" onMouseDown={onMouseDown} >
        <path d={`M ${sx} ${sy} A ${rr} ${rr} 0 0 0 ${ex} ${ey}`}
              fill="none" stroke="000000ff" strokeWidth="5" onMouseDown={onMouseDown} />
        <path d={`M ${sx} ${sy} A ${rr} ${rr} 0 0 0 ${ex} ${ey}`}
              fill="none" />
    </g>
};


export const Widget = ({data, onMouseWidget, onMouseEar, onHover, selected, isOpen, connection }) => {
    const [settings, setter] = useWidgetSettings(
        connection,
        {color: "white", name: data.widgetId});

    const onMouseWidgetDown = (event: React.MouseEvent) => {
        if (event.button !== 0) {
            return;
        }
        onMouseWidget(data.widgetId, event.clientX, event.clientY, event);
    };

    const onMouseEarDown = (side: "left" | "right", event: React.MouseEvent) => {
        if (event.button !== 0) {
            return;
        }
        onMouseEar(data.widgetId, side, event);
    };

    return <g onMouseEnter={() => onHover(data.widgetId, true) }
              onMouseLeave={() => onHover(data.widgetId, false) }>
        { selected && <circle cx={data.x} cy={data.y} r={widgetR + 4} fill="blue" fillOpacity="0.3" /> }
        <circle className={"widget"} cx={data.x} cy={data.y} r={widgetR} strokeWidth={`${data.isOpen ? 3: 1.5}px`}
                fill={settings.color || "white"}
                onMouseDown={onMouseWidgetDown} />
        <Ear x={data.x} y={data.y} side="left" onMouseDown={(event: React.MouseEvent) => onMouseEarDown("left", event)}/>
        <Ear x={data.x} y={data.y} side="right" onMouseDown={(event: React.MouseEvent) => onMouseEarDown("right", event)}/>
        <text x={data.x} y={data.y + 1.3 * widgetR } textAnchor="middle" dy=".5em">{settings.name.slice(0, 8)}</text>
        {isOpen
            && <WidgetDialog x={data.x} y={data.y} onDataChanged={(color: string) => setter({color})} />
        }
    </g>
};

const colors = ["red", "green", "blue"];

const Palette = ({onColorClicked}) =>
    <div className="palette">
        {colors.map((color) =>
            <div className="color-button" key={color} style={{background: color}}
                 onClick={(event) => {
                     event.stopPropagation();
                     event.preventDefault();
                     onColorClicked(color);
                 }} /> )}
    </div>;

const WidgetDialog = ({x, y, onDataChanged}) => {
    const colorEdited = (color: string) => {
        onDataChanged(color)
    };
    return <g className="widget-dialog">
        <foreignObject x={x - 65} y={y - 100}>
            <div className={"widget-dialog"}
                 onMouseUp={stopEvent} onMouseDown={stopEvent}>
                <Palette onColorClicked={colorEdited}/>
            </div>
        </foreignObject>
    </g>
};

export default Widget;