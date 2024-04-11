import React from "react";

export const widgetR = 32;


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


const WidgetNode = ({data, onMouseWidget, onMouseEar, onHover, selected, widgetType }) => {
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
        <circle className={"widget"} cx={data.x} cy={data.y} r={widgetR}
                fill="#fdfdc0" stroke="#f0f0b0" strokeWidth={2}
                onMouseDown={onMouseWidgetDown} />
        <Ear x={data.x} y={data.y} side="left" onMouseDown={(event: React.MouseEvent) => onMouseEarDown("left", event)}/>
        <Ear x={data.x} y={data.y} side="right" onMouseDown={(event: React.MouseEvent) => onMouseEarDown("right", event)}/>
        { !!widgetType.icon &&
          <g transform={`translate(${data.x - widgetR + 8} ${data.y - widgetR + 8})`}
             style={{pointerEvents: "none"}}>
            {widgetType.icon}
          </g> }
        <text x={data.x} y={data.y + 1.3 * widgetR } textAnchor="middle" dy=".5em">{widgetType.widgetName}</text>
    </g>
};

export default WidgetNode;