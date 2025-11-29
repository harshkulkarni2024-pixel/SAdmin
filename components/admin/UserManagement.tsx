
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
  const { user: currentUser } = useUser();
  const showNotification = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', code: '', is_vip: false });
  const [newAdmin, setNewAdmin] = useState({ name: '', code: '' });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'admins'>('users');

  // Only 'manager' can see/manage admins
  const isManager = currentUser?.role === 'manager';

  const refreshData = useCallback(async () => {
    try {
      const allUsers = await db.getAllUsers();
      setUsers(allUsers);
      
      if (isManager) {
          const allAdmins = await db.getAllAdmins();
          setAdmins(allAdmins);
      }
    } catch (e) {
      showNotification((e as Error).message, 'error');
    }
  }, [showNotification, isManager]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);
  
  const handleAddUser = async () => {
      if (!newUser.name || !newUser.code) {
          setError('نام و کد دسترسی هر دو الزامی هستند.');
          return;
      }
      const result = await db.addUser(newUser.name, newUser.code, newUser.is_vip);
      
      showNotification(result.message, result.success ? 'success' : 'error');
      
      if (result.success) {
          refreshData();
          setShowAddModal(false);
          setNewUser({ name: '', code: '', is_vip: false });
          setError(null);
      } else {
          setError(result.message);
      }
  };

  const handleAddAdmin = async () => {
      if (!isManager) {
          showNotification('فقط مدیر اصلی دسترسی افزودن مدیر را دارد.', 'error');
          return;
      }
      if (!newAdmin.name || !newAdmin.code) {
          setError('نام و کد دسترسی الزامی هستند.');
          return;
      }
      const result = await db.addAdmin(newAdmin.name, newAdmin.code);
      showNotification(result.message, result.success ? 'success' : 'error');
      if(result.success) {
          refreshData();
          setShowAddAdminModal(false);
          setNewAdmin({ name: '', code: '' });
          setError(null);
      } else {
          setError(result.message);
      }
  };
  
  const handleDeleteAdmin = async (adminId: number) => {
      if (!isManager) {
          showNotification('فقط مدیر اصلی دسترسی حذف مدیران را دارد.', 'error');
          return;
      }
      if (window.confirm('آیا از حذف این مدیر اطمینان دارید؟')) {
          await db.deleteUser(adminId);
          showNotification('مدیر با موفقیت حذف شد.', 'success');
          refreshData();
      }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
         <h1 className="text-3xl font-bold text-white">مدیریت کاربران</h1>
         {isManager && (
             <div className="bg-slate-800 p-1 rounded-lg flex">
                 <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>کاربران عادی</button>
                 <button onClick={() => setActiveTab('admins')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>مدیران</button>
             </div>
         )}
         {activeTab === 'users' ? (
            <button onClick={() => setShowAddModal(true)} className="flex items-center bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
            <Icon name="plus" className="w-5 h-5 me-2" />
            افزودن کاربر
            </button>
         ) : (
            isManager && (
                <button onClick={() => setShowAddAdminModal(true)} className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
                <Icon name="plus" className="w-5 h-5 me-2" />
                افزودن مدیر
                </button>
            )
         )}
      </div>

      {activeTab === 'users' && (
      <div className="bg-slate-800 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-right">
            <thead className="bg-slate-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">نام کاربر</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider w-24">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map(user => (
                <tr key={user.user_id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => onSelectUser(user)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    <div className="flex items-center">
                      <span>{user.full_name}</span>
                      {user.is_vip && (
                        <span className="ms-2 text-xs bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-lg shadow-violet-500/50">VIP</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <button onClick={(e) => { e.stopPropagation(); onSelectUser(user); }} className="text-violet-400 hover:text-violet-300 px-3 py-1 rounded border border-slate-600 hover:bg-slate-700 transition-colors">مدیریت</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeTab === 'admins' && isManager && (
          <div className="bg-slate-800 rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700 text-right">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">نام مدیر</th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">کد دسترسی</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {admins.map(admin => (
                    <tr key={admin.user_id} className="hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {admin.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{admin.access_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <button onClick={() => handleDeleteAdmin(admin.user_id)} className="text-red-500 hover:text-red-400">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
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

      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddAdminModal(false)}>
          <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-emerald-700/50" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">افزودن مدیر جدید</h2>
             {error && <p className="text-red-400 mb-4 whitespace-pre-line">{error}</p>}
            <div className="space-y-4">
              <input type="text" placeholder="نام کامل مدیر" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} className="w-full bg-slate-700 p-2 rounded text-white" />
              <input type="text" placeholder="کد دسترسی مدیر" value={newAdmin.code} onChange={e => setNewAdmin({...newAdmin, code: e.target.value})} className="w-full bg-slate-700 p-2 rounded text-white" />
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => {setShowAddAdminModal(false); setError(null);}} className="bg-slate-600 px-4 py-2 rounded-lg hover:bg-slate-500">لغو</button>
              <button onClick={handleAddAdmin} className="bg-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-700 text-white">افزودن مدیر</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
