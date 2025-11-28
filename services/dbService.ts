import { supabase } from './supabaseClient';
import { 
    User, PostScenario, EditorTask, Plan, Report, 
    Caption, ChatMessage, PostIdea, ActivityLog, 
    SubscriptionHistory, CompetitorAnalysisHistory, 
    AlgorithmNews, ProductionEvent, AdminChecklistItem 
} from '../types';

// Helper for error handling
const handleError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    throw new Error(error.message || 'An unexpected error occurred');
};

// --- Auth & User Management ---

export const verifyAccessCode = async (code: string, isAutoLogin = false): Promise<User | null> => {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('access_code', code)
        .single();
    
    if (error) {
        if (isAutoLogin) return null; // Don't throw on auto-login check
        handleError(error, 'verifyAccessCode');
    }
    return data;
};

export const getUserById = async (userId: number): Promise<User | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (error) handleError(error, 'getUserById');
    return data;
};

export const getAllUsers = async (): Promise<User[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'admin') // Assuming admins are separated or role based
        .order('user_id', { ascending: false });
    if (error) handleError(error, 'getAllUsers');
    return data || [];
};

export const getAllAdmins = async (): Promise<User[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin');
    if (error) handleError(error, 'getAllAdmins');
    return data || [];
};

export const getAllEditors = async (): Promise<User[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'editor');
    if (error) handleError(error, 'getAllEditors');
    return data || [];
};

export const addUser = async (name: string, code: string, isVip: boolean): Promise<{success: boolean, message: string}> => {
    if (!supabase) return { success: false, message: "DB Error" };
    // Check if code exists
    const existing = await verifyAccessCode(code, true);
    if (existing) return { success: false, message: "کد دسترسی تکراری است." };

    const { error } = await supabase.from('users').insert({
        full_name: name,
        access_code: code,
        role: 'user',
        is_verified: true, // Assuming default
        is_vip: isVip,
        story_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString()
    });

    if (error) return { success: false, message: error.message };
    return { success: true, message: "کاربر با موفقیت اضافه شد." };
};

export const addAdmin = async (name: string, code: string): Promise<{success: boolean, message: string}> => {
    if (!supabase) return { success: false, message: "DB Error" };
    const { error } = await supabase.from('users').insert({
        full_name: name,
        access_code: code,
        role: 'admin',
        is_verified: true,
        story_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString()
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "مدیر اضافه شد." };
};

export const addEditor = async (name: string, code: string): Promise<{success: boolean, message: string}> => {
    if (!supabase) return { success: false, message: "DB Error" };
    const { error } = await supabase.from('users').insert({
        full_name: name,
        access_code: code,
        role: 'editor',
        is_verified: true,
        story_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString()
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "تدوینگر اضافه شد." };
};

export const deleteUser = async (userId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('users').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteUser');
};

export const updateUserInfo = async (userId: number, info: Partial<User>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('users').update(info).eq('user_id', userId);
    if (error) handleError(error, 'updateUserInfo');
};

export const updateUserUsageLimits = async (userId: number, limits: any): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) handleError(error, 'updateUserUsageLimits');
};

export const updateUserTotalLimits = async (userId: number, limits: any): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) handleError(error, 'updateUserTotalLimits');
};

export const updateUserVipStatus = async (userId: number, isVip: boolean): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('users').update({ is_vip: isVip }).eq('user_id', userId);
    if (error) handleError(error, 'updateUserVipStatus');
};

export const incrementUsage = async (userId: number, type: string): Promise<void> => {
    if (!supabase) return;
    
    // Mapping type to column
    const columnMap: Record<string, string> = {
        'story': 'story_requests',
        'caption_idea': 'caption_idea_requests',
        'chat': 'chat_messages',
        'competitor_analysis': 'caption_idea_requests' 
    };
    
    const user = await getUserById(userId);
    if (!user) return;

    const col = columnMap[type] || type;
    const current = (user as any)[col] || 0;
    
    await supabase.from('users').update({ [col]: current + 1 }).eq('user_id', userId);
};

export const logActivity = async (userId: number, action: string): Promise<void> => {
    if (!supabase) return;
    const user = await getUserById(userId);
    if (!user) return;
    
    const { error } = await supabase.from('activity_logs').insert({
        user_id: userId,
        user_full_name: user.full_name,
        action,
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Failed to log activity", error);
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) handleError(error, 'getActivityLogs');
    return data || [];
};

// --- Features ---

export const getStoryHistory = async (userId: number): Promise<{id: number, content: string}[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('story_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
    if (error) handleError(error, 'getStoryHistory');
    return data?.map((d: any) => ({ id: d.id, content: d.content })) || [];
};

export const saveStoryHistory = async (userId: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('story_history').insert({ user_id: userId, content });
    if (error) handleError(error, 'saveStoryHistory');
};

export const getScenariosForUser = async (userId: number): Promise<PostScenario[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('post_scenarios').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getScenariosForUser');
    return data || [];
};

export const getScenarioById = async (id: number): Promise<PostScenario | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('post_scenarios').select('*').eq('id', id).single();
    if (error) handleError(error, 'getScenarioById');
    return data;
};

export const addScenarioForUser = async (userId: number, number: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('post_scenarios').insert({ user_id: userId, scenario_number: number, content });
    if (error) handleError(error, 'addScenarioForUser');
};

export const deleteScenario = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('post_scenarios').delete().eq('id', id);
    if (error) handleError(error, 'deleteScenario');
};

export const getCaptionsForUser = async (userId: number): Promise<Caption[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('captions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getCaptionsForUser');
    return data || [];
};

export const addCaption = async (userId: number, title: string, content: string, originalScenario: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('captions').insert({ 
        user_id: userId, 
        title, 
        content, 
        original_scenario_content: originalScenario 
    });
    if (error) handleError(error, 'addCaption');
};

export const getChatHistory = async (userId: number): Promise<ChatMessage[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('chat_history').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getChatHistory'); // PGRST116 is no rows
    return data?.messages || [];
};

export const saveChatHistory = async (userId: number, messages: ChatMessage[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('chat_history').upsert({ user_id: userId, messages });
    if (error) handleError(error, 'saveChatHistory');
};

export const deleteChatHistory = async (userId: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('chat_history').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteChatHistory');
};

export const getIdeasForUser = async (userId: number): Promise<PostIdea[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('post_ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getIdeasForUser');
    return data || [];
};

export const addIdeaForUser = async (userId: number, idea: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('post_ideas').insert({ user_id: userId, idea_text: idea });
    if (error) handleError(error, 'addIdeaForUser');
};

export const deleteIdea = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('post_ideas').delete().eq('id', id);
    if (error) handleError(error, 'deleteIdea');
};

export const getPlansForUser = async (userId: number): Promise<Plan[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('plans').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) handleError(error, 'getPlansForUser');
    return data || [];
};

export const savePlanForUser = async (userId: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('plans').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) handleError(error, 'savePlanForUser');
};

export const deletePlanById = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (error) handleError(error, 'deletePlanById');
};

export const getReportsForUser = async (userId: number): Promise<Report[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('reports').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) handleError(error, 'getReportsForUser');
    return data || [];
};

export const saveReportForUser = async (userId: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('reports').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) handleError(error, 'saveReportForUser');
};

export const updateReportById = async (id: number, content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('reports').update({ content }).eq('id', id);
    if (error) handleError(error, 'updateReportById');
};

export const deleteReportById = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) handleError(error, 'deleteReportById');
};

export const getSubscriptionHistory = async (userId: number): Promise<SubscriptionHistory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('subscription_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getSubscriptionHistory');
    return data || [];
};

export const extendSubscription = async (userId: number, days: number): Promise<{success: boolean, message: string}> => {
    if (!supabase) return { success: false, message: "DB Error" };
    // Fetch current
    const user = await getUserById(userId);
    if (!user) return { success: false, message: "User not found" };

    const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
    // If expired, start from now
    const startDate = currentExpiry < new Date() ? new Date() : currentExpiry;
    startDate.setDate(startDate.getDate() + days);
    const newExpiry = startDate.toISOString();

    const { error } = await supabase.from('users').update({ 
        subscription_expires_at: newExpiry,
        is_subscription_expired: false 
    }).eq('user_id', userId);
    
    if (error) return { success: false, message: error.message };
    
    // Log history
    await supabase.from('subscription_history').insert({
        user_id: userId,
        extended_for_days: days,
        new_expiry_date: newExpiry
    });

    return { success: true, message: `اشتراک با موفقیت ${days} روز تمدید شد.` };
};

export const getCompetitorAnalysisHistory = async (userId: number): Promise<CompetitorAnalysisHistory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('competitor_analysis').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getCompetitorAnalysisHistory');
    return data || [];
};

export const saveCompetitorAnalysisHistory = async (userId: number, data: any): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('competitor_analysis').insert({ user_id: userId, ...data });
    if (error) handleError(error, 'saveCompetitorAnalysisHistory');
};

export const getLatestAlgorithmNews = async (): Promise<AlgorithmNews | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getLatestAlgorithmNews');
    return data;
};

export const getAlgorithmNewsHistory = async (limit: number): Promise<AlgorithmNews[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) handleError(error, 'getAlgorithmNewsHistory');
    return data || [];
};

export const addAlgorithmNews = async (content: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('algorithm_news').insert({ content });
    if (error) handleError(error, 'addAlgorithmNews');
};

export const getNotificationCounts = async (userId: number): Promise<any> => {
    // Mock implementation or real query if tables exist
    return { scenarios: 0, plans: 0, reports: 0 };
};

export const clearUserNotifications = async (type: string, userId: number): Promise<void> => {
    if (!supabase) return;
};

export const getAdminNotificationCounts = async (): Promise<any> => {
    if (!supabase) return { ideas: 0, logs: 0, tasks: 0 };
    const { count: ideas } = await supabase.from('post_ideas').select('*', { count: 'exact', head: true });
    const { count: tasks } = await supabase.from('editor_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending_assignment');
    return { ideas: ideas || 0, logs: 0, tasks: tasks || 0 };
};

export const clearAdminNotifications = async (type: string): Promise<void> => {
    // No-op
};


// --- Editor Tasks ---

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

export const createManualEditorTask = async (projectName: string, scenarioContent: string, scenarioNumber: number, fileUrl?: string): Promise<void> => {
    if (!supabase) return;
    
    let content = scenarioContent;
    if(fileUrl) {
        content += `\n\n[فایل پیوست: ${fileUrl}]`;
    }

    const { error } = await supabase.from('editor_tasks').insert({
        client_user_id: null,
        manual_project_name: projectName,
        scenario_content: content,
        scenario_number: scenarioNumber,
        status: 'pending_assignment',
    });
    if (error) handleError(error, 'createManualEditorTask');
};

export const getEditorTasks = async (userId?: number): Promise<EditorTask[]> => {
    if (!supabase) return [];
    let query = supabase
        .from('editor_tasks')
        .select(`
            *,
            client_name:client_user_id(full_name),
            editor_name:assigned_editor_id(full_name)
        `)
        .order('created_at', { ascending: false });

    if (userId) {
        query = query.eq('assigned_editor_id', userId);
    }

    const { data, error } = await query;
    if (error) {
        handleError(error, 'getEditorTasks');
        return [];
    }
    
    return data.map((task: any) => ({
        ...task,
        client_name: task.client_name?.full_name || task.manual_project_name || 'کاربر/پروژه ناشناس',
        editor_name: task.editor_name?.full_name || 'تعیین نشده'
    }));
};

export const updateEditorTaskStatus = async (id: number, status: string, note?: string): Promise<void> => {
    if (!supabase) return;
    const updates: any = { status };
    if (note) {
        if (status === 'issue_reported') updates.editor_note = note;
        else updates.admin_note = note;
    }
    const { error } = await supabase.from('editor_tasks').update(updates).eq('id', id);
    if (error) handleError(error, 'updateEditorTaskStatus');
};

export const assignEditorTask = async (taskId: number, editorId: number, note?: string): Promise<void> => {
    if (!supabase) return;
    const updates: any = { assigned_editor_id: editorId, status: 'assigned' };
    if (note) updates.admin_note = note;
    const { error } = await supabase.from('editor_tasks').update(updates).eq('id', taskId);
    if (error) handleError(error, 'assignEditorTask');
};

export const uploadFile = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);

    if (uploadError) {
        console.error(uploadError);
        return null;
    }

    const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return data.publicUrl;
};

// --- Production Calendar ---

export const getProductionEvents = async (): Promise<ProductionEvent[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('production_events').select('*');
    if (error) handleError(error, 'getProductionEvents');
    return data || [];
};

export const getProductionEventsForUser = async (userName: string): Promise<ProductionEvent[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('production_events').select('*').eq('project_name', userName);
    if (error) handleError(error, 'getProductionEventsForUser');
    return data || [];
};

export const addProductionEvent = async (event: Partial<ProductionEvent>): Promise<void> => {
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
    
    if (error) handleError(error, 'getAdminChecklist');
    return data || [];
};

export const getDelegatedChecklistItems = async (creatorId: number): Promise<AdminChecklistItem[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('admin_checklist')
        .select('*')
        .eq('creator_id', creatorId)
        .neq('admin_id', creatorId)
        .order('created_at', { ascending: false });
    
    if (error) handleError(error, 'getDelegatedChecklistItems');
    return data || [];
};

export const addAdminChecklistItem = async (adminId: number, title: string, isForToday: boolean, position: number, badge?: string, creatorId?: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').insert({
        admin_id: adminId,
        creator_id: creatorId,
        title,
        is_for_today: isForToday,
        position,
        badge 
    });
    if (error) handleError(error, 'addAdminChecklistItem');
};

export const updateAdminChecklistItem = async (id: number, updates: any): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').update(updates).eq('id', id);
    if (error) handleError(error, 'updateAdminChecklistItem');
};

export const deleteAdminChecklistItem = async (id: number): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('admin_checklist').delete().eq('id', id);
    if (error) handleError(error, 'deleteAdminChecklistItem');
};

export const updateAdminChecklistOrder = async (updates: {id: number, position: number}[]): Promise<void> => {
    if (!supabase) return;
    for (const update of updates) {
        await supabase.from('admin_checklist').update({ position: update.position }).eq('id', update.id);
    }
};

export const getAdminUserIds = async (): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const admins = await getAllAdmins();
    const mapping: Record<string, number> = {};
    admins.forEach(a => {
        const firstLetter = a.full_name.charAt(0).toUpperCase();
        if (['M', 'N', 'T'].includes(firstLetter)) {
            mapping[firstLetter] = a.user_id;
        }
    });
    return mapping;
};