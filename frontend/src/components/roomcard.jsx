import { useNavigate } from "react-router-dom";

function RoomCard({ name, users }) {

  const navigate = useNavigate();

  return (
    <div className="room-card">

      <h2>{name}</h2>

      <p>{users} members</p>

      <button onClick={() => navigate("/room")}>
        Join Room
      </button>

    </div>
  );
}

export default RoomCard;