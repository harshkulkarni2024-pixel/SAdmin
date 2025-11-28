
import React, { useState, useEffect, useCallback } from 'react';
import { AdminChecklistItem } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

const AdminChecklist: React.FC = () => {
    const { user } = useUser();
    const showNotification = useNotification();
    const [items, setItems] = useState<AdminChecklistItem[]>([]);
    const [newItemText, setNewItemText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [activeTab, setActiveTab] = useState<'today' | 'others' | 'history'>('today');
    
    // Assignment Logic
    const [adminIds, setAdminIds] = useState<Record<string, number>>({});
    const [assignments, setAssignments] = useState<{ M: boolean, N: boolean, T: boolean }>({ M: false, N: false, T: false });

    const fetchItems = useCallback(async () => {
        if (!user) return;
        try {
            const data = await db.getAdminChecklist(user.user_id);
            setItems(data);
        } catch (e) {
            console.error("Failed to fetch checklist", e);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        const loadIds = async () => {
            const ids = await db.getAdminUserIds();
            setAdminIds(ids);
        }
        loadIds();
        fetchItems();
    }, [fetchItems]);

    const handleAddItem = async () => {
        if (!user || !newItemText.trim()) return;
        
        // Logic: If on "Today" tab, add to Today. If on "Others", add to Others. Default to Today.
        const targetIsForToday = activeTab === 'others' ? false : true;

        try {
            const targets: {id: number, badge: string}[] = [];
            
            if (assignments.M && adminIds['M']) targets.push({id: adminIds['M'], badge: 'M'});
            if (assignments.N && adminIds['N']) targets.push({id: adminIds['N'], badge: 'N'});
            if (assignments.T && adminIds['T']) targets.push({id: adminIds['T'], badge: 'T'});
            
            if (targets.length === 0) {
                targets.push({ id: user.user_id, badge: '' });
            }

            // Calculate new position (top of the list)
            const currentList = items.filter(i => i.is_for_today === targetIsForToday && !i.is_done);
            const minPos = currentList.length > 0 ? Math.min(...currentList.map(i => i.position)) : 0;
            const newPos = minPos - 1;

            const promises = targets.map(async (target) => {
                await db.addAdminChecklistItem(target.id, newItemText, targetIsForToday, newPos, target.badge);
            });

            await Promise.all(promises);

            setNewItemText('');
            setAssignments({ M: false, N: false, T: false });
            fetchItems();
            
            if (targets.some(t => t.id !== user.user_id)) {
                showNotification('اقدام برای مدیران انتخاب شده ثبت شد.', 'success');
            }

        } catch (e) {
            showNotification('خطا در افزودن مورد', 'error');
        }
    };

    const handleToggleDone = async (item: AdminChecklistItem) => {
        try {
            const newIsDone = !item.is_done;
            // Optimistic update
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: newIsDone } : i));
            
            await db.updateAdminChecklistItem(item.id, { is_done: newIsDone });
            
            // If completed, verify position or move logic if needed in backend, 
            // but UI handles it by filtering into History tab.
        } catch (e) {
            showNotification('خطا در بروزرسانی', 'error');
            fetchItems();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('حذف شود؟')) return;
        try {
            setItems(prev => prev.filter(i => i.id !== id));
            await db.deleteAdminChecklistItem(id);
        } catch (e) {
            showNotification('خطا در حذف', 'error');
            fetchItems();
        }
    };

    const startEditing = (item: AdminChecklistItem) => {
        setEditingItemId(item.id);
        setEditValue(item.title);
    };

    const saveEdit = async (id: number) => {
        if (!editValue.trim()) return;
        try {
            await db.updateAdminChecklistItem(id, { title: editValue });
            setItems(prev => prev.map(i => i.id === id ? { ...i, title: editValue } : i));
            setEditingItemId(null);
        } catch (e) {
            showNotification('خطا در ویرایش', 'error');
        }
    };

    const handleMove = async (item: AdminChecklistItem) => {
        try {
            const newIsForToday = !item.is_for_today;
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_for_today: newIsForToday } : i));
            await db.updateAdminChecklistItem(item.id, { is_for_today: newIsForToday });
            showNotification(newIsForToday ? 'به لیست امروز منتقل شد' : 'به لیست سایر اقدامات منتقل شد', 'success');
        } catch (e) {
            showNotification('خطا در جابجایی', 'error');
            fetchItems();
        }
    }

    const toggleAssignment = (key: 'M' | 'N' | 'T') => {
        setAssignments(prev => ({ ...prev, [key]: !prev[key] }));
    }

    const handleManualReorder = async (item: AdminChecklistItem, direction: 'up' | 'down') => {
        const currentList = items
            .filter(i => i.is_for_today === item.is_for_today && !i.is_done)
            .sort((a, b) => a.position - b.position);

        const currentIndex = currentList.findIndex(i => i.id === item.id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= currentList.length) return;

        const targetItem = currentList[targetIndex];

        // Optimistic update
        const newItems = items.map(p => {
            if (p.id === item.id) return { ...p, position: targetItem.position };
            if (p.id === targetItem.id) return { ...p, position: item.position };
            return p;
        });
        
        setItems(newItems);

        try {
            await db.updateAdminChecklistOrder([
                { id: item.id, position: targetItem.position },
                { id: targetItem.id, position: item.position }
            ]);
        } catch (e) {
            fetchItems(); // Revert on error
        }
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400">در حال بارگذاری چک‌لیست...</div>;

    const renderList = () => {
        let listItems = [];
        if (activeTab === 'history') {
            listItems = items.filter(i => i.is_done).sort((a, b) => b.id - a.id); // Newest first for history
        } else {
            const isForToday = activeTab === 'today';
            listItems = items.filter(i => i.is_for_today === isForToday && !i.is_done).sort((a, b) => a.position - b.position);
        }

        if (listItems.length === 0) return <p className="text-center text-slate-500 py-8">موردی یافت نشد.</p>;

        return (
            <div className="space-y-2">
                {listItems.map((item, index) => (
                    <div 
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${item.is_done ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-600'} group`}
                    >
                        {/* Reorder Buttons (Only for active lists) */}
                        {!item.is_done && (
                            <div className="flex flex-col gap-1 -ml-1">
                                <button 
                                    onClick={() => handleManualReorder(item, 'up')} 
                                    className={`p-0.5 text-slate-600 hover:text-white rounded ${index === 0 ? 'opacity-30 cursor-default' : ''}`}
                                    disabled={index === 0}
                                >
                                    <Icon name="arrow-up" className="w-3 h-3" />
                                </button>
                                <button 
                                    onClick={() => handleManualReorder(item, 'down')} 
                                    className={`p-0.5 text-slate-600 hover:text-white rounded ${index === listItems.length - 1 ? 'opacity-30 cursor-default' : ''}`}
                                    disabled={index === listItems.length - 1}
                                >
                                    <Icon name="arrow-down" className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <button 
                            onClick={() => handleToggleDone(item)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${item.is_done ? 'bg-green-600 border-green-600 text-white' : 'border-slate-500 hover:border-green-400 hover:bg-green-400/20'}`}
                            title={item.is_done ? "بازگرداندن" : "انجام شد"}
                        >
                            {item.is_done && <Icon name="check-circle" className="w-3.5 h-3.5" />}
                        </button>

                        {item.badge && (
                            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-indigo-500 text-white" title={`Assigned to ${item.badge}`}>
                                {item.badge}
                            </span>
                        )}

                        {editingItemId === item.id ? (
                            <div className="flex-1 flex items-center gap-2">
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={editValue} 
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                />
                                <button onClick={() => saveEdit(item.id)} className="text-green-400 hover:text-green-300"><Icon name="check-circle" className="w-5 h-5"/></button>
                                <button onClick={() => setEditingItemId(null)} className="text-red-400 hover:text-red-300"><Icon name="x-circle" className="w-5 h-5"/></button>
                            </div>
                        ) : (
                            <span className={`flex-1 text-sm ${item.is_done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                {item.title}
                            </span>
                        )}

                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {editingItemId !== item.id && (
                                <>
                                    <button onClick={() => startEditing(item)} className="text-slate-500 hover:text-violet-400 p-1" title="ویرایش">
                                        <Icon name="pencil" className="w-4 h-4" />
                                    </button>
                                    {!item.is_done && (
                                        <button onClick={() => handleMove(item)} className="text-slate-500 hover:text-blue-400 p-1" title="جابجایی بین لیست‌ها">
                                            <Icon name="switch" className="w-4 h-4 rotate-90" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-red-400 p-1" title="حذف">
                                        <Icon name="trash" className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-white">
                    <Icon name="document-text" className="w-5 h-5 text-violet-400"/>
                    چک‌لیست اقدامات
                </h3>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-900/30">
                <button 
                    onClick={() => setActiveTab('today')} 
                    className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'today' ? 'border-violet-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                    امروز
                </button>
                <button 
                    onClick={() => setActiveTab('others')} 
                    className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'others' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                    سایر اقدامات
                </button>
                <button 
                    onClick={() => setActiveTab('history')} 
                    className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-slate-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                    تاریخچه
                </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                {/* Input Area (Only for Active Tabs) */}
                {activeTab !== 'history' && (
                    <div className="mb-6">
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" 
                                value={newItemText} 
                                onChange={(e) => setNewItemText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                                placeholder="اقدام جدید..." 
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                            />
                            <button onClick={handleAddItem} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap">
                                <Icon name="plus" className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Assignment Toggles */}
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] text-slate-500">ارجاع به:</span>
                            {(['M', 'N', 'T'] as const).map(letter => (
                                <button
                                    key={letter}
                                    onClick={() => toggleAssignment(letter)}
                                    className={`w-6 h-6 rounded-full text-[10px] font-bold border transition-colors flex items-center justify-center ${
                                        assignments[letter] 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
                                    }`}
                                    title={`اختصاص به ادمین ${letter}`}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* List Content */}
                {renderList()}
            </div>
        </div>
    );
};

export default AdminChecklist;
