import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Trip, ItineraryDay, ItineraryItem } from '../types';
import { MapPin, Clock, Coffee, Bed, Landmark, Bus, MoreHorizontal, X } from 'lucide-react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const Schedule = () => {
    const { trip } = useOutletContext<{ trip: Trip }>();
    const [days, setDays] = useState<ItineraryDay[]>([]);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);

    useEffect(() => {
        if (!trip) return;
        fetch(`${import.meta.env.BASE_URL}data/${trip.id}/itinerary.json`)
            .then(res => res.json())
            .then(data => setDays(data));
    }, [trip]);

    const currentDay = days[selectedDayIndex];

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'food': return <Coffee className="w-5 h-5" />;
            case 'accommodation': return <Bed className="w-5 h-5" />;
            case 'sightseeing': return <Landmark className="w-5 h-5" />;
            case 'transport': return <Bus className="w-5 h-5" />;
            default: return <MoreHorizontal className="w-5 h-5" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'food': return 'bg-orange-100 text-orange-600';
            case 'accommodation': return 'bg-blue-100 text-blue-600';
            case 'sightseeing': return 'bg-green-100 text-green-600';
            case 'transport': return 'bg-purple-100 text-purple-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="relative min-h-full pb-20">
            {/* Day Selector */}
            {days.length > 1 && (
                <div className="sticky top-0 bg-white z-10 border-b border-gray-100 flex overflow-x-auto p-2 gap-2 scrollbar-hide">
                    {days.map((d, index) => (
                        <button
                            key={d.id}
                            onClick={() => setSelectedDayIndex(index)}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                                index === selectedDayIndex
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            Day {d.day} <span className="text-xs opacity-80 ml-1">({format(new Date(d.date), 'MM/dd')})</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Timeline */}
            <div className="p-4 space-y-4">
                {currentDay?.items.map((item, index) => {
                    const nextItem = currentDay.items[index + 1];
                    let gapMinutes = 0;
                    if (nextItem) {
                        const currentEnd = parse(item.endTime, 'HH:mm', new Date());
                        const nextStart = parse(nextItem.startTime, 'HH:mm', new Date());
                        gapMinutes = differenceInMinutes(nextStart, currentEnd);
                    }

                    return (
                        <div key={item.id}>
                            <div
                                onClick={() => setSelectedItem(item)}
                                className="flex bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer"
                            >
                                {/* Time Column */}
                                <div className="flex flex-col items-center mr-4 w-12 pt-1">
                                    <span className="text-sm font-bold text-gray-800">{item.startTime}</span>
                                    <div className="h-full w-0.5 bg-gray-100 my-2"></div>
                                    <span className="text-xs text-gray-400">{item.endTime}</span>
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-gray-800">{item.title}</h3>
                                        <span className={clsx("p-1.5 rounded-full", getCategoryColor(item.category))}>
                                            {getCategoryIcon(item.category)}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-500 mb-1">
                                        <MapPin className="w-3.5 h-3.5 mr-1" />
                                        <span className="line-clamp-1">{item.location}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Gap Indicator */}
                            {gapMinutes > 0 && (
                                <div className="flex items-center justify-center py-2">
                                    <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {Math.floor(gapMinutes / 60) > 0 ? `${Math.floor(gapMinutes / 60)}h ` : ''}{gapMinutes % 60}m transit / free time
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {!currentDay && <div className="text-center text-gray-400 py-10">Loading schedule...</div>}
            </div>

            {/* Detail Sheet */}
            <AnimatePresence>
                {selectedItem && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedItem(null)}
                            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl z-50 p-6 shadow-2xl overflow-hidden"
                            style={{ maxHeight: '85vh' }}
                        >
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

                            <button
                                onClick={() => setSelectedItem(null)}
                                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className={clsx("p-2 rounded-lg", getCategoryColor(selectedItem.category))}>
                                            {getCategoryIcon(selectedItem.category)}
                                        </span>
                                        <span className="text-sm font-medium text-gray-500 capitalize">{selectedItem.category}</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedItem.title}</h2>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Time</span>
                                        <div className="text-lg font-semibold text-gray-800 mt-0.5">
                                            {selectedItem.startTime} - {selectedItem.endTime}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Date</span>
                                        <div className="text-lg font-semibold text-gray-800 mt-0.5">
                                            Day {currentDay?.day}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Location</h3>
                                    <a
                                        href={selectedItem.coordinates ? `https://www.google.com/maps/search/?api=1&query=${selectedItem.coordinates.lat},${selectedItem.coordinates.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedItem.location)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
                                    >
                                        <div className="flex items-center text-blue-700">
                                            <MapPin className="w-5 h-5 mr-3" />
                                            <span className="font-medium">{selectedItem.location}</span>
                                        </div>
                                        <ExternalLinkWrapper className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
                                    </a>
                                </div>

                                {selectedItem.description && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
                                        <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">
                                            {selectedItem.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

// Helper component to avoid import conflict if I imported ExternalLink twice or missed it
import { ExternalLink as ExternalLinkWrapper } from 'lucide-react';

export default Schedule;
