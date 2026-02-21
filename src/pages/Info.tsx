import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Trip, InfoItem } from "../types";
import {
  Landmark,
  Train,
  BookOpen,
  Info as InfoIcon,
  Plane,
  ExternalLink,
} from "lucide-react";

const Info = () => {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [items, setItems] = useState<InfoItem[]>([]);

  useEffect(() => {
    if (!trip) return;
    fetch(`${import.meta.env.BASE_URL}data/${trip.id}/info.json`)
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch(console.error);
  }, [trip]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Landmark":
        return <Landmark className="w-5 h-5" />;
      case "Train":
        return <Train className="w-5 h-5" />;
      case "BookOpen":
        return <BookOpen className="w-5 h-5" />;
      case "Plane":
        return <Plane className="w-5 h-5" />;
      default:
        return <InfoIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-full">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">
        資訊
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center p-4 border-b border-gray-50 dark:border-gray-700">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg mr-4">
                {getIcon(item.icon)}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {item.title}
              </h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {item.links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98] transition-all group"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.label}
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            載入資訊中...
          </div>
        )}
      </div>
    </div>
  );
};

export default Info;
