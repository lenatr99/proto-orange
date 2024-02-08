import React, {useState} from "react";
import io from "socket.io-client";
import { v4 as uuidv4} from 'uuid';

import {useSyncedReducer} from "../hooks";
import {stopEvent} from "../utils";
import Widget, {widgetR} from "./widget";


const normalizedRect = (x1: number, y1: number,
                        x2: number, y2: number) =>
    [Math.min(x1, x2), Math.max(x1, x2),
     Math.min(y1, y2), Math.max(y1, y2)];


const Bezier = ({x1, y1, x2, y2, className}) =>
    <path className={className}
          d={`M ${x1} ${y1} C ${x1 + 30} ${y1} ${x2 - 30} ${y2} ${x2} ${y2}`} />


const ConnectingLine = ({x1, y1, x2, y2}) =>
    <g>
        { ["hoverArea", "hovered", "connection"].map((className) =>
            <Bezier className={className} key={className}
                    x1={x1} y1={y1} x2={x2} y2={y2} />) }
    </g>


const TempConnection = ({x1, y1, x2, y2, side}) => {
    return <g className="connection temp">
        { side === "right"
            ? <Bezier className="connection"
                      x1={x1} y1={y1} x2={x2} y2={y2} />
            : <Bezier className="connection"
                      x1={x2} y1={y2} x2={x1} y2={y1} /> }
        <circle cx={x1} cy={y1} r={3} fill="grey"/>
    </g>
}


const Connection = ({x1, y1, x2, y2, onMouseUp}) => {
    return <g className="connection"
              onMouseUp={(event) => stopEvent(event) || onMouseUp()}
              onMouseDown={stopEvent}>
        <ConnectingLine x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={x1} cy={y1} r={3} fill="grey"/>
        <circle cx={x2} cy={y2} r={3} fill="grey"/>
    </g>
}

interface IWidgetData {
    x: number;
    y: number;
    name: string;
    id?: string;
    isOpen: boolean;
}

interface IWidgetList {
    [id: string]: IWidgetData;
}

export const Canvas = () =>  {
    const newWidgetId = uuidv4;
    const [socket, setSocket] = useState(null);
    const sessionId: string = React.useMemo(uuidv4, []);

    React.useEffect(() => {
        const socket = io('http://localhost:4000');
        setSocket(socket);
        return () => {
            socket.disconnect();
        };
    }, []);

    const [widgets, widgetAction] = useSyncedReducer(
        (state: IWidgetList, {type, ...args}) => {
            switch (type) {
                case "addWidget": {
                    const id = args.id || newWidgetId();
                    return {...state,
                            [id]: {...args, name: args.name || id, id, isOpen: false}}
                }
                case "removeWidget": {
                    return Object.fromEntries(
                        Object.entries(state)
                            .filter(([id, _]) => id !== args.widgetId));
                }
                case "removeWidgets": {
                    return Object.fromEntries(
                        Object.entries(state)
                            .filter(([id, _]) => !args.selection.includes(id)));
                }
                case "dragWidget":
                case "moveWidget": {
                    const {widgetId, x, y} = args;
                    return {...state,
                            [widgetId]: {...state[widgetId], x, y}};
                }
                case "flipOpen": {
                    const {widgetId} = args;
                    return {...state,
                            [widgetId]: {...state[widgetId],
                                         isOpen: !state[widgetId].isOpen}};
                }
                default:
                    throw new Error(`Unknown action type: ${type}`);
            }
        },
        {} as IWidgetList,
        socket, sessionId, "widget-action",
        ["dragWidget", "flipOpen"]);

    const [connections, connectionsAction] = useSyncedReducer(
        (state, {type, ...args}): [string, string][] => {
            switch (type) {
                case "addConnection": {
                    const {sourceId, targetId} = args;
                    if (state.find(([s, t]) => s === sourceId && t === targetId))
                        return state;
                    return [...state, [sourceId, targetId]];
                }
                case "removeConnection": {
                    const {sourceId, targetId} = args;
                    return state.filter(
                        ([s, t]) => s !== sourceId || t !== targetId);
                }
                case "removeWidgets": {
                    const {selection} = args;
                    return state.filter(
                        ([s, t]) => !selection.includes(s) && !selection.includes(t));
                }
                default:
                    throw new Error(`Unknown action type: ${type}`);
            }
        },
        [] as [string, string][],
        socket, sessionId, "connection-action"
    );

    const [{mouseX, mouseY}, setMouseState] = React.useState({mouseX: null, mouseY: null});
    const [[downX, downY, distance], setDown] = React.useState([null, null, null]);
    const [moveOrigins, setMoveState] = React.useState([]);
    const [{sourceId, side, targetId }, setEarState] = React.useState({sourceId: null, side: null, targetId: null});
    const [selection, setSelection] = React.useState([] as string[]);

    const addWidget = (x: number, y: number, defaultId=null) => {
        const id = defaultId || newWidgetId();
        widgetAction({type: "addWidget", x, y, name: id, id})
    }

    const resetMoveState = () => {
        setDown([null, null, null]);
        setMoveState([]);
        setEarState({sourceId: null, side: null, targetId: null});
    }

    const clearSelection = () => {
        setSelection([]);
    }

    const widgetMouse = (widgetId: string, x: number, y: number, event: React.MouseEvent) => {
        stopEvent(event);
        const thisWidget = [widgetId, widgets[widgetId].x, widgets[widgetId].y];
        if (!selection.includes(widgetId)) {
            clearSelection();
            setMoveState([thisWidget]);
        }
        else {
            setMoveState([
                thisWidget,
                ...Array.from(
                    selection.filter((id) => id !== widgetId),
                    (id) => [id, widgets[id].x, widgets[id].y]
                )
            ]);
        }
        setDown([x, y, 0]);
    }

    const earMouse = (widgetId: string, side: string, event: React.MouseEvent) => {
        stopEvent(event);
        clearSelection();
        setEarState({sourceId: widgetId, side, targetId: null});
    }

    const onMouseDown = (event: React.MouseEvent) => {
        setDown([event.clientX, event.clientY, 0]);
    }

    const onMouseMove = (event: React.MouseEvent) => {
        setMouseState({mouseX: event.clientX, mouseY: event.clientY});
        setDown([downX, downY,
            Math.max(distance,
                     Math.sqrt((downX - event.clientX) ** 2
                               + (downY - event.clientY) ** 2))
        ]);
        moveOrigins.forEach(([id, ox, oy]) => {
            widgetAction({type: "dragWidget", widgetId: id,
                          x: ox + event.clientX - downX,
                          y: oy + event.clientY - downY});
        })
        stopEvent(event);
    }

    const onMouseUp = (event: React.MouseEvent) => {
        if (moveOrigins.length) {
            if (distance < 4) {
                clearSelection();
                widgetAction({type: "flipOpen", widgetId: moveOrigins[0][0]});
            }
            else {
                moveOrigins.forEach(([id, ox, oy]) => {
                    widgetAction({type: "moveWidget", widgetId: id,
                                  x: ox + event.clientX - downX,
                                  y: oy + event.clientY - downY});
                })
            }
        }
        else if (sourceId) {
            let actTargetId = targetId;
            if (!actTargetId) {
                actTargetId = newWidgetId();
                addWidget(event.clientX, event.clientY, actTargetId);
            }
            if ((actTargetId !== sourceId) && (!connections.find(([s, t]) => s === sourceId && t === actTargetId))) {
                if (side === "right") {
                    connectionsAction({type: "addConnection",
                                       sourceId, targetId: actTargetId});
                } else {
                    connectionsAction({type: "addConnection",
                                       sourceId: actTargetId, targetId: sourceId});
                }
            }
        }
        else if (downX !== null && distance > 4) {
            if (!moveOrigins.length) {
                const [x1, x2, y1, y2] = normalizedRect(downX, downY,
                                                        event.clientX, event.clientY);
                setSelection(Object.keys(widgets).filter((id) => {
                    const widget = widgets[id];
                    return widget.x + widgetR > x1 && widget.x - widgetR < x2
                        && widget.y + widgetR > y1 && widget.y - widgetR < y2;
                }))
            }
        }
        else {
            clearSelection();
            addWidget(event.clientX, event.clientY);
        }
        resetMoveState();
    }

    const keyHandler = (event: React.KeyboardEvent) => {
        if (event.key === "Backspace" || event.key === "Delete") {
            connectionsAction({type: "removeWidgets", selection});
            widgetAction({type: "removeWidgets", selection});
            clearSelection();
        }
    }
    const registerHover = (widgetId: string, hover) => {
        if (sourceId) {
            if (hover) {
                setEarState(state => ({...state, targetId: widgetId}))
            } else if (targetId === widgetId) {
                setEarState(state => ({...state, targetId: null}))
            }
        }
    }

    const [srx1, srx2, sry1, sry2] = normalizedRect(downX, downY, mouseX, mouseY);

    return <svg width="100%" height="1000" tabIndex={0}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onKeyUp={keyHandler}>
        { connections.map(([sourceId, targetId]) => {
            const source = widgets[sourceId];
            const target = widgets[targetId];
            return <Connection x1={source.x + 1.25 * widgetR}
                               y1={source.y}
                               x2={target.x - 1.25 * widgetR}
                               y2={target.y}
                               key={`${sourceId}-${targetId}`}
                               onMouseUp={() => connectionsAction(
                                   {type: "removeConnection", sourceId, targetId})}
            />})
        }
        { sourceId
            && <TempConnection x1={widgets[sourceId].x
                                   + 1.25 * (side === "left" ? -widgetR : widgetR)}
                               y1={widgets[sourceId].y}
                               x2={mouseX}
                               y2={mouseY}
                               side={side} /> }
        { downX && !sourceId && !moveOrigins.length &&
            <rect x={srx1} y={sry1}
                  width={srx2 - srx1} height={sry2 - sry1}
                  fill="lightblue" stroke="blue" fillOpacity="0.8" /> }
        { Object.values(widgets).map((widget) =>
            <Widget key={widget.id} data={widget}
                    onMouseWidget={widgetMouse} onMouseEar={earMouse}
                    onHover={registerHover}
                    selected={selection.includes(widget.id)}
                    isOpen={widget.isOpen}
                    connection={{socket, sessionId, widgetId: widget.id}}
            />)
        }
    </svg>
}


export default Canvas;