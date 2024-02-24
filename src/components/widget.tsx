import {useSyncedReducer} from "../hooks";

export const widgetR = 30;

export const useWidgetSettings = ({socket, sessionId, widgetId}, initialState: {[index: string]: any}) =>
    useSyncedReducer(
        (state, changes: {[setting: string]: any}) => ({...state, ...changes}),
        initialState, socket, sessionId, `widget-settings-${widgetId}`);


export interface WidgetProps {
    widgetId: string;
    widgetType: any;
    connection: any;
    x: number;
    y: number;
    show: boolean;
}
