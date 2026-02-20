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
        {/* Background for Desktop */}
        <div className="bg-gray-100 dark:bg-gray-950 h-full w-full flex justify-center overflow-hidden">
          {/* Mobile View Container */}
          <div className="w-full max-w-[480px] bg-white dark:bg-gray-900 h-full shadow-xl relative flex flex-col">
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
