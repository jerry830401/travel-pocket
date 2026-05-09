import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import TripView from "./pages/TripView";
import Schedule from "./pages/Schedule";
import Shops from "./pages/Shops";
import Info from "./pages/Info";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <div className="h-full w-full flex justify-center overflow-hidden" style={{ background: '#e9e2cd' }}>
          <div
            className="w-full max-w-[480px] h-full relative flex flex-col overflow-hidden"
            style={{ background: 'var(--bg)', boxShadow: '0 0 80px rgba(40,30,20,.18)' }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/trip/:tripId" element={<TripView />}>
                <Route index element={<Navigate to="schedule" replace />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="shops" element={<Shops />} />
                <Route path="info" element={<Info />} />
              </Route>
            </Routes>
          </div>
        </div>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
