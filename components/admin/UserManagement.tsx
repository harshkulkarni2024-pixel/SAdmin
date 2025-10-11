import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

interface UserManagementProps {
  onSelectUser: (user: User) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onSelectUser }) => {
  const { logout: onLogout } = useUser();
  const showNotification = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', code: '', is_vip: false });
  const [error, setError] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      const allUsers = await db.getAllUsers();
      setUsers(allUsers);
    } catch (e) {
      showNotification((e as Error).message, 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);
  
  const handleAddUser = async () => {
      if (!newUser.name || !newUser.code) {
          setError('نام و کد دسترسی هر دو الزامی هستند.');
          return;
      }
      const result = await db.addUser(newUser.name, newUser.code, newUser.is_vip);
      
      showNotification(result.message, result.success ? 'success' : 'error');
      
      if (result.success) {
          refreshUsers();
          setShowAddModal(false);
          setNewUser({ name: '', code: '', is_vip: false });
          setError(null);
      } else {
          setError(result.message);
      }
  };
  
  const handleDeleteUser = async (userId: number) => {
      if (window.confirm('آیا از حذف این کاربر و تمام اطلاعات او مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
          await db.deleteUser(userId);
          showNotification('کاربر با موفقیت حذف شد.', 'success');
          refreshUsers();
      }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
         <button onClick={onLogout} className="flex items-center bg-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-colors">
            <Icon name="logout" className="w-5 h-5 me-2" />
            خروج از حساب کاربری
        </button>
        <button onClick={() => setShowAddModal(true)} className="flex items-center bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
          <Icon name="plus" className="w-5 h-5 me-2" />
          افزودن کاربر
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-right">
            <thead className="bg-slate-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">نام</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">کد دسترسی</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map(user => (
                <tr key={user.user_id} className="hover:bg-slate-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    <div className="flex items-center">
                      <span>{user.full_name}</span>
                      {user.is_vip && (
                        <span className="ms-2 text-xs bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-lg shadow-violet-500/50 animate-pulse">VIP</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{user.access_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <div className="flex justify-end items-center gap-4">
                        <button onClick={() => handleDeleteUser(user.user_id)} className="text-red-500 hover:text-red-400">حذف</button>
                        <button onClick={() => onSelectUser(user)} className="text-violet-400 hover:text-violet-300">مدیریت</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">افزودن کاربر جدید</h2>
             {error && <p className="text-red-400 mb-4 whitespace-pre-line">{error}</p>}
            <div className="space-y-4">
              <input type="text" placeholder="نام کامل" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full bg-slate-700 p-2 rounded text-white" />
              <input type="text" placeholder="کد دسترسی" value={newUser.code} onChange={e => setNewUser({...newUser, code: e.target.value})} className="w-full bg-slate-700 p-2 rounded text-white" />
              <div className="flex items-center">
                  <input 
                      id="vip-checkbox" 
                      type="checkbox" 
                      checked={newUser.is_vip}
                      onChange={e => setNewUser({...newUser, is_vip: e.target.checked})}
                      className="w-4 h-4 text-violet-600 bg-slate-700 border-slate-600 rounded focus:ring-violet-500 focus:ring-2" 
                  />
                  <label htmlFor="vip-checkbox" className="ms-2 text-sm font-medium text-slate-300">
                      افزودن به عنوان کاربر VIP
                  </label>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => {setShowAddModal(false); setError(null);}} className="bg-slate-600 px-4 py-2 rounded-lg hover:bg-slate-500">لغو</button>
              <button onClick={handleAddUser} className="bg-violet-600 px-4 py-2 rounded-lg hover:bg-violet-700">افزودن کاربر</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;