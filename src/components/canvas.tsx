import React, {useState} from "react";
import io from "socket.io-client";
import {v4 as uuidv4} from 'uuid';

import {useSyncedReducer} from "../hooks";
import {stopEvent} from "../utils";
import {widgetR} from "./widget";
import widgetRepo from "../widgets/index"
import WidgetNode from "./widgetnode";
import WidgetMenu from "./widgetmenu";
import Widget from "../widgets/widget";
import {ImProfile, ImShare2} from "react-icons/im";
import {Stack} from "react-bootstrap";


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
    widgetType: string;
    isOpen: boolean;
}

interface IWidgetList {
    [widgetId: string]: IWidgetData;
}


interface IMouseState {
    state?: "selecting" | "connecting" | "moving" | "widgetMenu";
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

interface IWidgetMenuState extends IMouseState {
    state: "widgetMenu";
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
    const [[menuX, menuY, menuAction], setMenu]: [[number?, number?, ((widget: string) => undefined)?], any] = useState([null, null, null]);

    React.useEffect(() => {
        const socket = io(window.location.hostname + ':4000');
        setSocket(socket);
        return () => {
            socket.disconnect();
        };
    }, []);

    const [showWorkflow, setShowWorkflow] = React.useState(true);
    const [showWidgets, setShowWidgets] = React.useState(true);


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
                    if (state[widgetId].isOpen) {
                        return {...state,
                          [widgetId]: {...state[widgetId], isOpen: false}}
                    }
                    else {
                        setShowWidgets(true);
                        const {[widgetId]: value, ...rest} = state;
                        return {...rest, [widgetId]: {...value, isOpen: true}};
                    }
                }
                case "onTop": {
                    const {widgetId} = args;
                    const {[widgetId]: value, ...rest} = state;
                    return {...rest,
                            [widgetId]: value};
                }
                default:
                    throw new Error(`Unknown action type: ${type}`);
            }
        },
        {} as IWidgetList,
        socket, sessionId, "widget-action",
        ["dragWidget", "flipOpen", "onTop"]);

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

    const [focusWorkflow, setFocusWorkflow] = React.useState(false);

    const [mouseState, setMouseState] =
        React.useReducer((state: IMouseState, {type, ...args}) => {
            const coords = args.x !== null? {x: args.x, y: args.y} : {};
            switch (type) {
                case "reset":
                    setFocusWorkflow(false);
                    return {...initialMouseState};
                case "move":
                    setFocusWorkflow(true);
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
                case "widgetMenu":
                    return {...state, state: "widgetMenu"};
                default:
                    throw new Error(`Unknown action type: ${type}`);
            }
        },
        initialMouseState);

    const [selection, setSelection] = React.useState([] as string[]);

    const addWidget = React.useCallback((x: number, y: number, widgetType: string, defaultId: string = null) => {
        const widgetId = defaultId || newWidgetId();
        setMenu([null, null, null]);
        widgetAction({type: "addWidget", x, y, widgetType, widgetId})
    }, [widgetAction, setMenu]);

    const clearSelection = React.useCallback(() => {
        setSelection([]);
    }, [setSelection]);

    const widgetMouse = React.useCallback((widgetId: string, x: number, y: number, event: React.MouseEvent) => {
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
    }, [selection, widgets]);

    const earMouse = React.useCallback((widgetId: string, side: string, event: React.MouseEvent) => {
        stopEvent(event);
        clearSelection();
        setMouseState({type: "startConnecting", sourceId: widgetId, x: event.clientX, y: event.clientY, side});
    }, [setMouseState]);

    const onMouseDown = React.useCallback((event: React.MouseEvent) => {
        stopEvent(event);
        setMouseState({type: "startSelecting", x: event.clientX, y: event.clientY});
    }, [setMouseState]);

    const onMouseMove = React.useCallback((event: React.MouseEvent) => {
        if (mouseState.state && mouseState.state !== "widgetMenu") {
            setMouseState({type: "move", x: event.clientX, y: event.clientY});
            stopEvent(event);
        }
    }, [mouseState, setMouseState]);

    const onMouseUp = React.useCallback((event: React.MouseEvent) => {
        stopEvent(event);
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
                const {sourceId, side} = mouseState;
                const targetId = mouseState.targetId || newWidgetId();

                const connect = () => {
                    if (side === "right") {
                        connectionsAction({type: "addConnection", sourceId, targetId});
                    }
                    else {
                        connectionsAction({type: "addConnection", targetId, sourceId});
                    }
                    setMouseState({type: "reset"});
                };

                if (!mouseState.targetId) {
                    setMouseState({type: "widgetMenu"});
                    setMenu([event.clientX, event.clientY,
                        (widgetType) => {
                            addWidget(event.clientX, event.clientY, widgetType, targetId);
                            connect();
                        }]);
                }
                else if ((targetId !== sourceId)
                  && !connections.find(([s, t]) => s === sourceId && t === targetId)) {
                    connect();
                }
                break;
            }
            case "selecting": {
                if (notMoved) {
                    clearSelection();
                    if (menuAction || selection.length > 0) {
                        setMenu([null, null, null]);
                    }
                    else {
                        setMenu([event.clientX, event.clientY,
                            (widgetType) => addWidget(event.clientX, event.clientY, widgetType)]);
                    }
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
        // For 'connecting', the state is reset separately. This is because Connecting into
        // empty space shows a menu and the temporary connection must remain visible.
        if (mouseState.state !== "connecting") {
            setMouseState({type: "reset"});
        }
    }, [mouseState, connections, connectionsAction, setMouseState,
        clearSelection, addWidget, menuAction, selection, widgets]);

    const keyHandler = React.useCallback((event: React.KeyboardEvent) => {
        if (event.key === "Backspace" || event.key === "Delete") {
            connectionsAction({type: "removeWidgets", selection});
            widgetAction({type: "removeWidgets", selection});
            clearSelection();
        }
    }, [connectionsAction, widgetAction, clearSelection, selection]);

    const registerHover = React.useCallback((widgetId: string, hover: boolean) => {
        if (mouseState.state === "connecting"
            && (hover || mouseState.targetId === widgetId)) {
                setMouseState({type: "setConnectionTarget", targetId: hover ? widgetId : null})
        }
    }, [mouseState, setMouseState]);

    // This is terrible; workflow and widget layer must be separate components,
    // but this would require having states at their common parent and I hate
    // to refactor this now. :)
    // The way in which canvas
    return <>
        <div style={{pointerEvents: "none",
            visibility: showWorkflow ? "visible" : "hidden",
            position: "absolute",
            top: 0, left: 0, width: "100%", height: "100%",
            ...(focusWorkflow ? {zIndex: 15, backgroundColor: "#ffffff88"}
              : {zIndex: 5, backgroundColor: "transparent"})}}>
        <svg width="100%" height="1000" tabIndex={0} ref={(el) => el && el.focus()}
            style={{position: "absolute", top: 0, left: 0, pointerEvents: "auto",}}
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
        { (mouseState.state === "connecting" || mouseState.state === "widgetMenu")
            && TempConnection({wx: widgets[mouseState.sourceId].x,
                               wy: widgets[mouseState.sourceId].y,
                               ...mouseState as IConnectingState})
        }
        { mouseState.state === "selecting"
            && SelectionRect(mouseState as ISelectionState)
        }
        { Object.values(widgets).map((widget) =>
            <WidgetNode key={widget.widgetId} data={widget} widgetType={widgetRepo[widget.widgetType]}
                    onMouseWidget={widgetMouse} onMouseEar={earMouse}
                    onHover={registerHover}
                    selected={selection.includes(widget.widgetId)}
            />)
        }
    </svg>
        </div>

        <div style={{position: "absolute", top: 0, left: 0, zIndex: 10,
            visibility: showWidgets ? "visible" : "hidden"}}>
          { Object.values(widgets)
            .map(({widgetType, widgetId, x, y, isOpen}) =>
              <Widget key={widgetId} widgetId={widgetId}
                      widgetType={widgetRepo[widgetType]}
                      connection={{socket, sessionId, widgetId}} x={x} y={y}
                      putOnTop={() => widgetAction({type: "onTop", widgetId})}
                      show={isOpen}
                      closeWidget={() => widgetAction({type: "flipOpen", widgetId})}
              />
              )
          }
        </div>
        <div style={{position: "absolute", top: 0, left: 0, zIndex: 20}}>
            <Stack>
              <ImShare2
                style={{position: "fixed", top: 15, right: 10, opacity: showWorkflow ? 0.8 : 0.4}} size={30}
                onClick={() => setShowWorkflow(!showWorkflow)}
              />
              <ImProfile style={{position: "fixed", top: 15, right: 50, opacity: showWidgets ? 0.8 : 0.4}} size={30}
              onClick={() => setShowWidgets(!showWidgets)}/>
            </Stack>
        </div>
        { menuX !== null
            && <WidgetMenu x={menuX} y={menuY} action={menuAction}/>
        }
    </>;
};


export default Canvas;