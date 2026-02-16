import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import type { Trip, InfoItem } from '../types';
import { AlertCircle, Train, BookOpen, Info as InfoIcon, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Info = () => {
    const { t } = useTranslation();
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
            case 'AlertCircle': return <AlertCircle className="w-5 h-5" />;
            case 'Train': return <Train className="w-5 h-5" />;
            case 'BookOpen': return <BookOpen className="w-5 h-5" />;
            default: return <InfoIcon className="w-5 h-5" />;
        }
    };

    return (
        <div className="p-4 bg-gray-50 min-h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4 px-1">{t('info.title')}</h2>
            <div className="space-y-3">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        to={`${item.id}`}
                        className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-[0.98] transition-all group"
                    >
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {getIcon(item.icon)}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        {t('info.loading_info')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Info;
