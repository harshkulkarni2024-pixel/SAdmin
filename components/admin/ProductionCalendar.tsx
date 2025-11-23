
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProductionEvent, User } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM

type EventType = 'post' | 'story' | 'meeting' | 'off';

interface EventConfig {
    label: string;
    color: string;
    bg: string;
    icon: any;
}

const EVENT_TYPES: Record<EventType, EventConfig> = {
    post: { label: 'ضبط پست', color: 'text-violet-300', bg: 'bg-gradient-to-r from-violet-900/80 to-fuchsia-900/80 border-violet-500', icon: 'video' },
    story: { label: 'ضبط استوری', color: 'text-amber-300', bg: 'bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-amber-500', icon: 'scenario' },
    meeting: { label: 'جلسه', color: 'text-sky-300', bg: 'bg-gradient-to-r from-sky-900/80 to-blue-900/80 border-sky-500', icon: 'users' },
    off: { label: '⛔ آف / تعطیل', color: 'text-gray-300', bg: 'bg-gradient-to-r from-gray-700/80 to-slate-800/80 border-gray-500', icon: 'stop' },
};

const ProductionCalendar: React.FC = () => {
    const showNotification = useNotification();
    const [events, setEvents] = useState<ProductionEvent[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // New Event Form State
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [eventType, setEventType] = useState<EventType>('post');
    const [dayOfWeek, setDayOfWeek] = useState<number>(0); // 0 = Saturday, etc.
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('12:00');
    const [description, setDescription] = useState('');

    // Calculate start of the week (Saturday)
    const startOfWeek = useMemo(() => {
        const date = new Date(currentDate);
        const day = date.getDay(); // 0 (Sun) to 6 (Sat) in standard JS
        // In Persian calendar, week starts on Saturday.
        // If today is Saturday (6), diff is 0.
        // If Sunday (0), diff is 1.
        // Formula: (day + 1) % 7 is days passed since Saturday
        const diff = (day + 1) % 7;
        date.setDate(date.getDate() - diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }, [currentDate]);

    const weekDates = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [startOfWeek]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedEvents, fetchedUsers] = await Promise.all([
                    db.getProductionEvents(),
                    db.getAllUsers()
                ]);
                setEvents(fetchedEvents);
                setUsers(fetchedUsers);
            } catch (e) {
                showNotification('خطا در بارگذاری اطلاعات تقویم', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [showNotification]);

    const handlePrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleAddEvent = async () => {
        if (!selectedUser && eventType !== 'off') {
            showNotification('لطفاً پروژه/کاربر را انتخاب کنید.', 'error');
            return;
        }

        const projectTitle = eventType === 'off' ? 'آف / تعطیل' : (users.find(u => String(u.user_id) === selectedUser)?.full_name || 'نامشخص');

        // Construct Date objects
        const targetDate = new Date(weekDates[dayOfWeek]);
        
        const [startH, startM] = startTime.split(':').map(Number);
        const startDateTime = new Date(targetDate);
        startDateTime.setHours(startH, startM, 0, 0);

        const [endH, endM] = endTime.split(':').map(Number);
        const endDateTime = new Date(targetDate);
        endDateTime.setHours(endH, endM, 0, 0);

        if (endDateTime <= startDateTime) {
            showNotification('زمان پایان باید بعد از زمان شروع باشد.', 'error');
            return;
        }

        try {
            await db.addProductionEvent({
                project_name: projectTitle,
                event_type: eventType,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                description
            });
            
            const refreshedEvents = await db.getProductionEvents();
            setEvents(refreshedEvents);
            setIsModalOpen(false);
            showNotification('رویداد با موفقیت ثبت شد.', 'success');
            
            // Reset Form
            setDescription('');
            setEventType('post');
        } catch (e) {
            showNotification('خطا در ثبت رویداد.', 'error');
        }
    };

    const handleDeleteEvent = async (id: number) => {
        if(confirm('آیا از حذف این رویداد اطمینان دارید؟')) {
            try {
                await db.deleteProductionEvent(id);
                const refreshedEvents = await db.getProductionEvents();
                setEvents(refreshedEvents);
            } catch(e) {
                showNotification('خطا در حذف رویداد.', 'error');
            }
        }
    };

    // Helper to position events
    const getEventStyle = (event: ProductionEvent) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        
        const startHour = start.getHours() + start.getMinutes() / 60;
        const endHour = end.getHours() + end.getMinutes() / 60;
        const duration = endHour - startHour;

        // Calendar starts at 8 AM
        const topOffset = (startHour - 8) * 60; 
        const height = duration * 60;

        return {
            top: `${topOffset}px`,
            height: `${height}px`,
        };
    };

    const getEventsForDay = (date: Date) => {
        return events.filter(e => {
            const eDate = new Date(e.start_time);
            return eDate.getDate() === date.getDate() && 
                   eDate.getMonth() === date.getMonth() && 
                   eDate.getFullYear() === date.getFullYear();
        });
    };

    return (
        <div className="h-full flex flex-col animate-fade-in bg-slate-900 text-slate-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="bg-violet-600 p-2 rounded-lg shadow-lg shadow-violet-900/20">
                        <Icon name="calendar" className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">تقویم تولید محتوا</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-700 rounded-lg p-1">
                        <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-600 rounded-md transition-colors"><Icon name="back" className="w-5 h-5 rotate-180" /></button>
                        <span className="px-4 font-mono text-sm text-slate-300 min-w-[140px] text-center">
                            {weekDates[0].toLocaleDateString('fa-IR')} - {weekDates[6].toLocaleDateString('fa-IR')}
                        </span>
                        <button onClick={handleNextWeek} className="p-2 hover:bg-slate-600 rounded-md transition-colors"><Icon name="back" className="w-5 h-5" /></button>
                    </div>
                    <button onClick={handleToday} className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">امروز</button>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-lg shadow-violet-900/40 transition-transform hover:-translate-y-0.5"
                    >
                        <Icon name="plus" className="w-5 h-5" />
                        <span className="hidden md:inline">رویداد جدید</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 relative">
                {isLoading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50"><Loader /></div>}
                
                <div className="min-w-[800px]">
                    {/* Header Row (Days) */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                        <div className="p-4 border-l border-slate-700"></div>
                        {weekDates.map((date, i) => {
                            const isToday = new Date().toDateString() === date.toDateString();
                            return (
                                <div key={i} className={`p-3 text-center border-l border-slate-700 ${isToday ? 'bg-violet-900/20' : ''}`}>
                                    <p className={`text-sm font-bold ${isToday ? 'text-violet-400' : 'text-slate-300'}`}>{WEEK_DAYS[i]}</p>
                                    <p className={`text-xs mt-1 ${isToday ? 'text-violet-300' : 'text-slate-500'}`}>{date.toLocaleDateString('fa-IR')}</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Time Grid */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                        {/* Current Time Indicator Line (Simplified) */}
                        {/* Time Labels Column */}
                        <div className="border-l border-slate-700 bg-slate-900/50">
                            {TIME_SLOTS.map(hour => (
                                <div key={hour} className="h-[60px] border-b border-slate-700/50 text-xs text-slate-500 text-center pt-2 relative">
                                    <span className="absolute -top-2 left-0 right-0">{hour}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Days Columns */}
                        {weekDates.map((date, colIndex) => (
                            <div key={colIndex} className="border-l border-slate-700 relative h-[900px]">
                                {/* Grid Lines */}
                                {TIME_SLOTS.map(hour => (
                                    <div key={hour} className="h-[60px] border-b border-slate-700/30"></div>
                                ))}

                                {/* Events */}
                                {getEventsForDay(date).map(event => {
                                    const style = getEventStyle(event);
                                    const config = EVENT_TYPES[event.event_type as EventType] || EVENT_TYPES.post;
                                    
                                    return (
                                        <div
                                            key={event.id}
                                            className={`absolute inset-x-1 rounded-md p-2 border overflow-hidden group cursor-pointer transition-all hover:z-10 hover:scale-[1.02] ${config.bg}`}
                                            style={style}
                                            onClick={() => handleDeleteEvent(event.id)}
                                            title="برای حذف کلیک کنید"
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <Icon name={config.icon} className={`w-3 h-3 ${config.color}`} />
                                                <span className={`text-xs font-bold truncate ${config.color}`}>{config.label}</span>
                                            </div>
                                            <p className="text-xs text-white font-semibold truncate">{event.project_name}</p>
                                            {event.description && (
                                                <p className="text-[10px] text-slate-300 truncate mt-1">{event.description}</p>
                                            )}
                                            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-red-500/80 p-1 rounded text-white hover:bg-red-600">
                                                    <Icon name="trash" className="w-3 h-3" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">افزودن رویداد جدید</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><Icon name="plus" className="w-6 h-6 rotate-45" /></button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            {/* Event Type Selection */}
                            <div className="grid grid-cols-2 gap-3">
                                {(Object.entries(EVENT_TYPES) as [EventType, EventConfig][]).map(([type, config]) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setEventType(type);
                                            if (type === 'off') setSelectedUser(''); // Clear user if Off
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                                            eventType === type 
                                            ? `${config.bg.split(' ')[0]} ${config.color} border-current` 
                                            : 'bg-slate-700/30 border-transparent text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        <Icon name={config.icon} className="w-6 h-6 mb-2" />
                                        <span className="text-xs font-bold">{config.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Project/User Selection */}
                            {eventType !== 'off' && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">انتخاب پروژه (کاربر)</label>
                                    <select 
                                        value={selectedUser} 
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-violet-500 outline-none"
                                    >
                                        <option value="">انتخاب کنید...</option>
                                        {users.map(u => (
                                            <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Date & Time */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">روز هفته</label>
                                    <select 
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm"
                                    >
                                        {WEEK_DAYS.map((day, i) => (
                                            <option key={i} value={i}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">شروع</label>
                                    <input 
                                        type="time" 
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm text-center"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">پایان</label>
                                    <input 
                                        type="time" 
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm text-center"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">یادداشت (اختیاری)</label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="مثلاً: لوکیشن استودیو"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm"
                                />
                            </div>

                            <button 
                                onClick={handleAddEvent}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-violet-900/50 transition-transform active:scale-95"
                            >
                                ثبت در تقویم
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionCalendar;