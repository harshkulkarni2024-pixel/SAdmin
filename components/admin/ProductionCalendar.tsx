
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
    off: { label: 'آف / تعطیل', color: 'text-emerald-300', bg: 'bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border-emerald-500', icon: 'coffee' },
};

const ProductionCalendar: React.FC = () => {
    const showNotification = useNotification();
    const [events, setEvents] = useState<ProductionEvent[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form State
    const [editingEventId, setEditingEventId] = useState<number | null>(null);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [eventType, setEventType] = useState<EventType>('post');
    const [dayOfWeek, setDayOfWeek] = useState<number>(0); // 0 = Saturday, etc.
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('12:00');
    const [description, setDescription] = useState('');

    // Calculate start of the week (Saturday)
    const startOfWeek = useMemo(() => {
        const date = new Date(currentDate);
        const day = date.getDay(); // 0 (Sun) to 6 (Sat)
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

    const openModal = (event?: ProductionEvent) => {
        if (event) {
            setEditingEventId(event.id);
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            
            // Determine day of week (0-6) based on weekDates logic relative to startOfWeek isn't enough if event is in past
            // But for UI selection, we map the event's actual date to 0-6 Saturday-Friday
            const dayIndex = (start.getDay() + 1) % 7;
            
            setDayOfWeek(dayIndex);
            setStartTime(start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            setEndTime(end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            setEventType(event.event_type as EventType);
            setDescription(event.description || '');
            
            // Find user by project name matching full_name (simple heuristic)
            if (event.event_type !== 'off') {
                const user = users.find(u => u.full_name === event.project_name);
                setSelectedUser(user ? String(user.user_id) : '');
            } else {
                setSelectedUser('');
            }
        } else {
            setEditingEventId(null);
            setEventType('post');
            setDayOfWeek(0);
            setStartTime('10:00');
            setEndTime('12:00');
            setDescription('');
            setSelectedUser('');
        }
        setIsModalOpen(true);
    };

    const handleSaveEvent = async () => {
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

        const eventData = {
            project_name: projectTitle,
            event_type: eventType,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            description
        };

        try {
            if (editingEventId) {
                await db.updateProductionEvent(editingEventId, eventData);
                showNotification('رویداد بروزرسانی شد.', 'success');
            } else {
                await db.addProductionEvent(eventData);
                showNotification('رویداد جدید ثبت شد.', 'success');
            }
            
            const refreshedEvents = await db.getProductionEvents();
            setEvents(refreshedEvents);
            setIsModalOpen(false);
        } catch (e) {
            showNotification('خطا در ذخیره رویداد.', 'error');
        }
    };

    const handleDeleteEvent = async (id: number) => {
        if(confirm('آیا از حذف این رویداد اطمینان دارید؟')) {
            try {
                await db.deleteProductionEvent(id);
                const refreshedEvents = await db.getProductionEvents();
                setEvents(refreshedEvents);
                setIsModalOpen(false); // Close modal if open
                showNotification('رویداد حذف شد.', 'success');
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
        
        // Calendar starts at 8 AM
        const topOffset = (startHour - 8) * 60; 
        // Precise height based on duration
        const height = (endHour - startHour) * 60;

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
            {/* Minimal Header */}
            <div className="flex justify-between items-center mb-4 px-4 py-3 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-600/20 p-1.5 rounded-lg">
                        <Icon name="calendar" className="w-5 h-5 text-violet-400" />
                    </div>
                    <h1 className="text-lg font-bold text-white">تقویم ضبط</h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700/50">
                        <button onClick={handlePrevWeek} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"><Icon name="back" className="w-4 h-4 rotate-180 text-slate-400" /></button>
                        <span className="px-3 font-mono text-xs text-slate-300 min-w-[130px] text-center">
                            {weekDates[0].toLocaleDateString('fa-IR')} - {weekDates[6].toLocaleDateString('fa-IR')}
                        </span>
                        <button onClick={handleNextWeek} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"><Icon name="back" className="w-4 h-4 text-slate-400" /></button>
                    </div>
                    <button onClick={handleToday} className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-slate-300">امروز</button>
                    <button 
                        onClick={() => openModal()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        <Icon name="plus" className="w-4 h-4" />
                        <span>جدید</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {isLoading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50"><Loader /></div>}
                
                <div className="min-w-[800px]">
                    {/* Header Row (Days) */}
                    <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                        <div className="border-l border-slate-700"></div>
                        {weekDates.map((date, i) => {
                            const isToday = new Date().toDateString() === date.toDateString();
                            return (
                                <div key={i} className={`py-2 text-center border-l border-slate-700 ${isToday ? 'bg-violet-900/20' : ''}`}>
                                    <p className={`text-xs font-bold ${isToday ? 'text-violet-400' : 'text-slate-400'}`}>{WEEK_DAYS[i]}</p>
                                    <p className={`text-[10px] mt-0.5 ${isToday ? 'text-violet-300' : 'text-slate-500'}`}>{date.toLocaleDateString('fa-IR')}</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Time Grid */}
                    <div className="grid grid-cols-[50px_repeat(7,1fr)] relative">
                        {/* Time Labels Column */}
                        <div className="border-l border-slate-700 bg-slate-900/50">
                            {TIME_SLOTS.map(hour => (
                                <div key={hour} className="h-[60px] border-b border-slate-700/50 text-[10px] text-slate-500 text-center pt-1 relative">
                                    <span className="absolute -top-2 left-0 right-0 bg-slate-900/50 px-1">{hour}:00</span>
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
                                            className={`absolute inset-x-1 rounded p-1.5 border overflow-hidden group cursor-pointer transition-all hover:z-10 hover:scale-[1.02] shadow-md ${config.bg}`}
                                            style={style}
                                            onClick={() => openModal(event)}
                                        >
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Icon name={config.icon} className={`w-3 h-3 ${config.color}`} />
                                                <span className={`text-[10px] font-bold truncate ${config.color}`}>{config.label}</span>
                                            </div>
                                            <p className="text-xs text-white font-semibold truncate leading-tight">{event.project_name}</p>
                                            {event.description && (
                                                <p className="text-[9px] text-white/70 truncate mt-0.5">{event.description}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add/Edit Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {editingEventId ? <Icon name="edit" className="w-5 h-5 text-violet-400"/> : <Icon name="plus" className="w-5 h-5 text-violet-400"/>}
                                {editingEventId ? 'ویرایش رویداد' : 'رویداد جدید'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><Icon name="x-circle" className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            {/* Minimal Event Type Selector */}
                            <div className="flex bg-slate-900 rounded-lg p-1 gap-1 overflow-x-auto">
                                {(Object.entries(EVENT_TYPES) as [EventType, EventConfig][]).map(([type, config]) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setEventType(type);
                                            if (type === 'off') setSelectedUser('');
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                                            eventType === type 
                                            ? `${config.bg.split(' ')[0]} text-white shadow-sm` 
                                            : 'text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Icon name={config.icon} className="w-3.5 h-3.5" />
                                        <span>{config.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Project/User Selection */}
                            {eventType !== 'off' && (
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">انتخاب پروژه (کاربر)</label>
                                    <div className="relative">
                                        <select 
                                            value={selectedUser} 
                                            onChange={(e) => setSelectedUser(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:border-violet-500 outline-none appearance-none"
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            {users.map(u => (
                                                <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute left-3 top-3 pointer-events-none text-slate-500">
                                            <Icon name="users" className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Date & Time */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-3 md:col-span-1">
                                    <label className="block text-xs text-slate-400 mb-1.5">روز هفته</label>
                                    <select 
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white outline-none focus:border-violet-500"
                                    >
                                        {WEEK_DAYS.map((day, i) => (
                                            <option key={i} value={i}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">ساعت شروع</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-center text-white outline-none focus:border-violet-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">ساعت پایان</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-center text-white outline-none focus:border-violet-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">یادداشت (اختیاری)</label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="مثلاً: لوکیشن استودیو"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white outline-none focus:border-violet-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                {editingEventId && (
                                    <button 
                                        onClick={() => handleDeleteEvent(editingEventId)}
                                        className="bg-red-900/50 border border-red-700 text-red-200 hover:bg-red-900/80 p-2.5 rounded-lg transition-colors"
                                        title="حذف رویداد"
                                    >
                                        <Icon name="trash" className="w-5 h-5" />
                                    </button>
                                )}
                                <button 
                                    onClick={handleSaveEvent}
                                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-violet-900/30 transition-transform active:scale-95 flex justify-center items-center gap-2"
                                >
                                    {editingEventId ? (
                                        <>
                                            <Icon name="refresh" className="w-5 h-5"/>
                                            بروزرسانی
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="save" className="w-5 h-5"/>
                                            ثبت
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionCalendar;
