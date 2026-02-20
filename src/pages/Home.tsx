import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Trip } from "../types";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

const Home = () => {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/trips.json`)
      .then((res) => res.json())
      .then((data) => setTrips(data))
      .catch((err) => console.error("Failed to load trips", err));
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header Hero - Fixed */}
      <div className="bg-blue-600 dark:bg-blue-800 text-white px-6 pb-8 rounded-b-[2rem] shadow-sm shrink-0 z-10 relative pt-safe-home">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold mb-1">Travel Pocket</h1>
            <p className="text-blue-100 opacity-90">
              Manage your journeys with ease.
            </p>
          </div>
          <div className="mt-1">
            <ThemeToggle className="p-2 rounded-full hover:bg-white/20 transition-colors text-white" />
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-5 py-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 ml-1">
          Your Trips
        </h2>

        {trips.length === 0 ? (
          <div className="text-center py-10 opacity-60 dark:text-gray-400">
            Loading trips...
          </div>
        ) : (
          trips.map((trip) => (
            <Link
              to={`/trip/${trip.id}`}
              key={trip.id}
              className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="h-48 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <img
                  src={trip.coverImage}
                  alt={trip.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-2xl font-bold text-white mb-1 shadow-black drop-shadow-sm">
                    {trip.name}
                  </h3>
                  <div className="flex items-center text-white/90 text-sm font-medium">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>
                      {trip.startDate} - {trip.endDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  <span>View Itinerary</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/40 p-2 rounded-full text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))
        )}

        {/* Safe area spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default Home;
