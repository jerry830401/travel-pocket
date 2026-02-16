import { useEffect, useState } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Trip, InfoItem } from '../types';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const InfoDetail = () => {
    const { t } = useTranslation();
    const { trip } = useOutletContext<{ trip: Trip }>();
    const { infoId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!trip || !infoId) return;

        // First fetch the list to find the file link, or just assume convention.
        // Based on my data structure, info key relates to file.
        // I need to fetch the list first to allow mapping ID to file, or simpler: 
        // fetch `/data/${trip.id}/info.json` and find the item

        fetch(`${import.meta.env.BASE_URL}data/${trip.id}/info.json`)
            .then(res => res.json())
            .then((items: InfoItem[]) => {
                const item = items.find(i => i.id === infoId);
                if (item) {
                    return fetch(`${import.meta.env.BASE_URL}data/${trip.id}/info/${item.file}`);
                }
                throw new Error('Info item not found');
            })
            .then(res => res.text())
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setContent(`# ${t('common.error')}\nCould not load content.`);
                setLoading(false);
            });

    }, [trip, infoId]);

    return (
        <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-gray-100 flex items-center sticky top-0 bg-white/95 backdrop-blur z-20">
                <button
                    onClick={() => navigate(-1)}
                    className="mr-3 p-1 -ml-1 rounded-full hover:bg-gray-100 text-gray-600"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg text-gray-800">{t('info.reading')}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pb-20">
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-100 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                        <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                    </div>
                ) : (
                    <div className="prose prose-slate prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-p:text-gray-600 prose-a:text-blue-600">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InfoDetail;
