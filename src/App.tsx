import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Canvas from "./components/canvas";
// import io from "socket.io-client";

function App() {
    /*
    const socket = io('http://localhost:4000');
    socket.onAny((event, load) => {
        const value = JSON.parse(load);
        console.log("received", event, value);
    });
     */
    return <Canvas />;
}

export default App;
