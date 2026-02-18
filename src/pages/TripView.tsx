import { useEffect, useState } from "react";
import { Outlet, NavLink, useParams, Link } from "react-router-dom";
import type { Trip } from "../types";
import { Calendar, Store, Info, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import clsx from "clsx";

const TripView = () => {
  const { t } = useTranslation();
  const { tripId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    // In a real app, we might search the trips list or fetch specific trip details
    fetch(`${import.meta.env.BASE_URL}data/trips.json`)
      .then((res) => res.json())
      .then((data: Trip[]) => {
        const found = data.find((t) => t.id === tripId);
        if (found) setTrip(found);
      });
  }, [tripId]);

  if (!trip)
    return (
      <div className="p-10 text-center text-gray-500">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 pb-3 pt-safe-offset z-30 flex items-center shadow-sm shrink-0">
        <Link to="/" className="mr-3 p-1 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </Link>
        <h1 className="text-lg font-bold text-gray-800 truncate flex-1">
          {trip.name}
        </h1>
        <LanguageSwitcher />
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50 scroll-smooth overscroll-y-contain">
        <Outlet context={{ trip }} />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-100 shrink-0 pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="flex justify-around items-center h-[3.5rem]">
          <NavLink
            to="schedule"
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors active:bg-gray-50",
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Calendar
                  className={clsx(
                    "w-6 h-6 mb-0.5 transition-transform",
                    isActive && "scale-110",
                  )}
                />
                <span className="text-[10px] font-medium">
                  {t("nav.schedule")}
                </span>
              </>
            )}
          </NavLink>
          <NavLink
            to="shops"
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors active:bg-gray-50",
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Store
                  className={clsx(
                    "w-6 h-6 mb-0.5 transition-transform",
                    isActive && "scale-110",
                  )}
                />
                <span className="text-[10px] font-medium">
                  {t("nav.shops")}
                </span>
              </>
            )}
          </NavLink>
          <NavLink
            to="info"
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors active:bg-gray-50",
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Info
                  className={clsx(
                    "w-6 h-6 mb-0.5 transition-transform",
                    isActive && "scale-110",
                  )}
                />
                <span className="text-[10px] font-medium">{t("nav.info")}</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default TripView;
