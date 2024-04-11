import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

function SessionManager() {
  const [sessionId, setSessionId] = useState("");
  const [socket, setSocket] = useState(null);
  let navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    localStorage.setItem("sessionId", sessionId);
    navigate(`/canvas/${sessionId}`);
  };

  const handleNewSession = () => {
    const newSessionId = uuidv4();
    localStorage.setItem("sessionId", newSessionId);
    const socket = io(window.location.hostname + ":4000");
    setSocket(socket);
    socket.emit("clear-session");

    navigate(`/canvas/${newSessionId}`);
  };

  return (
    <div style={{ padding: "20px 0 0 20px" }}>
      <form onSubmit={handleLogin} style={{ padding: "0 0 10px 0" }}>
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
  );
}

export default SessionManager;
