
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase();

    if (code.length !== 8) {
      alert("Please enter a valid 8-character room code");
      return;
    }

    if (!username.trim()) {
      alert("Please enter your username");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://picdrop-sobo.onrender.com/api/rooms/${code}`
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Room not found");
        return;
      }

      navigate(
        `/room?roomCode=${encodeURIComponent(data.roomId)}&roomName=Room&username=${encodeURIComponent(username.trim())}`
      );

    } catch (error) {
      alert("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-room">
      <h1>Join a Room</h1>

      <p>Enter the 8-character room code</p>

      <input
        type="text"
        placeholder="Enter room code"
        maxLength={8}
        value={roomCode}
        onChange={(e) =>
          setRoomCode(e.target.value.toUpperCase())
        }
      />

      <input
        type="text"
        placeholder="Enter your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <button onClick={joinRoom} disabled={loading}>
        {loading ? "Joining..." : "Join Room"}
      </button>
    </div>
  );
}

export default JoinRoom;
