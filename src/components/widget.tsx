import React from "react";
import {useSyncedReducer} from "../hooks";
import {stopEvent} from "../utils";

export const widgetR = 30;

export const useWidgetSettings = ({socket, sessionId, widgetId}, initialState: {[index: string]: any}) =>
    useSyncedReducer(
        (state, changes: {[setting: string]: any}) => ({...state, ...changes}),
        initialState, socket, sessionId, `widget-settings-${widgetId}`);


export interface WidgetProps {
    widgetId: string;
    connection: any;
    x: number;
    y: number;
    show: boolean;
}
/*
export const Widget = ({data, isOpen, connection, x, y}) => {
    const [settings, setter] = useWidgetSettings(
        connection,
        {color: "white", name: data.widgetId});

    return isOpen
            && <WidgetDialog x={data.x} y={data.y} onDataChanged={(color: string) => setter({color})} />
};


export default Widget;*/