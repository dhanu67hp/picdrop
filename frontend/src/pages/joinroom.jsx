
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    const name = username.trim();

    if (!name) {
      setError("Please enter your username.");
      return;
    }

    if (code.length !== 8) {
      setError("Please enter a valid 8-character room code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/rooms/${code}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Room not found.");
      }

      navigate(
        `/room?roomCode=${encodeURIComponent(data.roomId)}&roomName=Room&username=${encodeURIComponent(name)}`
      );
    } catch (err) {
      setError(err.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-room">
      <div className="join-room-container">

        <span className="section-label">COME BACK TO YOUR PEOPLE</span>

        <h1>Join a Room</h1>

        <p>
          Enter your details and reconnect with your friends.
        </p>

        <input
          className="join-code-input"
          type="text"
          placeholder="8-CHARACTER ROOM CODE"
          maxLength={8}
          value={roomCode}
          onChange={(e) =>
            setRoomCode(e.target.value.toUpperCase())
          }
          disabled={loading}
        />

        <input
          className="join-username-input"
          type="text"
          placeholder="Enter your username"
          maxLength={25}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />

        {error && <p className="form-error">{error}</p>}

        <button onClick={joinRoom} disabled={loading}>
          {loading ? "Joining Room..." : "Join Room →"}
        </button>

      </div>
    </div>
  );
}

export default JoinRoom;
