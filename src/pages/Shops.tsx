import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Trip, Shop } from '../types';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const Shops = () => {
    const { trip } = useOutletContext<{ trip: Trip }>();
    const [shops, setShops] = useState<Shop[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('All');

    useEffect(() => {
        if (!trip) return;
        fetch(`${import.meta.env.BASE_URL}data/${trip.id}/shops.json`)
            .then((res) => res.json())
            .then((data) => setShops(data));
    }, [trip]);

    const tags = useMemo(() => {
        const allTags = new Set(shops.flatMap((s) => s.tags));
        return ['All', ...Array.from(allTags)];
    }, [shops]);

    const filteredShops = useMemo(() => {
        if (selectedTag === 'All') return shops;
        return shops.filter((s) => s.tags.includes(selectedTag));
    }, [shops, selectedTag]);

    return (
        <div className="p-4 pb-24">
            {/* Tags Filter */}
            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide space-x-2 sticky top-0 bg-gray-50 z-10 py-2">
                {tags.map((tag) => (
                    <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={clsx(
                            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                            selectedTag === tag
                                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {/* Shops List */}
            <div className="space-y-4 mt-2">
                {filteredShops.map((shop) => (
                    <div key={shop.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-gray-800">{shop.name}</h3>
                            {shop.googleMapLink && (
                                <a
                                    href={shop.googleMapLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 p-1"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>

                        <div className="flex items-start text-sm text-gray-500 mb-2">
                            <MapPin className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                            <span>{shop.location}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-500 mb-3">
                            <Clock className="w-4 h-4 mr-2 shrink-0" />
                            <span>{shop.businessHours}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {shop.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {filteredShops.length === 0 && (
                    <div className="text-center text-gray-500 py-10">
                        No shops found for this category.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Shops;
