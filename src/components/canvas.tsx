import React, {useState} from "react";
import io from "socket.io-client";
import {v4 as uuidv4} from 'uuid';

import {useSyncedReducer} from "../hooks";
import {stopEvent} from "../utils";
import Widget, {widgetR} from "./widget";


const normalizedRect = (x1: number, y1: number,
                        x2: number, y2: number) =>
    [Math.min(x1, x2), Math.max(x1, x2),
     Math.min(y1, y2), Math.max(y1, y2)];


const Bezier = ({x1, y1, x2, y2, className}) =>
    <path className={className}
          d={`M ${x1} ${y1} C ${x1 + 30} ${y1} ${x2 - 30} ${y2} ${x2} ${y2}`} />;


const ConnectingLine = ({x1, y1, x2, y2}) =>
    <g>
        { ["hoverArea", "hovered", "connection"].map((className) =>
            <Bezier className={className} key={className}
                    x1={x1} y1={y1} x2={x2} y2={y2} />) }
    </g>;


const TempConnection = ({wx, wy, x, y, side}) => {
    const x1 = wx + 1.25 * (side === "left" ? -widgetR : widgetR);
    return <g className="connection temp">
        { side === "right"
            ? <Bezier className="connection" x1={x1} y1={wy} x2={x} y2={y} />
            : <Bezier className="connection" x1={x} y1={y} x2={x1} y2={wy} />
        }
        <circle cx={x1} cy={wy} r={3} fill="grey"/>
    </g>
};


const Connection = ({x1, y1, x2, y2, onMouseUp}) => {
    return <g className="connection"
              onMouseUp={(event) => stopEvent(event) || onMouseUp()}
              onMouseDown={stopEvent}>
        <ConnectingLine x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={x1} cy={y1} r={3} fill="grey"/>
        <circle cx={x2} cy={y2} r={3} fill="grey"/>
    </g>
};



interface IWidgetData {
    x: number;
    y: number;
    widgetId?: string;
    isOpen: boolean;
}

interface IWidgetList {
    [widgetId: string]: IWidgetData;
}


interface IMouseState {
    state?: "selecting" | "connecting" | "moving";
    x?: number;
    y?: number;
    downX?: number;
    downY?: number;
    distance: number;
    moveOrigins: [string, number, number][];
    sourceId?: string;
    side?: "left" | "right"
    targetId?: string;
}

interface ISelectionState extends IMouseState {
    state: "selecting";
    x: number;
    y: number;
    downX: number;
    downY: number;
}

interface IConnectingState extends IMouseState {
    state: "connecting";
    x: number;
    y: number;
    sourceId: string;
    side: "left" | "right";
}

interface IMovingState extends IMouseState {
    state: "moving";
    x: number;
    y: number;
    downX: number;
    downY: number;
    moveOrigins: [string, number, number][];
}


const initialMouseState: IMouseState = {
    state: null, x: null, y: null, downX: null, downY: null, distance: 0, moveOrigins: [],
    sourceId: null, side: null, targetId: null};


const SelectionRect = ({downX, downY, x, y}) => {
    const [srx1, srx2, sry1, sry2] = normalizedRect(downX, downY, x, y);
    return <rect x={srx1} y={sry1}
          width={srx2 - srx1} height={sry2 - sry1}
          fill="lightblue" stroke="blue" fillOpacity="0.8" />
};


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
                case "init": {
                    return args.widgets as IWidgetList;
                }
                case "addWidget": {
                    const widgetId = args.widgetId || newWidgetId();
                    return {...state,
                            [widgetId]: {...args, widgetId, isOpen: false}}
                }
                case "removeWidget": {
                    return Object.fromEntries(
                        Object.entries(state)
                            .filter(([widgetId, _]) => widgetId !== args.widgetId));
                }
                case "removeWidgets": {
                    return Object.fromEntries(
                        Object.entries(state)
                            .filter(([widgetId, _]) => !args.selection.includes(widgetId)));
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
                case "init": {
                    return args.connections;
                }
                case "addConnection": {
                    const {sourceId, targetId} = args;
                    if (state.find(([s, t]) => s === sourceId && t === targetId)) {
                        return state;
                    }
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

    const [mouseState, setMouseState] =
        React.useReducer((state: IMouseState, {type, ...args}) => {
            const coords = args.x !== null? {x: args.x, y: args.y} : {};
            switch (type) {
                case "reset":
                    return initialMouseState;
                case "move":
                    const [dx, dy] = [args.x - state.downX, args.y - state.downY];
                    state.moveOrigins.forEach(([widgetId, ox, oy]) => {
                        widgetAction({type: "dragWidget", widgetId, x: ox + dx, y: oy + dy});
                    });
                    return {...state, ...coords,
                            distance: state.distance + (args.x - state.x) ** 2 + (args.y - state.y) ** 2};
                case "setConnectionTarget":
                    return {...state, targetId: args.targetId};

                case "startMoving":
                    return {...state, ...coords, state: "moving", moveOrigins: args.moveOrigins,
                            downX: args.downX, downY: args.downY, x: args.downX, y: args.downY, distance: 0};
                case "startSelecting":
                    return {...state, ...coords, state: "selecting", downX: args.x, downY: args.y, distance: 0};
                case "startConnecting":
                    return {...state, ...coords, state: "connecting", sourceId: args.sourceId, side: args.side};
                default:
                    throw new Error(`Unknown action type: ${type}`);
            }
        },
        initialMouseState);

    const [selection, setSelection] = React.useState([] as string[]);

    const addWidget = (x: number, y: number, defaultId=null) => {
        const widgetId = defaultId || newWidgetId();
        widgetAction({type: "addWidget", x, y, widgetId})
    };

    const clearSelection = () => {
        setSelection([]);
    };

    const widgetMouse = (widgetId: string, x: number, y: number, event: React.MouseEvent) => {
        stopEvent(event);
        const thisWidget: [string, number, number] = [widgetId, widgets[widgetId].x, widgets[widgetId].y];
        let moveOrigins: [string, number, number][];
        if (!selection.includes(widgetId)) {
            clearSelection();
            moveOrigins = [thisWidget];
        }
        else {
            moveOrigins = [thisWidget,
                ...Array.from(selection.filter((id) => id !== widgetId),
                    (id) => [id, widgets[id].x, widgets[id].y] as [string, number, number])]
        }
        setMouseState({type: "startMoving", moveOrigins, downX: x, downY: y});
    };

    const earMouse = (widgetId: string, side: string, event: React.MouseEvent) => {
        stopEvent(event);
        clearSelection();
        setMouseState({type: "startConnecting", sourceId: widgetId, x: event.clientX, y: event.clientY, side});
    };

    const onMouseDown = (event: React.MouseEvent) => {
        stopEvent(event);
        setMouseState({type: "startSelecting", x: event.clientX, y: event.clientY});
    };

    const onMouseMove = (event: React.MouseEvent) => {
        stopEvent(event);
        if (mouseState.state) {
            setMouseState({type: "move", x: event.clientX, y: event.clientY});
        }
    };

    const onMouseUp = (event: React.MouseEvent) => {
        const notMoved = mouseState.distance < 16;
        switch(mouseState.state) {
            case "moving": {
                if (notMoved) {
                    clearSelection();
                    widgetAction({type: "flipOpen", widgetId: mouseState.moveOrigins[0][0]});
                }
                else {
                    const [dx, dy] = [event.clientX - mouseState.downX, event.clientY - mouseState.downY];
                    mouseState.moveOrigins.forEach(([widgetId, ox, oy]) => {
                        widgetAction({type: "moveWidget", widgetId, x: ox + dx, y: oy + dy});
                    })
                }
                break;
            }
            case "connecting": {
                let {sourceId, targetId} = mouseState;
                if (!targetId) {
                    targetId = newWidgetId();
                    addWidget(event.clientX, event.clientY, targetId);
                }
                if (mouseState.side === "left") {
                    [sourceId, targetId] = [targetId, sourceId];
                }
                if ((targetId !== sourceId)
                    && !connections.find(([s, t]) => s === sourceId && t === targetId)) {
                    connectionsAction({type: "addConnection", sourceId, targetId});
                }
                break;
            }
            case "selecting": {
                if (notMoved) {
                    clearSelection();
                    addWidget(event.clientX, event.clientY);
                }
                else {
                    const [x1, x2, y1, y2] = normalizedRect(mouseState.downX, mouseState.downY,
                                                            event.clientX, event.clientY);
                    setSelection(Object.keys(widgets).filter((widgetId) => {
                        const {x, y} = widgets[widgetId];
                        return x + widgetR > x1 && x - widgetR < x2
                            && y + widgetR > y1 && y - widgetR < y2;
                    }))
                }
            }
        }
        setMouseState({type: "reset"});
        stopEvent(event);
    };

    const keyHandler = (event: React.KeyboardEvent) => {
        if (event.key === "Backspace" || event.key === "Delete") {
            connectionsAction({type: "removeWidgets", selection});
            widgetAction({type: "removeWidgets", selection});
            clearSelection();
        }
    };
    const registerHover = (widgetId: string, hover: boolean) => {
        if (mouseState.state === "connecting"
            && (hover || mouseState.targetId === widgetId)) {
                setMouseState({type: "setConnectionTarget", targetId: hover ? widgetId : null})
        }
    };

    return <svg width="100%" height="1000" tabIndex={0} ref={(el) => el && el.focus()}
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
        { mouseState.state === "connecting"
            && TempConnection({wx: widgets[mouseState.sourceId].x,
                               wy: widgets[mouseState.sourceId].y,
                               ...mouseState as IConnectingState})
        }
        { mouseState.state === "selecting"
            && SelectionRect(mouseState as ISelectionState)
        }
        { Object.values(widgets).map((widget) =>
            <Widget key={widget.widgetId} data={widget}
                    onMouseWidget={widgetMouse} onMouseEar={earMouse}
                    onHover={registerHover}
                    selected={selection.includes(widget.widgetId)}
                    isOpen={widget.isOpen}
                    connection={{socket, sessionId, widgetId: widget.widgetId}}
            />)
        }
    </svg>
};


export default Canvas;