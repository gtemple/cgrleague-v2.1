import HomePage from "./pages/HomePage/index.tsx";
import SeasonPage from "./pages/SeasonPage/index.tsx";
import { Routes, Route, Outlet } from "react-router-dom";
import { NavBar } from "./components/NavBar/index.tsx";


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
      </Route>
    </Routes>
  );
}