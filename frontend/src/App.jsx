
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/navbar";
import LoadingIntro from "./components/loadingintro";

import Home from "./pages/home";
import CreateRoom from "./pages/createroom";
import JoinRoom from "./pages/joinroom";
import Room from "./pages/room";

function App() {
  return (
    <>
      <LoadingIntro />

      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/room" element={<Room />} />
      </Routes>
    </>
  );
}

export default App;
