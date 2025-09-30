import { User, PostScenario, Plan, Report, Caption, PostIdea, BroadcastMessage, ActivityLog, ChatMessage } from '../types';
import { supabase } from './supabaseClient';

// --- Constants ---
const ADMIN_IDS = [1337]; 
const ADMIN_ACCESS_CODE = 'w1';
const TEST_USER_ACCESS_CODE = 'T1';
const TEST_USER_ID = 1;


// --- Helper Functions ---
const handleError = (error: any, context: string) => {
    console.error(`Supabase error in ${context}:`, error);
    return null;
}

// --- User Management ---
export const isUserAdmin = (userId: number): boolean => ADMIN_IDS.includes(userId);

export const verifyAccessCode = async (code: string, isSessionLogin: boolean = false): Promise<User | null> => {
    let query;
    
    if (code === ADMIN_ACCESS_CODE && !isSessionLogin) {
        query = supabase.from('users').select('*').eq('user_id', ADMIN_IDS[0]).single();
    } else if (code === TEST_USER_ACCESS_CODE && !isSessionLogin) {
        query = supabase.from('users').select('*').eq('user_id', TEST_USER_ID).single();
    } else if (isSessionLogin) {
        const userId = parseInt(code, 10);
        if (isNaN(userId)) return null;
        query = supabase.from('users').select('*').eq('user_id', userId).eq('is_verified', true).single();
    } else {
        query = supabase.from('users').select('*').eq('access_code', code).eq('is_verified', true).single();
    }

    const { data: user, error } = await query;
    if (error || !user) {
        if (error && error.code !== 'PGRST116') { // Ignore "no rows found" error for logging
             handleError(error, 'verifyAccessCode');
        }
        return null;
    }

    const today = new Date().toISOString().split('T')[0];
    if (user.last_request_date !== today) {
        const { error: updateError } = await supabase.from('users').update({
            story_requests: 0,
            image_requests: 0,
            chat_messages: 0,
            last_request_date: today
        }).eq('user_id', user.user_id);

        if (updateError) handleError(updateError, 'verifyAccessCode:updateUsage');
        else {
            user.story_requests = 0;
            user.image_requests = 0;
            user.chat_messages = 0;
            user.last_request_date = today;
        }
    }
    
    if(!isSessionLogin) {
        await logActivity(user.user_id, 'به برنامه وارد شد.');
    }

    return user;
};

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').neq('user_id', ADMIN_IDS[0]);
    if (error) handleError(error, 'getAllUsers');
    return data || [];
};

export const getUserById = async (userId: number): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (error) handleError(error, 'getUserById');
    return data;
};

export const addUser = async (fullName: string, accessCode: string): Promise<{ success: boolean, message: string }> => {
    const { data: existingUser, error: checkError } = await supabase.from('users').select('user_id').eq('access_code', accessCode).single();
    if (checkError && checkError.code !== 'PGRST116') {
        handleError(checkError, 'addUser:check');
        return { success: false, message: 'خطا در بررسی کد دسترسی.' };
    }
    if (existingUser) {
        return { success: false, message: 'این کد دسترسی قبلاً استفاده شده است.' };
    }

    const newUser: Omit<User, 'user_id'> & { user_id?: number } = {
        full_name: fullName,
        access_code: accessCode,
        is_verified: 1,
        story_requests: 0,
        image_requests: 0,
        chat_messages: 0,
        last_request_date: new Date().toISOString().split('T')[0],
        about_info: '',
    };
    
    // Generate a unique user_id that isn't an admin id
    newUser.user_id = Date.now();
    
    const { error } = await supabase.from('users').insert(newUser);
    if (error) {
        handleError(error, 'addUser:insert');
        return { success: false, message: 'خطا در افزودن کاربر.' };
    }
    return { success: true, message: `کاربر '${fullName}' با موفقیت اضافه شد.` };
};

export const deleteUser = async (userId: number): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteUser');
    // Note: Cascading deletes should be set up in Supabase to handle related data.
};

export const updateUserAbout = async (userId: number, about: string): Promise<void> => {
    const { error } = await supabase.from('users').update({ about_info: about }).eq('user_id', userId);
    if (error) handleError(error, 'updateUserAbout');
};

// --- Usage Tracking ---
export const incrementUsage = async (userId: number, type: 'story' | 'image' | 'chat'): Promise<void> => {
    const user = await getUserById(userId);
    if (!user) return;

    let columnToIncrement: 'story_requests' | 'image_requests' | 'chat_messages' = 'chat_messages';
    let action = '';
    
    if (type === 'story') { 
        columnToIncrement = 'story_requests';
        action = `یک سناریوی استوری (${user.story_requests + 1}/1) تولید کرد.`;
    }
    else if (type === 'image') {
        columnToIncrement = 'image_requests';
        action = `یک تصویر (${user.image_requests + 1}/5) تولید کرد.`;
    }
    else if (type === 'chat') {
        columnToIncrement = 'chat_messages';
        action = `یک پیام در چت (${user.chat_messages + 1}/10) ارسال کرد.`;
    }

    const { error } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_column: columnToIncrement
    });
    
    if (error) {
      handleError(error, `incrementUsage:${type}`);
    } else {
      await logActivity(userId, action);
    }
};

// --- Plans ---
export const getPlanForUser = async (userId: number): Promise<Plan | null> => {
    const { data, error } = await supabase.from('plans').select('*').eq('user_id', userId).maybeSingle();
    if (error) handleError(error, 'getPlanForUser');
    return data;
};

export const savePlanForUser = async (userId: number, content: string): Promise<void> => {
    const { error } = await supabase.from('plans').upsert({ user_id: userId, content, timestamp: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) handleError(error, 'savePlanForUser');
};

export const deletePlanForUser = async (userId: number): Promise<void> => {
    const { error } = await supabase.from('plans').delete().eq('user_id', userId);
    if (error) handleError(error, 'deletePlanForUser');
};

// --- Reports ---
export const getReportsForUser = async (userId: number): Promise<Report[]> => {
    const { data, error } = await supabase.from('reports').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) handleError(error, 'getReportsForUser');
    return data || [];
};

export const saveReportForUser = async (userId: number, content: string): Promise<void> => {
    const { error } = await supabase.from('reports').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) handleError(error, 'saveReportForUser');
};

export const deleteReportForUser = async (userId: number): Promise<void> => {
    const { data, error } = await supabase.from('reports').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteReportForUser');
};

// --- Scenarios ---
export const getScenariosForUser = async (userId: number): Promise<PostScenario[]> => {
    const { data, error } = await supabase.from('scenarios').select('*').eq('user_id', userId).order('scenario_number', { ascending: true });
    if (error) handleError(error, 'getScenariosForUser');
    return data || [];
};
export const getScenarioById = async (id: number): Promise<PostScenario | null> => {
    const { data, error } = await supabase.from('scenarios').select('*').eq('id', id).single();
    if (error) handleError(error, 'getScenarioById');
    return data || null;
}
export const addScenarioForUser = async (userId: number, scenarioNumber: number, content: string): Promise<void> => {
    const { error } = await supabase.from('scenarios').insert({ user_id: userId, scenario_number: scenarioNumber, content });
    if (error) handleError(error, 'addScenarioForUser');
};
export const deleteScenario = async (scenarioId: number): Promise<void> => {
    const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId);
    if (error) handleError(error, 'deleteScenario');
};

// --- Ideas ---
export const getIdeasForUser = async (userId: number): Promise<PostIdea[]> => {
    const { data, error } = await supabase.from('ideas').select('*').eq('user_id', userId);
    if (error) handleError(error, 'getIdeasForUser');
    return data || [];
};
export const addIdeaForUser = async (userId: number, ideaText: string): Promise<void> => {
    const { error } = await supabase.from('ideas').insert({ user_id: userId, idea_text: ideaText });
    if (error) handleError(error, 'addIdeaForUser:insert');
    else await logActivity(userId, 'یک ایده پست جدید ارسال کرد.');
};
export const deleteIdea = async (ideaId: number): Promise<void> => {
    const { error } = await supabase.from('ideas').delete().eq('id', ideaId);
    if (error) handleError(error, 'deleteIdea');
};

// --- Captions ---
export const getCaptionsForUser = async (userId: number): Promise<Caption[]> => {
    const { data, error } = await supabase.from('captions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) handleError(error, 'getCaptionsForUser');
    return data || [];
};
export const addCaption = async (userId: number, title: string, content: string, originalScenarioContent: string): Promise<void> => {
    const { error } = await supabase.from('captions').insert({ user_id: userId, title, content, original_scenario_content: originalScenarioContent });
    if (error) handleError(error, 'addCaption');
};

// --- Broadcasts ---
export const getLatestBroadcast = async (): Promise<BroadcastMessage | null> => {
    const { data, error } = await supabase.from('broadcasts').select('*').order('timestamp', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getLatestBroadcast');
    return data;
};
export const addBroadcast = async (message: string): Promise<void> => {
    const { error } = await supabase.from('broadcasts').insert({ message, timestamp: new Date().toISOString() });
    if (error) handleError(error, 'addBroadcast');
};

// --- Activity Log ---
export const logActivity = async (userId: number, action: string): Promise<void> => {
    if (isUserAdmin(userId)) return;
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
    const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) handleError(error, 'getActivityLogs');
    return data || [];
};

// --- History (JSONB columns) ---
export const getChatHistory = async (userId: number): Promise<ChatMessage[]> => {
    const { data, error } = await supabase.from('chat_history').select('messages').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getChatHistory');
    return data?.messages || [];
};
export const saveChatHistory = async (userId: number, messages: ChatMessage[]): Promise<void> => {
    const { error } = await supabase.from('chat_history').upsert({ user_id: userId, messages }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveChatHistory');
};

export const getStoryHistory = async (userId: number): Promise<{ id: number; content: string }[]> => {
    const { data, error } = await supabase.from('story_history').select('stories').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getStoryHistory');
    return data?.stories || [];
};
export const saveStoryHistory = async (userId: number, storyContent: string): Promise<void> => {
    const currentHistory = await getStoryHistory(userId);
    const newStory = { id: Date.now(), content: storyContent };
    currentHistory.unshift(newStory);
    if (currentHistory.length > 10) currentHistory.pop();
    const { error } = await supabase.from('story_history').upsert({ user_id: userId, stories: currentHistory }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveStoryHistory');
};

export const getImageHistory = async (userId: number): Promise<{ id: number; url: string }[]> => {
    const { data, error } = await supabase.from('image_history').select('images').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getImageHistory');
    return data?.images || [];
};
export const saveImageHistory = async (userId: number, imageUrl: string): Promise<void> => {
    const currentHistory = await getImageHistory(userId);
    const newImage = { id: Date.now(), url: imageUrl };
    currentHistory.unshift(newImage);
    if (currentHistory.length > 10) currentHistory.pop();
    const { error } = await supabase.from('image_history').upsert({ user_id: userId, images: currentHistory }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveImageHistory');
};

// --- Notifications for Badges ---
export const getNotificationCounts = async (userId: number): Promise<{ scenarios: number, plans: number, reports: number }> => {
    const { data: scenarios, error: sError } = await supabase.from('scenarios').select('id', { count: 'exact' }).eq('user_id', userId);
    if (sError) handleError(sError, 'getNotificationCounts:scenarios');

    const plan = await getPlanForUser(userId);
    const lastPlanView = localStorage.getItem(`lastView_plans_${userId}`);
    const plansCount = plan && (!lastPlanView || new Date(plan.timestamp).getTime() > Number(lastPlanView)) ? 1 : 0;

    const reportsList = await getReportsForUser(userId);
    const lastReportView = localStorage.getItem(`lastView_reports_${userId}`);
    const newReportsCount = reportsList.filter(report => !lastReportView || new Date(report.timestamp).getTime() > Number(lastReportView)).length;

    return { scenarios: scenarios?.length || 0, plans: plansCount, reports: newReportsCount };
};

export const getAdminNotificationCounts = async (): Promise<{ ideas: number, logs: number }> => {
    const { data: ideas, error: iError } = await supabase.from('ideas').select('id', { count: 'exact' });
    if (iError) handleError(iError, 'getAdminNotificationCounts:ideas');

    const lastLogView = localStorage.getItem(`lastView_admin_logs`);
    const lastLogTime = lastLogView ? new Date(Number(lastLogView)).toISOString() : new Date(0).toISOString();
    
    const { count: logsCount, error: lError } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gt('created_at', lastLogTime);
    if (lError) handleError(lError, 'getAdminNotificationCounts:logs');

    return { ideas: ideas?.length || 0, logs: logsCount || 0 };
};

const dismissNewsItem = async (userId: number, type: 'plan' | 'report' | 'scenarios') => {
    // This functionality now relies on clearUserNotifications setting localStorage timestamps.
    // The dashboard logic will filter based on that, so this function is simplified.
};

export const clearUserNotifications = (section: 'scenarios' | 'plans' | 'reports', userId: number): void => {
    localStorage.setItem(`lastView_${section}_${userId}`, String(Date.now()));
};

export const clearAdminNotifications = (section: 'ideas' | 'logs'): void => {
     if (section === 'ideas') {
        // Ideas are cleared by being deleted, so we do nothing here.
     } else {
        localStorage.setItem(`lastView_admin_${section}`, String(Date.now()));
     }
};

// This function needs to be created in your Supabase SQL editor
/*
CREATE OR REPLACE FUNCTION increment_usage(p_user_id bigint, p_column text)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE users SET %I = %I + 1 WHERE user_id = %L', p_column, p_column, p_user_id);
END;
$$ LANGUAGE plpgsql;
*/