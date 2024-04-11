// App.js
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid"; // Ensure you have uuid installed
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import SessionManager from "./SessionManager";
import Canvas from "./components/canvas"; // Your canvas component

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/canvas/:sessionId" element={<Canvas />} />
          <Route path="/" element={<SessionManager />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;