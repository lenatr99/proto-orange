import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Ensure you have uuid installed
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Canvas from "./components/canvas";

function App() {
    const [sessionId, setSessionId] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoggedIn(true);
    };

    const handleNewSession = () => {
        const newSessionId = uuidv4(); // Generate a new session ID
        setSessionId(newSessionId);
        setIsLoggedIn(true); // Automatically log in to the new session
    };

    return (
        <div className="App">
            {!isLoggedIn ? (
                <div>
                    <form onSubmit={handleLogin} className="login-form">
                        <input
                            type="text"
                            value={sessionId}
                            onChange={(e) => setSessionId(e.target.value)}
                            placeholder="Enter Session ID"
                            required
                        />
                        <button type="submit">Join Session</button>
                    </form>
                    <button onClick={handleNewSession}>Create New Session</button>
                </div>
            ) : (
                <Canvas sessionId={sessionId} />
            )}
        </div>
    );
}

export default App;