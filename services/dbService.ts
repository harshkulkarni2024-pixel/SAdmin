
import type { User, PostScenario, Plan, Report, Caption, PostIdea, ActivityLog, ChatMessage, SubscriptionHistory, AlgorithmNews, CompetitorAnalysisHistory, EditorTask, ProductionEvent, AdminChecklistItem } from '../types';
import { supabase, SUPABASE_INIT_ERROR } from './supabaseClient';

// --- Constants ---
const ADMIN_IDS = [1337]; 
const ADMIN_DB_ACCESS_CODE = 'Item8'; // Legacy code, keeping for fallback but 'M77m' is new super admin

// --- Helper Functions ---
const handleError = (error: any, context: string) => {
    if (error) {
        console.error(`Supabase error in ${context}:`, error);
    }
    return null;
}

// --- User Management ---
export const isUserAdmin = (userId: number): boolean => ADMIN_IDS.includes(userId);

export const verifyAccessCode = async (code: string, isSessionLogin: boolean = false): Promise<User | null> => {
    if (!supabase) {
        throw new Error(SUPABASE_INIT_ERROR);
    }

    let query;
    
    if (isSessionLogin) {
        const userId = parseInt(code, 10);
        if (isNaN(userId)) return null;
        query = supabase.from('users').select('*').eq('user_id', userId).eq('is_verified', true).single();
    } else {
        query = supabase.from('users').select('*').eq('access_code', code).eq('is_verified', true).single();
    }

    const { data: user, error } = await query;
    
    if (error && error.code !== 'PGRST116') { 
        handleError(error, 'verifyAccessCode');
        throw new Error(`خطای پایگاه داده: ${error.message}`);
    }

    if (!user) {
        return null;
    }
    
    // Roles are now properly handled in DB (role column)
    // Just ensuring basic fallback if needed
    if (user.role !== 'editor' && user.role !== 'admin') {
        user.role = 'user';
    }

    if (user.role === 'user') {
        const expires = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
        if (!expires || expires < new Date()) {
            user.is_subscription_expired = true;
            return user;
        }
    }

    // Update usage stats only for regular users
    if (user.role === 'user') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        let updatePayload: {[key: string]: any} = {};
        let needsUpdate = false;

        if (user.last_request_date !== todayStr) {
            updatePayload.story_requests = 0;
            updatePayload.caption_idea_requests = 0;
            updatePayload.last_request_date = todayStr;
            needsUpdate = true;
        }

        const lastWeeklyReset = user.last_weekly_reset_date ? new Date(user.last_weekly_reset_date) : new Date(0);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (today.getTime() - lastWeeklyReset.getTime() > oneWeek) {
            updatePayload.chat_messages = 0;
            updatePayload.last_weekly_reset_date = todayStr;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const { error: updateError } = await supabase.from('users').update(updatePayload).eq('user_id', user.user_id);

            if (updateError) {
                handleError(updateError, 'verifyAccessCode:updateUsage');
            } else {
                if (updatePayload.story_requests === 0) user.story_requests = 0;
                if (updatePayload.caption_idea_requests === 0) user.caption_idea_requests = 0;
                if (updatePayload.last_request_date) user.last_request_date = updatePayload.last_request_date;
                if (updatePayload.chat_messages === 0) user.chat_messages = 0;
                if (updatePayload.last_weekly_reset_date) user.last_weekly_reset_date = updatePayload.last_weekly_reset_date;
            }
        }
    }
    
    if(!isSessionLogin) {
        await logActivity(user.user_id, 'به برنامه وارد شد.');
    }

    return user;
};

export const getAllUsers = async (): Promise<User[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    // Exclude admin and editors from the general user list
    const { data, error } = await supabase.from('users')
        .select('*')
        .neq('role', 'admin')
        .neq('role', 'editor')
        .or('role.is.null,role.eq.user');
        
    if (error) handleError(error, 'getAllUsers');
    return data || [];
};

export const getAllEditors = async (): Promise<User[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('users').select('*').eq('role', 'editor').order('created_at', { ascending: false });
    if (error) handleError(error, 'getAllEditors');
    return data || [];
};

export const getAllAdmins = async (): Promise<User[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('users').select('*').eq('role', 'admin');
    if (error) handleError(error, 'getAllAdmins');
    return data || [];
};

export const getUserById = async (userId: number): Promise<User | null> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (error) handleError(error, 'getUserById');
    return data;
};

export const addUser = async (fullName: string, accessCode: string, isVip: boolean): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: SUPABASE_INIT_ERROR };
    
    const { data: existingUser, error: checkError } = await supabase.from('users').select('user_id').eq('access_code', accessCode).single();
    if (checkError && checkError.code !== 'PGRST116') {
        handleError(checkError, 'addUser:check');
        return { success: false, message: 'خطا در بررسی کد دسترسی.' };
    }
    if (existingUser) {
        return { success: false, message: 'این کد دسترسی قبلاً استفاده شده است.' };
    }
    
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 day trial

    const newUser: Omit<User, 'user_id'> & { user_id?: number } = {
        full_name: fullName,
        access_code: accessCode,
        is_verified: true,
        role: 'user',
        story_requests: 0,
        caption_idea_requests: 0,
        chat_messages: 0,
        story_limit: 2,
        caption_idea_limit: 5,
        chat_limit: 150,
        last_request_date: new Date().toISOString().split('T')[0],
        last_weekly_reset_date: new Date().toISOString().split('T')[0],
        about_info: '',
        preferred_name: '',
        is_vip: isVip,
        subscription_expires_at: expires.toISOString(),
    };
    
    newUser.user_id = Date.now();
    
    const { error } = await supabase.from('users').insert(newUser);
    if (error) {
        handleError(error, 'addUser:insert');
        return { success: false, message: `خطا در افزودن کاربر: ${error.message}` };
    }
    return { success: true, message: `کاربر '${fullName}' با موفقیت اضافه شد.` };
};

export const addAdmin = async (fullName: string, accessCode: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: SUPABASE_INIT_ERROR };
    
    const { data: existingUser, error: checkError } = await supabase.from('users').select('user_id').eq('access_code', accessCode).single();
    if (existingUser) return { success: false, message: 'کد دسترسی تکراری است.' };

    const newAdmin = {
        user_id: Date.now(),
        full_name: fullName,
        access_code: accessCode,
        is_verified: true,
        role: 'admin',
        story_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('users').insert(newAdmin);
    if (error) return { success: false, message: error.message };
    return { success: true, message: `ادمین ${fullName} اضافه شد.` };
};

export const addEditor = async (fullName: string, accessCode: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: SUPABASE_INIT_ERROR };
    
    const { data: existingUser, error: checkError } = await supabase.from('users').select('user_id').eq('access_code', accessCode).single();
    if (checkError && checkError.code !== 'PGRST116') {
        handleError(checkError, 'addEditor:check');
        return { success: false, message: 'خطا در بررسی کد دسترسی.' };
    }
    if (existingUser) {
        return { success: false, message: 'این کد دسترسی قبلاً استفاده شده است.' };
    }
    
    const newEditor = {
        user_id: Date.now(),
        full_name: fullName,
        access_code: accessCode,
        is_verified: true,
        role: 'editor',
        // Default values for required fields in DB
        story_requests: 0,
        caption_idea_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString().split('T')[0],
        is_vip: false
    };
    
    const { error } = await supabase.from('users').insert(newEditor);
    if (error) {
        handleError(error, 'addEditor:insert');
        return { success: false, message: `خطا در افزودن تدوینگر: ${error.message}` };
    }
    return { success: true, message: `تدوینگر '${fullName}' با موفقیت اضافه شد.` };
};

export const deleteUser = async (userId: number): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteUser');
};

export const updateUserInfo = async (userId: number, info: { about_info: string, preferred_name: string }): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update({ about_info: info.about_info, preferred_name: info.preferred_name }).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserInfo');
        throw new Error(error.message);
    }
};

export const updateUserVipStatus = async (userId: number, isVip: boolean): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update({ is_vip: isVip }).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserVipStatus');
        throw error;
    }
}

export const updateUserUsageLimits = async (userId: number, limits: Partial<Pick<User, 'story_requests' | 'caption_idea_requests' | 'chat_messages'>>): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserUsageLimits');
        throw error;
    }
}

export const updateUserTotalLimits = async (userId: number, limits: Partial<Pick<User, 'story_limit' | 'caption_idea_limit' | 'chat_limit'>>): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserTotalLimits');
        throw error;
    }
}


// --- Usage Tracking ---
export const incrementUsage = async (userId: number, type: 'story' | 'chat' | 'caption_idea' | 'competitor_analysis'): Promise<void> => {
    if (!supabase) return;
    const user = await getUserById(userId);
    if (!user) return;

    let columnToIncrement: 'story_requests' | 'chat_messages' | 'caption_idea_requests' | null = null;
    let action = '';
    
    if (type === 'story') { 
        columnToIncrement = 'story_requests';
        action = `یک سناریوی استوری (${user.story_requests + 1}/${user.story_limit ?? 2} روزانه) تولید کرد.`;
    }
    else if (type === 'caption_idea') {
        columnToIncrement = 'caption_idea_requests';
        action = `یک کپشن از ایده (${(user.caption_idea_requests ?? 0) + 1}/${user.caption_idea_limit ?? 5} روزانه) تولید کرد.`;
    }
    else if (type === 'chat') {
        columnToIncrement = 'chat_messages';
        action = `یک پیام در چت (${user.chat_messages + 1}/${user.chat_limit ?? 150} هفتگی) ارسال کرد.`;
    }
    else if (type === 'competitor_analysis') {
      action = 'یک تحلیل رقیب انجام داد.';
    }

    if (columnToIncrement) {
      const { error } = await supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_column: columnToIncrement
      });
      if (error) {
        handleError(error, `incrementUsage:${type}`);
      }
    }
    
    if(action) {
      await logActivity(userId, action);
    }
};

// --- Subscription ---
export const getSubscriptionHistory = async (userId: number): Promise<SubscriptionHistory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) handleError(error, 'getSubscriptionHistory');
    return data || [];
};

export const extendSubscription = async (userId: number, days: number): Promise<{ success: boolean; message: string }> => {
    if (days <= 0) return { success: false, message: 'تعداد روزها باید مثبت باشد.' };

    if (!supabase) return { success: false, message: SUPABASE_INIT_ERROR };

    const { error } = await supabase.rpc('extend_subscription', {
        p_user_id: userId,
        p_days_to_add: days,
    });

    if (error) {
        handleError(error, 'extendSubscription');
        return { success: false, message: `خطا در تمدید اشتراک: ${error.message}` };
    }

    return { success: true, message: `اشتراک با موفقیت برای ${days} روز تمدید شد.` };
};


// --- Plans ---
export const getPlansForUser = async (userId: number): Promise<Plan[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('plans').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) {
        console.error('Supabase error in getPlansForUser:', error);
        throw error;
    }
    return data || [];
};

export const savePlanForUser = async (userId: number, content: string): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('plans').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) {
        console.error('Supabase error in savePlanForUser:', error);
        throw error;
    }
};

export const deletePlanById = async (planId: number): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('plans').delete().eq('id', planId);
    if (error) {
        console.error('Supabase error in deletePlanById:', error);
        throw error;
    }
};


// --- Reports ---
export const getReportsForUser = async (userId: number): Promise<Report[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('reports').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) {
        console.error('Supabase error in getReportsForUser:', error);
        throw error;
    }
    return data || [];
};

export const getAllReports = async (): Promise<Report[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
    if (error) handleError(error, 'getAllReports');
    return data || [];
};

export const saveReportForUser = async (userId: number, content: string): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('reports').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) {
        console.error('Supabase error in saveReportForUser:', error);
        throw error;
    }
};

export const updateReportById = async (reportId: number, content: string): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('reports').update({ content }).eq('id', reportId);
    if (error) {
        console.error('Supabase error in updateReportById:', error);
        throw error;
    }
};

export const deleteReportById = async (reportId: number): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) {
        console.error('Supabase error in deleteReportById:', error);
        throw error;
    }
};

// --- Scenarios ---
export const getScenariosForUser = async (userId: number): Promise<PostScenario[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('scenarios').select('*').eq('user_id', userId).order('scenario_number', { ascending: true });
    if (error) handleError(error, 'getScenariosForUser');
    return data || [];
};

export const getAllScenarios = async (): Promise<PostScenario[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('scenarios').select('*');
    if (error) handleError(error, 'getAllScenarios');
    return data || [];
};

export const getScenarioById = async (id: number): Promise<PostScenario | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('scenarios').select('*').eq('id', id).single();
    if (error) handleError(error, 'getScenarioById');
    return data || null;
}
export const addScenarioForUser = async (userId: number, scenarioNumber: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('scenarios').insert({ user_id: userId, scenario_number: scenarioNumber, content });
    if (error) handleError(error, 'addScenarioForUser');
};
export const deleteScenario = async (scenarioId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId);
    if (error) handleError(error, 'deleteScenario');
};

// --- Editor Tasks Management ---

export const createEditorTask = async (clientUserId: number, scenarioContent: string, scenarioNumber: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('editor_tasks').insert({
        client_user_id: clientUserId,
        scenario_content: scenarioContent,
        scenario_number: scenarioNumber,
        status: 'pending_assignment',
    });
    if (error) handleError(error, 'createEditorTask');
};

export const getEditorTasks = async (editorId?: number): Promise<EditorTask[]> => {
    if (!supabase) return [];
    let query = supabase
        .from('editor_tasks')
        .select(`
            *,
            client_name:client_user_id(full_name),
            editor_name:assigned_editor_id(full_name)
        `)
        .order('created_at', { ascending: false });

    if (editorId) {
        query = query.eq('assigned_editor_id', editorId);
    }

    const { data, error } = await query;
    if (error) {
        handleError(error, 'getEditorTasks');
        return [];
    }
    
    // Flatten the joined data for simpler consumption in UI
    return data.map((task: any) => ({
        ...task,
        client_name: task.client_name?.full_name || 'کاربر حذف شده',
        editor_name: task.editor_name?.full_name || 'تعیین نشده'
    }));
};

export const assignEditorTask = async (taskId: number, editorId: number, adminNote?: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('editor_tasks').update({
        assigned_editor_id: editorId,
        status: 'assigned',
        admin_note: adminNote,
        updated_at: new Date().toISOString()
    }).eq('id', taskId);
    if (error) handleError(error, 'assignEditorTask');
};

export const updateEditorTaskStatus = async (taskId: number, status: EditorTask['status'], editorNote?: string): Promise<void> => {
    if (!supabase) return;
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (editorNote !== undefined) {
        updatePayload.editor_note = editorNote;
    }
    const { error } = await supabase.from('editor_tasks').update(updatePayload).eq('id', taskId);
    if (error) handleError(error, 'updateEditorTaskStatus');
};

export const deleteEditorTask = async (taskId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('editor_tasks').delete().eq('id', taskId);
    if(error) handleError(error, 'deleteEditorTask');
};

export const uploadFile = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

    if (error) {
        handleError(error, 'uploadFile');
        return null;
    }

    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

// --- Production Calendar Events ---

export const getProductionEvents = async (): Promise<ProductionEvent[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('production_events')
        .select('*')
        .order('start_time', { ascending: true });
    
    if (error) {
        handleError(error, 'getProductionEvents');
        return [];
    }
    return data || [];
};

export const getProductionEventsForUser = async (userName: string): Promise<ProductionEvent[]> => {
    if (!supabase) return [];
    // Note: In a real app, linking by ID is better, but current schema uses name string
    const { data, error } = await supabase
        .from('production_events')
        .select('*')
        .eq('project_name', userName)
        .order('start_time', { ascending: true });
    
    if (error) {
        handleError(error, 'getProductionEventsForUser');
        return [];
    }
    return data || [];
};

export const addProductionEvent = async (event: Omit<ProductionEvent, 'id' | 'created_at'>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('production_events').insert(event);
    if (error) handleError(error, 'addProductionEvent');
};

export const updateProductionEvent = async (id: number, event: Partial<ProductionEvent>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('production_events').update(event).eq('id', id);
    if (error) handleError(error, 'updateProductionEvent');
};

export const deleteProductionEvent = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('production_events').delete().eq('id', id);
    if (error) handleError(error, 'deleteProductionEvent');
};

// --- Admin Checklist ---

export const getAdminChecklist = async (adminId: number): Promise<AdminChecklistItem[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('admin_checklist')
        .select('*')
        .eq('admin_id', adminId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });
    
    if (error) {
        handleError(error, 'getAdminChecklist');
        return [];
    }
    return data || [];
};

export const addAdminChecklistItem = async (adminId: number, title: string, isForToday: boolean, position: number, badge?: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').insert({
        admin_id: adminId,
        title,
        is_for_today: isForToday,
        position,
        badge // Added badge support
    });
    if (error) handleError(error, 'addAdminChecklistItem');
};

export const updateAdminChecklistItem = async (itemId: number, updates: Partial<AdminChecklistItem>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').update(updates).eq('id', itemId);
    if (error) handleError(error, 'updateAdminChecklistItem');
};

export const deleteAdminChecklistItem = async (itemId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').delete().eq('id', itemId);
    if (error) handleError(error, 'deleteAdminChecklistItem');
};

export const updateAdminChecklistOrder = async (updates: { id: number, position: number }[]): Promise<void> => {
    if (!supabase) return;
    
    // Supabase JS client doesn't support bulk update with different values easily in one call
    // We'll use a loop or upsert if schema allows. Loop is simpler for now given few items.
    const promises = updates.map(update => 
        supabase.from('admin_checklist').update({ position: update.position }).eq('id', update.id)
    );
    
    await Promise.all(promises);
};

export const getAdminUserIds = async (): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data, error } = await supabase
        .from('users')
        .select('user_id, access_code')
        .in('access_code', ['M77m', 'Nil1', 'Tm3']);
    
    if (error) {
        handleError(error, 'getAdminUserIds');
        return {};
    }
    
    const mapping: Record<string, number> = {};
    data?.forEach(user => {
        if(user.access_code === 'M77m') mapping['M'] = user.user_id;
        if(user.access_code === 'Nil1') mapping['N'] = user.user_id;
        if(user.access_code === 'Tm3') mapping['T'] = user.user_id;
    });
    return mapping;
}


// --- Ideas ---
export const getIdeasForUser = async (userId: number): Promise<PostIdea[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('ideas').select('*').eq('user_id', userId);
    if (error) handleError(error, 'getIdeasForUser');
    return data || [];
};
export const addIdeaForUser = async (userId: number, ideaText: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('ideas').insert({ user_id: userId, idea_text: ideaText });
    if (error) handleError(error, 'addIdeaForUser:insert');
    else await logActivity(userId, 'یک ایده پست جدید ارسال کرد.');
};
export const deleteIdea = async (ideaId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('ideas').delete().eq('id', ideaId);
    if (error) handleError(error, 'deleteIdea');
};

// --- Captions ---
export const getCaptionsForUser = async (userId: number): Promise<Caption[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('captions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) handleError(error, 'getCaptionsForUser');
    return data || [];
};
export const addCaption = async (userId: number, title: string, content: string, originalScenarioContent: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('captions').insert({ user_id: userId, title, content, original_scenario_content: originalScenarioContent });
    if (error) handleError(error, 'addCaption');
};

// --- Activity Log ---
export const logActivity = async (userId: number, action: string): Promise<void> => {
    if (!supabase) return;
    // Removed isUserAdmin check to allow editors/admins to log activities if needed
    const user = await getUserById(userId);
    if (user) {
        const logEntry = {
            user_id: userId,
            user_full_name: user.full_name,
            action: action,
        };
        const { error } = await supabase.from('activity_logs').insert(logEntry);
        if (error) handleError(error, 'logActivity');
    }
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) handleError(error, 'getActivityLogs');
    return data || [];
};

export const getEditorActivityLogs = async (): Promise<ActivityLog[]> => {
    if (!supabase) return [];
    // Join with users table to filter by role = 'editor'
    const { data, error } = await supabase
        .from('activity_logs')
        .select(`
            *,
            user:users!inner(role)
        `)
        .eq('user.role', 'editor')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        handleError(error, 'getEditorActivityLogs');
        return [];
    }
    return data || [];
};

// --- History (JSONB columns) ---
export const getChatHistory = async (userId: number): Promise<ChatMessage[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('chat_history').select('messages').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getChatHistory');
    return data?.messages || [];
};
export const saveChatHistory = async (userId: number, messages: ChatMessage[]): Promise<void> => {
    if (!supabase) return;
    const trimmedMessages = messages.length > 50 ? messages.slice(messages.length - 50) : messages;
    const cleanMessages = trimmedMessages.map(({imageUrl, isInterim, ...rest}) => rest);
    const { error } = await supabase.from('chat_history').upsert({ user_id: userId, messages: cleanMessages }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveChatHistory');
};

export const deleteChatHistory = async (userId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('chat_history').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteChatHistory');
}

export const getStoryHistory = async (userId: number): Promise<{ id: number; content: string }[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('story_history').select('stories').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getStoryHistory');
    return data?.stories || [];
};
export const saveStoryHistory = async (userId: number, storyContent: string): Promise<void> => {
    if (!supabase) return;
    const currentHistory = await getStoryHistory(userId);
    const newStory = { id: Date.now(), content: storyContent };
    currentHistory.unshift(newStory);
    if (currentHistory.length > 20) currentHistory.pop();
    const { error } = await supabase.from('story_history').upsert({ user_id: userId, stories: currentHistory }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveStoryHistory');
};

// --- Algorithm News ---
export const getLatestAlgorithmNews = async (): Promise<AlgorithmNews | null> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') {
        handleError(error, 'getLatestAlgorithmNews');
        throw new Error(`خطای پایگاه داده: ${error.message}`);
    }
    return data;
};

export const getAlgorithmNewsHistory = async (limit: number = 20): Promise<AlgorithmNews[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(limit);
     if (error) {
        handleError(error, 'getAlgorithmNewsHistory');
        throw new Error(`خطای پایگاه داده: ${error.message}`);
    }
    return data || [];
}

export const addAlgorithmNews = async (content: string): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('algorithm_news').insert({ content });
    if (error) {
        handleError(error, 'addAlgorithmNews');
        throw new Error(`خطای پایگاه داده: ${error.message}`);
    }
};

// --- Competitor Analysis History ---
export const getCompetitorAnalysisHistory = async (userId: number): Promise<CompetitorAnalysisHistory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('competitor_analysis_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    if (error) {
        handleError(error, 'getCompetitorAnalysisHistory');
        throw error;
    }
    return data || [];
}

export const saveCompetitorAnalysisHistory = async (userId: number, analysis: Omit<CompetitorAnalysisHistory, 'id' | 'user_id' | 'created_at'>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('competitor_analysis_history').insert({ user_id: userId, ...analysis });
    if (error) {
        handleError(error, 'saveCompetitorAnalysisHistory');
        throw error;
    }
}


// --- Notifications for Badges ---
export const getNotificationCounts = async (userId: number): Promise<{ scenarios: number, plans: number, reports: number }> => {
    if (!supabase) return { scenarios: 0, plans: 0, reports: 0 };
    
    const { data: scenariosData, error: sError } = await supabase.from('scenarios').select('id').eq('user_id', userId);
    if (sError) handleError(sError, 'getNotificationCounts:scenarios');
    const lastScenarioView = localStorage.getItem(`lastView_scenarios_${userId}`);
    const newScenariosCount = scenariosData?.filter(scenario => !lastScenarioView || scenario.id > Number(lastScenarioView)).length || 0;

    const plansList = await getPlansForUser(userId);
    const lastPlanView = localStorage.getItem(`lastView_plans_${userId}`);
    const newPlansCount = plansList.filter(plan => !lastPlanView || new Date(plan.timestamp).getTime() > Number(lastPlanView)).length;

    const reportsList = await getReportsForUser(userId);
    const lastReportView = localStorage.getItem(`lastView_reports_${userId}`);
    const newReportsCount = reportsList.filter(report => !lastReportView || new Date(report.timestamp).getTime() > Number(lastReportView)).length;

    return { scenarios: newScenariosCount, plans: newPlansCount, reports: newReportsCount };
};

export const getAdminNotificationCounts = async (): Promise<{ ideas: number, logs: number, tasks: number }> => {
    if (!supabase) return { ideas: 0, logs: 0, tasks: 0 };
    const { count: ideasCount, error: iError } = await supabase.from('ideas').select('id', { count: 'exact' });
    if (iError) handleError(iError, 'getAdminNotificationCounts:ideas');

    const lastLogView = localStorage.getItem(`lastView_admin_logs`);
    const lastLogTime = lastLogView ? new Date(Number(lastLogView)).toISOString() : new Date(0).toISOString();
    
    const { count: logsCount, error: lError } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gt('created_at', lastLogTime);
    if (lError) handleError(lError, 'getAdminNotificationCounts:logs');

    const { count: tasksCount, error: tError } = await supabase.from('editor_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending_assignment');
    if (tError) handleError(tError, 'getAdminNotificationCounts:tasks');

    return { ideas: ideasCount || 0, logs: logsCount || 0, tasks: tasksCount || 0 };
};

export const clearUserNotifications = (section: 'scenarios' | 'plans' | 'reports', userId: number): void => {
    localStorage.setItem(`lastView_${section}_${userId}`, String(Date.now()));
};

export const clearAdminNotifications = (section: 'ideas' | 'logs'): void => {
     if (section === 'ideas') {
     } else {
        localStorage.setItem(`lastView_admin_${section}`, String(Date.now()));
     }
};
