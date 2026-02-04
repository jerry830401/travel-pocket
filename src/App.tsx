import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import TripView from './pages/TripView';
import Schedule from './pages/Schedule';
import Shops from './pages/Shops';
import Info from './pages/Info';
import InfoDetail from './pages/InfoDetail';

function App() {
  return (
    <BrowserRouter>
      {/* Background for Desktop */}
      <div className="bg-gray-100 min-h-dvh flex justify-center">
        {/* Mobile View Container */}
        <div className="w-full max-w-[480px] bg-white min-h-dvh shadow-xl relative flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trip/:tripId" element={<TripView />}>
              <Route index element={<Navigate to="schedule" replace />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="shops" element={<Shops />} />
              <Route path="info" element={<Info />} />
              <Route path="info/:infoId" element={<InfoDetail />} />
            </Route>
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
