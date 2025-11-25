
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
        fetchItems();
    }, [fetchItems]);

    const handleAddItem = async (isForToday: boolean) => {
        if (!user || !newItemText.trim()) return;
        try {
            const position = items.filter(i => i.is_for_today === isForToday).length;
            await db.addAdminChecklistItem(user.user_id, newItemText, isForToday, position);
            setNewItemText('');
            fetchItems();
        } catch (e) {
            showNotification('خطا در افزودن مورد', 'error');
        }
    };

    const handleToggleDone = async (item: AdminChecklistItem) => {
        try {
            // Optimistic update
            setItems(items.map(i => i.id === item.id ? { ...i, is_done: !i.is_done } : i));
            await db.updateAdminChecklistItem(item.id, { is_done: !item.is_done });
        } catch (e) {
            showNotification('خطا در بروزرسانی', 'error');
            fetchItems(); // Revert on error
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('حذف شود؟')) return;
        try {
            setItems(items.filter(i => i.id !== id));
            await db.deleteAdminChecklistItem(id);
        } catch (e) {
            showNotification('خطا در حذف', 'error');
            fetchItems();
        }
    };

    // Simple drag and drop implementation
    const handleDragStart = (e: React.DragEvent, id: number) => {
        e.dataTransfer.setData("text/plain", String(id));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetId: number, isForToday: boolean) => {
        e.preventDefault();
        const draggedId = Number(e.dataTransfer.getData("text/plain"));
        if (draggedId === targetId) return;

        const draggedItem = items.find(i => i.id === draggedId);
        const targetItem = items.find(i => i.id === targetId);

        if (!draggedItem || !targetItem || draggedItem.is_for_today !== isForToday) return;

        // Swap logic mostly for UI feel, proper reordering would require updating all positions
        // For simplicity in this version, we just swap positions in DB or rely on simple re-fetch
        // Let's simply swap the positions of the two items involved
        try {
            const tempPos = draggedItem.position;
            await db.updateAdminChecklistItem(draggedItem.id, { position: targetItem.position });
            await db.updateAdminChecklistItem(targetItem.id, { position: tempPos });
            fetchItems();
        } catch (e) {
            console.error("Reorder failed", e);
        }
    };

    const renderList = (forToday: boolean) => {
        const listItems = items.filter(i => i.is_for_today === forToday).sort((a, b) => a.position - b.position);
        
        return (
            <div className="space-y-2">
                {listItems.map(item => (
                    <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item.id, forToday)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move ${
                            item.is_done 
                            ? 'bg-slate-900/30 border-slate-800 opacity-60' 
                            : 'bg-slate-800 border-slate-700 hover:border-violet-500/50'
                        }`}
                    >
                        <button 
                            onClick={() => handleToggleDone(item)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                item.is_done 
                                ? 'bg-green-600 border-green-600 text-white' 
                                : 'border-slate-500 hover:border-white'
                            }`}
                        >
                            {item.is_done && <Icon name="check-circle" className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.title}
                        </span>
                        <button onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icon name="x-circle" className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {listItems.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-4">موردی وجود ندارد</p>
                )}
            </div>
        );
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400">در حال بارگذاری چک‌لیست...</div>;

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Icon name="document-text" className="w-5 h-5 text-violet-400"/>
                    چک‌لیست من
                </h3>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
                {/* Input Area */}
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newItemText} 
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddItem(true)}
                        placeholder="اقدام جدید..." 
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                    />
                    <button onClick={() => handleAddItem(true)} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-2 text-sm">
                        + امروز
                    </button>
                    <button onClick={() => handleAddItem(false)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm">
                        + بعدا
                    </button>
                </div>

                {/* Today List */}
                <div>
                    <h4 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-1 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        برای امروز
                    </h4>
                    {renderList(true)}
                </div>

                {/* Later List */}
                <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        سایر اقدامات
                    </h4>
                    {renderList(false)}
                </div>
            </div>
        </div>
    );
};

export default AdminChecklist;
