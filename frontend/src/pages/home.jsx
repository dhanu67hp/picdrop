
import { Link } from "react-router-dom";

function Home() {
  return (
    <main className="landing-page">

      {/* HERO INTRO */}
      <section className="landing-hero">

        <div className="hero-glow"></div>

        <div className="hero-content">

          <span className="hero-label">
            YOUR SPACE. YOUR PEOPLE.
          </span>

          <h1>
            Every moment
            <br />
            deserves a <span>place.</span>
          </h1>

          <p>
            Create a private space, bring your people together,
            and share photos, memories, and moments in real time.
          </p>

          <a href="#room-options" className="hero-explore-btn">
            Explore PickDrop
            <span>↓</span>
          </a>

        </div>

        <div className="hero-bottom">
          <span>PRIVATE ROOMS</span>
          <span>REAL-TIME SHARING</span>
          <span>MADE FOR YOUR PEOPLE</span>
        </div>

      </section>


      {/* CREATE / JOIN SECTION */}
      <section className="landing-options" id="room-options">

        <div className="section-heading">
          <span className="section-label">GET STARTED</span>

          <h2>
            Your people.
            <span> Your space.</span>
          </h2>

          <p>
            Start a new room or enter a room your friends have created.
          </p>
        </div>


        <div className="home-options">

          {/* CREATE ROOM */}
          <div className="option-card">

            <div className="option-icon">✦</div>

            <span className="card-number">01 / CREATE</span>

            <h2>Create a Room</h2>

            <p>
              Start your own private space. Invite your friends
              and share your moments together.
            </p>

            <Link to="/create" className="landing-card-btn">
              Create Your Room <span>↗</span>
            </Link>

          </div>


          {/* JOIN ROOM */}
          <div className="option-card">

            <div className="option-icon">↗</div>

            <span className="card-number">02 / JOIN</span>

            <h2>Join a Room</h2>

            <p>
              Already have a room code? Enter it and reconnect
              with your people.
            </p>

            <Link to="/join" className="landing-card-btn">
              Join a Room <span>↗</span>
            </Link>

          </div>

        </div>

        <footer className="landing-footer">
          <span>PickDrop © 2026</span>
          <span>SHARE MOMENTS. STAY CONNECTED.</span>
        </footer>

      </section>

    </main>
  );
}

export default Home;
