
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function CreateRoom() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createRoom = async () => {
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:5001/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Room creation failed");
      }

      setRoomCode(data.roomId);
    } catch (err) {
      setError(err.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const enterRoom = () => {
    navigate("/room", {
      state: {
        roomName: "Room",
        roomCode: roomCode,
        username: username.trim(),
      },
    });
  };

  return (
    <div className="create-room-page">
      <div className="create-room-container">

        {!roomCode ? (
          <>
            <span className="section-label">START SOMETHING TOGETHER</span>

            <h1>Create Your Room</h1>

            <p className="ready-text">
              Give yourself a name and create a private space
              for your people.
            </p>

            <input
              className="username-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              maxLength={25}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />

            {error && (
              <p className="form-error">{error}</p>
            )}

            <button
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? "Creating Room..." : "Create Room"}
            </button>
          </>
        ) : (
          <>
            <span className="section-label">YOUR SPACE IS READY</span>

            <h1>Room Created!</h1>

            <p className="ready-text">
              Welcome, {username.trim()}.
            </p>

            <div className="room-code-box">
              {roomCode}
            </div>

            <p className="share-text">
              Share this code with your friends.
            </p>

            <button
              className="enter-room-btn"
              onClick={enterRoom}
            >
              Enter Room →
            </button>
          </>
        )}

      </div>
    </div>
  );
}

export default CreateRoom;
