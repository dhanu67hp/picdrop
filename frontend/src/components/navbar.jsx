
import { NavLink, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  // Hide navbar inside the room dashboard
  if (location.pathname === "/room") {
    return null;
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="logo">
        Pick<span>Drop</span>
        <span className="logo-dot">.</span>
      </NavLink>

      <div className="nav-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-button ${isActive ? "active" : ""}`
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/create"
          className={({ isActive }) =>
            `nav-button ${isActive ? "active" : ""}`
          }
        >
          Create Room
        </NavLink>

        <NavLink
          to="/join"
          className={({ isActive }) =>
            `nav-button nav-join-btn ${isActive ? "active" : ""}`
          }
        >
          Join Room <span>↗</span>
        </NavLink>
      </div>
    </nav>
  );
}

export default Navbar;
