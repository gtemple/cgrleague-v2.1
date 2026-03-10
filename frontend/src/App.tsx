import { Routes, Route, Outlet } from "react-router-dom";

import { NavBar } from "./components/NavBar/index.tsx";
import { HomePage }  from "./pages/HomePage/index.tsx";
import { SeasonPage } from "./pages/SeasonPage/index.tsx";
import { TrackPage } from "./pages/TrackPage/index.tsx";
import { DriverPage } from "./pages/DriverPage/index.tsx";
import { DriversIndex } from "./pages/DriverPage/DriversIndex.tsx";
import { RacePage } from "./pages/RacePage/index.tsx";
import { HallOfFamePage } from "./pages/HallOfFamePage/index.tsx";


function AppLayout() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/seasons/:seasonId" element={<SeasonPage />} />
        <Route path="/seasons/:seasonId/races/:round" element={<RacePage />} />
        <Route path="/drivers/:driverId" element={<DriverPage />} />
        <Route path="/tracks/:trackId" element={<TrackPage />} />
        <Route path="/drivers" element={<DriversIndex />} />
        <Route path="/hall-of-fame" element={<HallOfFamePage />} />
      </Route>
    </Routes>
  );
}