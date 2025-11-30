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
    const client = supabase;
    if (!client) throw new Error("Supabase client not initialized");
    
    // Explicitly block legacy 'Item8' code
    if (code === 'Item8') {
        throw new Error("این کد دسترسی دیگر معتبر نیست.");
    }

    const { data, error } = await client
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
    const client = supabase;
    if (!client) return null;
    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (error) handleError(error, 'getUserById');
    return data;
};

export const getAllUsers = async (): Promise<User[]> => {
    const client = supabase;
    if (!client) return [];
    // Strict filter: Only fetch 'user' role. This ensures admins and editors never appear in the user list.
    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('role', 'user') 
        .order('user_id', { ascending: false });
    if (error) handleError(error, 'getAllUsers');
    return data || [];
};

export const getAllAdmins = async (): Promise<User[]> => {
    const client = supabase;
    if (!client) return [];
    // Get admins (managers excluded usually, or included if you want to show manager in list)
    // Here we show 'admin' role. Manager is usually handled separately or is one specific user.
    const { data, error } = await client
        .from('users')
        .select('*')
        .in('role', ['admin', 'manager']);
    if (error) handleError(error, 'getAllAdmins');
    return data || [];
};

export const getAllEditors = async (): Promise<User[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('role', 'editor');
    if (error) handleError(error, 'getAllEditors');
    return data || [];
};

export const addUser = async (name: string, code: string, isVip: boolean): Promise<{success: boolean, message: string}> => {
    const client = supabase;
    if (!client) return { success: false, message: "DB Error" };
    // Check if code exists
    const existing = await verifyAccessCode(code, true);
    if (existing) return { success: false, message: "کد دسترسی تکراری است." };

    const { error } = await client.from('users').insert({
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
    const client = supabase;
    if (!client) return { success: false, message: "DB Error" };
    const { error } = await client.from('users').insert({
        full_name: name,
        access_code: code,
        role: 'admin',
        is_verified: true,
        story_requests: 0,
        chat_messages: 0,
        permissions: [], // Default no permissions
        last_request_date: new Date().toISOString()
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "مدیر اضافه شد." };
};

export const addEditor = async (name: string, code: string): Promise<{success: boolean, message: string}> => {
    const client = supabase;
    if (!client) return { success: false, message: "DB Error" };
    const { error } = await client.from('users').insert({
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
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('users').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteUser');
};

export const updateUserInfo = async (userId: number, info: Partial<User>): Promise<void> => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('users').update(info).eq('user_id', userId);
    if (error) handleError(error, 'updateUserInfo');
};

export const updateUserPermissions = async (userId: number, permissions: string[]): Promise<void> => {
    const client = supabase;
    if (!client) return;
    // Store as jsonb
    const { error } = await client.from('users').update({ permissions }).eq('user_id', userId);
    if (error) handleError(error, 'updateUserPermissions');
}

export const updateUserUsageLimits = async (userId: number, limits: any): Promise<void> => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('users').update(limits).eq('user_id', userId);
    if (error) handleError(error, 'updateUserUsageLimits');
};

export const updateUserTotalLimits = async (userId: number, limits: any): Promise<void> => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('users').update(limits).eq('user_id', userId);
    if (error) handleError(error, 'updateUserTotalLimits');
};

export const updateUserVipStatus = async (userId: number, isVip: boolean): Promise<void> => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('users').update({ is_vip: isVip }).eq('user_id', userId);
    if (error) handleError(error, 'updateUserVipStatus');
};

export const incrementUsage = async (userId: number, type: string): Promise<void> => {
    const client = supabase;
    if (!client) return;
    
    // Mapping type to column
    const columnMap: Record<string, string> = {
        'story': 'story_requests',
        'caption_idea': 'caption_idea_requests',
        'chat': 'chat_messages',
        'competitor_analysis': 'caption_idea_requests', // Sharing limit for now
        'image_generation': 'image_generation_requests'
    };
    
    const user = await getUserById(userId);
    if (!user) return;

    const col = columnMap[type] || type;
    const current = (user as any)[col] || 0;
    
    await client.from('users').update({ [col]: current + 1 }).eq('user_id', userId);
};

export const logActivity = async (userId: number, action: string): Promise<void> => {
    const client = supabase;
    if (!client) return;
    const user = await getUserById(userId);
    if (!user) return;
    
    const { error } = await client.from('activity_logs').insert({
        user_id: userId,
        user_full_name: user.full_name,
        action,
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Failed to log activity", error);
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) handleError(error, 'getActivityLogs');
    return data || [];
};

// --- Notifications & Counts ---

export const getAdminNotificationCounts = async () => {
    const client = supabase;
    if (!client) return { ideas: 0, logs: 0, tasks: 0 };
    
    // Count exact rows
    const { count: ideasCount } = await client.from('post_ideas').select('*', { count: 'exact', head: true });
    const { count: logsCount } = await client.from('activity_logs').select('*', { count: 'exact', head: true });
    const { count: tasksCount } = await client.from('editor_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending_assignment');
    
    return { 
        ideas: ideasCount || 0, 
        logs: logsCount || 0, 
        tasks: tasksCount || 0 
    };
};

export const getNotificationCounts = async (userId: number) => {
    const client = supabase;
    if (!client) return { scenarios: 0, plans: 0, reports: 0 };
    
    const { count: scenarios } = await client.from('post_scenarios').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    const { count: plans } = await client.from('plans').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    const { count: reports } = await client.from('reports').select('*', { count: 'exact', head: true }).eq('user_id', userId);

    return { 
        scenarios: scenarios || 0, 
        plans: plans || 0, 
        reports: reports || 0 
    };
};

export const clearUserNotifications = async (type: string, userId: number) => {
    // Placeholder for clearing notifications logic
};

export const clearAdminNotifications = async (type: string) => {
    // Placeholder for clearing notifications logic
};

// --- Story History ---

export const getStoryHistory = async (userId: number): Promise<{ id: number; content: string }[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
        .from('story_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        // Suppress error if table doesn't exist yet to avoid app crash
        console.warn("getStoryHistory warning:", error.message);
        return [];
    }
    
    return data.map((item: any) => ({
        id: new Date(item.created_at).getTime(), 
        content: item.content
    }));
};

export const saveStoryHistory = async (userId: number, content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('story_history').insert({
        user_id: userId,
        content: content
    });
    if (error) handleError(error, 'saveStoryHistory');
};

// --- Post Scenarios ---

export const getScenariosForUser = async (userId: number): Promise<PostScenario[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
        .from('post_scenarios')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) handleError(error, 'getScenariosForUser');
    
    return data?.map((item: any) => ({
        ...item,
        id: item.id,
        timestamp: item.created_at
    })) || [];
};

export const getScenarioById = async (id: number): Promise<PostScenario | null> => {
    const client = supabase;
    if (!client) return null;
    const { data, error } = await client.from('post_scenarios').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

export const addScenarioForUser = async (userId: number, number: number, content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('post_scenarios').insert({
        user_id: userId,
        scenario_number: number,
        content: content
    });
    if (error) handleError(error, 'addScenarioForUser');
};

export const deleteScenario = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('post_scenarios').delete().eq('id', id);
    if (error) handleError(error, 'deleteScenario');
};

// --- Captions ---

export const getCaptionsForUser = async (userId: number): Promise<Caption[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
        .from('captions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) handleError(error, 'getCaptionsForUser');
    return data || [];
};

export const addCaption = async (userId: number, title: string, content: string, originalContent: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('captions').insert({
        user_id: userId,
        title,
        content,
        original_scenario_content: originalContent
    });
    if (error) handleError(error, 'addCaption');
};

// --- Chat History ---

export const getChatHistory = async (userId: number): Promise<ChatMessage[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client
        .from('chat_history')
        .select('messages')
        .eq('user_id', userId)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.warn("getChatHistory error", error);
    }
    
    return (data?.messages as ChatMessage[]) || [];
};

export const saveChatHistory = async (userId: number, messages: ChatMessage[]) => {
    const client = supabase;
    if (!client) return;
    
    const { data } = await client.from('chat_history').select('user_id').eq('user_id', userId).single();
    
    let error;
    if (data) {
        const { error: err } = await client.from('chat_history').update({ messages }).eq('user_id', userId);
        error = err;
    } else {
        const { error: err } = await client.from('chat_history').insert({ user_id: userId, messages });
        error = err;
    }
    
    if (error) handleError(error, 'saveChatHistory');
};

export const deleteChatHistory = async (userId: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('chat_history').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteChatHistory');
};

// --- Ideas ---

export const getIdeasForUser = async (userId: number): Promise<PostIdea[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('post_ideas').select('*').eq('user_id', userId);
    if (error) handleError(error, 'getIdeasForUser');
    return data || [];
};

export const addIdeaForUser = async (userId: number, ideaText: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('post_ideas').insert({ user_id: userId, idea_text: ideaText });
    if (error) handleError(error, 'addIdeaForUser');
};

export const deleteIdea = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('post_ideas').delete().eq('id', id);
    if (error) handleError(error, 'deleteIdea');
};

// --- Plans ---

export const getPlansForUser = async (userId: number): Promise<Plan[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('plans').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getPlansForUser');
    return data?.map((p: any) => ({ ...p, timestamp: p.created_at })) || [];
};

export const savePlanForUser = async (userId: number, content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('plans').insert({ user_id: userId, content });
    if (error) handleError(error, 'savePlanForUser');
};

export const deletePlanById = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('plans').delete().eq('id', id);
    if (error) handleError(error, 'deletePlanById');
};

// --- Reports ---

export const getReportsForUser = async (userId: number): Promise<Report[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getReportsForUser');
    return data?.map((r: any) => ({ ...r, timestamp: r.created_at })) || [];
};

export const saveReportForUser = async (userId: number, content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('reports').insert({ user_id: userId, content });
    if (error) handleError(error, 'saveReportForUser');
};

export const updateReportById = async (id: number, content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('reports').update({ content }).eq('id', id);
    if (error) handleError(error, 'updateReportById');
};

export const deleteReportById = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('reports').delete().eq('id', id);
    if (error) handleError(error, 'deleteReportById');
};

// --- Subscription ---

export const getSubscriptionHistory = async (userId: number): Promise<SubscriptionHistory[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('subscription_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getSubscriptionHistory');
    return data || [];
};

export const extendSubscription = async (userId: number, days: number) => {
    const client = supabase;
    if (!client) return { success: false, message: "DB Error" };
    
    const user = await getUserById(userId);
    if (!user) return { success: false, message: "User not found" };

    const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    
    const newExpiry = baseDate.toISOString();

    const { error: updateError } = await client.from('users').update({ subscription_expires_at: newExpiry }).eq('user_id', userId);
    if (updateError) return { success: false, message: updateError.message };

    await client.from('subscription_history').insert({
        user_id: userId,
        extended_for_days: days,
        new_expiry_date: newExpiry
    });

    return { success: true, message: "اشتراک تمدید شد." };
};

// --- Editor Tasks ---

export const getEditorTasks = async (userId?: number): Promise<EditorTask[]> => {
    const client = supabase;
    if (!client) return [];
    let query = client.from('editor_tasks').select('*').order('created_at', { ascending: false });
    
    if (userId) {
        query = query.eq('assigned_editor_id', userId);
    }
    
    const { data, error } = await query;
    if (error) handleError(error, 'getEditorTasks');
    return data || [];
};

export const createEditorTask = async (userId: number, content: string, scenarioNumber: number) => {
    const client = supabase;
    if (!client) return;
    const user = await getUserById(userId);
    const { error } = await client.from('editor_tasks').insert({
        client_user_id: userId,
        client_name: user?.full_name,
        scenario_content: content,
        scenario_number: scenarioNumber,
        status: 'pending_assignment'
    });
    if (error) handleError(error, 'createEditorTask');
};

export const createManualEditorTask = async (projectName: string, content: string, scenarioNumber: number, fileUrl?: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('editor_tasks').insert({
        manual_project_name: projectName,
        client_name: projectName,
        scenario_content: content + (fileUrl ? `\n\n[File]: ${fileUrl}` : ''),
        scenario_number: scenarioNumber,
        status: 'pending_assignment'
    });
    if (error) handleError(error, 'createManualEditorTask');
};

export const assignEditorTask = async (taskId: number, editorId: number, note: string) => {
    const client = supabase;
    if (!client) return;
    const editor = await getUserById(editorId);
    const { error } = await client.from('editor_tasks').update({
        assigned_editor_id: editorId,
        editor_name: editor?.full_name,
        status: 'assigned',
        admin_note: note
    }).eq('id', taskId);
    if (error) handleError(error, 'assignEditorTask');
};

export const updateEditorTaskStatus = async (taskId: number, status: string, note?: string) => {
    const client = supabase;
    if (!client) return;
    const updateData: any = { status };
    if (note) updateData.editor_note = note;
    
    const { error } = await client.from('editor_tasks').update(updateData).eq('id', taskId);
    if (error) handleError(error, 'updateEditorTaskStatus');
};

// --- Production Events ---

export const getProductionEvents = async (): Promise<ProductionEvent[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('production_events').select('*');
    if (error) handleError(error, 'getProductionEvents');
    return data || [];
};

export const getProductionEventsForUser = async (userFullName: string): Promise<ProductionEvent[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('production_events').select('*').eq('project_name', userFullName);
    if (error) handleError(error, 'getProductionEventsForUser');
    return data || [];
};

export const addProductionEvent = async (event: Partial<ProductionEvent>) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('production_events').insert(event);
    if (error) handleError(error, 'addProductionEvent');
};

export const updateProductionEvent = async (id: number, event: Partial<ProductionEvent>) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('production_events').update(event).eq('id', id);
    if (error) handleError(error, 'updateProductionEvent');
};

export const deleteProductionEvent = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('production_events').delete().eq('id', id);
    if (error) handleError(error, 'deleteProductionEvent');
};

// --- Checklist ---

export const getAdminChecklist = async (userId: number): Promise<AdminChecklistItem[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('admin_checklist').select('*').eq('admin_id', userId).order('position', { ascending: true });
    if (error) handleError(error, 'getAdminChecklist');
    return data || [];
};

export const getDelegatedChecklistItems = async (userId: number): Promise<AdminChecklistItem[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('admin_checklist').select('*')
        .or(`creator_id.eq.${userId},admin_id.eq.${userId}`);
    if (error) handleError(error, 'getDelegatedChecklistItems');
    return data || [];
};

export const getAdminUserIds = async (): Promise<Record<string, number>> => {
    const client = supabase;
    if (!client) return {};
    const { data } = await client.from('users').select('user_id, full_name, role').in('role', ['admin', 'manager']);
    
    const ids: Record<string, number> = {};
    if (data) {
        data.forEach(u => {
            const initial = u.full_name.charAt(0).toUpperCase();
            if (!ids[initial]) ids[initial] = u.user_id;
        });
    }
    return ids;
};

export const addAdminChecklistItem = async (adminId: number, title: string, isForToday: boolean, position: number, badge: string, creatorId: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('admin_checklist').insert({
        admin_id: adminId,
        title,
        is_for_today: isForToday,
        position,
        badge,
        creator_id: creatorId,
        is_done: false
    });
    if (error) handleError(error, 'addAdminChecklistItem');
};

export const updateAdminChecklistItem = async (id: number, updates: Partial<AdminChecklistItem>) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('admin_checklist').update(updates).eq('id', id);
    if (error) handleError(error, 'updateAdminChecklistItem');
};

export const deleteAdminChecklistItem = async (id: number) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('admin_checklist').delete().eq('id', id);
    if (error) handleError(error, 'deleteAdminChecklistItem');
};

export const updateAdminChecklistOrder = async (items: { id: number, position: number }[]) => {
    const client = supabase;
    if (!client) return;
    for (const item of items) {
        await client.from('admin_checklist').update({ position: item.position }).eq('id', item.id);
    }
};

// --- Algorithm News ---

export const getLatestAlgorithmNews = async (): Promise<AlgorithmNews | null> => {
    const client = supabase;
    if (!client) return null;
    const { data, error } = await client.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (error) return null;
    return data;
};

export const getAlgorithmNewsHistory = async (limit: number): Promise<AlgorithmNews[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('algorithm_news').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) handleError(error, 'getAlgorithmNewsHistory');
    return data || [];
};

export const addAlgorithmNews = async (content: string) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('algorithm_news').insert({ content });
    if (error) handleError(error, 'addAlgorithmNews');
};

// --- Competitor Analysis ---

export const getCompetitorAnalysisHistory = async (userId: number): Promise<CompetitorAnalysisHistory[]> => {
    const client = supabase;
    if (!client) return [];
    const { data, error } = await client.from('competitor_analysis').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getCompetitorAnalysisHistory');
    return data || [];
};

export const saveCompetitorAnalysisHistory = async (userId: number, data: any) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('competitor_analysis').insert({ user_id: userId, ...data });
    if (error) handleError(error, 'saveCompetitorAnalysisHistory');
};

// --- File Upload ---

export const uploadFile = async (file: File): Promise<string | null> => {
    const client = supabase;
    if (!client) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await client.storage.from('uploads').upload(filePath, file);

    if (uploadError) {
        console.error('Upload Error:', uploadError);
        return null;
    }

    const { data } = client.storage.from('uploads').getPublicUrl(filePath);
    return data.publicUrl;
};