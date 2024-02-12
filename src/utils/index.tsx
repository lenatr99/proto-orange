import {SyntheticEvent} from "react";

export const stopEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
    return false;
};
