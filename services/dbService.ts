import type { User, PostScenario, Plan, Report, Caption, PostIdea, BroadcastMessage, ActivityLog, ChatMessage, SubscriptionHistory } from '../types';
import { supabase, SUPABASE_INIT_ERROR } from './supabaseClient';

// --- Constants ---
const ADMIN_IDS = [1337]; 
// M1: Mock admin code for offline/demo use (bypasses database).
const ADMIN_ACCESS_CODE = 'M1';
// M2: Default admin code intended for use with a real database entry.
const ADMIN_DB_ACCESS_CODE = 'M2'; 

// T1: Mock user code for offline/demo use (bypasses database).
const TEST_USER_ACCESS_CODE = 'T1';
const TEST_USER_ID = 1;
// T2: Default test user code intended for use with a real database entry.
const TEST_DB_USER_ACCESS_CODE = 'T2';


// --- Mock Users for Demo ---
// These users allow the app to be used immediately without a database connection.
const adminExpires = new Date();
adminExpires.setFullYear(adminExpires.getFullYear() + 10);
const MOCK_ADMIN_USER: User = {
  user_id: ADMIN_IDS[0],
  full_name: 'مدیر سیستم (نمایشی)',
  access_code: ADMIN_ACCESS_CODE,
  is_verified: true,
  about_info: 'مدیر کل سیستم با دسترسی کامل به تمام بخش‌ها.',
  preferred_name: 'مدیر',
  story_requests: 0,
  caption_idea_requests: 0,
  chat_messages: 0,
  story_limit: 999,
  caption_idea_limit: 999,
  chat_limit: 9999,
  last_request_date: new Date().toISOString().split('T')[0],
  last_weekly_reset_date: new Date().toISOString().split('T')[0],
  is_vip: true,
  subscription_expires_at: adminExpires.toISOString(),
};

const testUserExpires = new Date();
testUserExpires.setDate(testUserExpires.getDate() + 30);
const MOCK_TEST_USER: User = {
  user_id: TEST_USER_ID,
  full_name: 'کاربر تستی (نمایشی)',
  access_code: TEST_USER_ACCESS_CODE,
  is_verified: true,
  about_info: 'یک تولیدکننده محتوای خلاق در حوزه سبک زندگی و روزمرگی.',
  preferred_name: 'کاربر تستی',
  story_requests: 0,
  caption_idea_requests: 0,
  chat_messages: 0,
  story_limit: 2,
  caption_idea_limit: 2,
  chat_limit: 150,
  last_request_date: new Date().toISOString().split('T')[0],
  last_weekly_reset_date: new Date().toISOString().split('T')[0],
  is_vip: true,
  subscription_expires_at: testUserExpires.toISOString(),
};


// --- Helper Functions ---
const handleError = (error: any, context: string) => {
    // This function now primarily serves for logging errors during development.
    // The null check for supabase is now handled in each function to throw a user-facing error.
    if (error) {
        console.error(`Supabase error in ${context}:`, error);
    }
    return null;
}

const getMockUserFromStorage = (userId: number): User | null => {
    try {
        const stored = localStorage.getItem(`mock_user_${userId}`);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

const saveMockUserToStorage = (user: User): void => {
    try {
        localStorage.setItem(`mock_user_${user.user_id}`, JSON.stringify(user));
    } catch (e) {
        console.error("Failed to save mock user to storage", e);
    }
};


// --- User Management ---
export const isUserAdmin = (userId: number): boolean => ADMIN_IDS.includes(userId);

export const verifyAccessCode = async (code: string, isSessionLogin: boolean = false): Promise<User | null> => {
    // --- MOCK USER LOGIC ---
    if (!isSessionLogin) {
        if (code === ADMIN_ACCESS_CODE) return Promise.resolve(getMockUserFromStorage(MOCK_ADMIN_USER.user_id) || MOCK_ADMIN_USER);
        if (code === TEST_USER_ACCESS_CODE) return Promise.resolve(getMockUserFromStorage(MOCK_TEST_USER.user_id) || MOCK_TEST_USER);
    }
    if (isSessionLogin) {
        const userId = parseInt(code, 10);
        if (userId === ADMIN_IDS[0]) return Promise.resolve(getMockUserFromStorage(MOCK_ADMIN_USER.user_id) || MOCK_ADMIN_USER);
        if (userId === TEST_USER_ID) return Promise.resolve(getMockUserFromStorage(MOCK_TEST_USER.user_id) || MOCK_TEST_USER);
    }
    // --- END MOCK USER LOGIC ---

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
        // Check for admin code in DB
        if (!isSessionLogin && code === ADMIN_DB_ACCESS_CODE) {
             const { data: adminUser, error: adminError } = await supabase.from('users').select('*').eq('user_id', ADMIN_IDS[0]).single();
             if (adminError) {
                 handleError(adminError, 'verifyAccessCode:admin');
                 throw new Error(`خطای پایگاه داده هنگام بررسی مدیر: ${adminError.message}`);
             }
             return adminUser;
        }
        return null;
    }
    
    // Subscription check before any other logic
    if (user && !isUserAdmin(user.user_id)) {
        const expires = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
        if (!expires || expires < new Date()) {
            user.is_subscription_expired = true;
            // Return early for expired users; no need to reset their daily limits.
            return user;
        }
    }


    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let updatePayload: {[key: string]: any} = {};
    let needsUpdate = false;

    // Daily reset for stories
    if (user.last_request_date !== todayStr) {
        updatePayload.story_requests = 0;
        updatePayload.caption_idea_requests = 0;
        updatePayload.last_request_date = todayStr;
        needsUpdate = true;
    }

    // Weekly reset for chat and images
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
            // Manually update user object to reflect changes without re-fetching
            if (updatePayload.story_requests === 0) user.story_requests = 0;
            if (updatePayload.caption_idea_requests === 0) user.caption_idea_requests = 0;
            if (updatePayload.last_request_date) user.last_request_date = updatePayload.last_request_date;
            if (updatePayload.chat_messages === 0) user.chat_messages = 0;
            if (updatePayload.last_weekly_reset_date) user.last_weekly_reset_date = updatePayload.last_weekly_reset_date;
        }
    }
    
    if(!isSessionLogin) {
        await logActivity(user.user_id, 'به برنامه وارد شد.');
    }

    return user;
};

export const getAllUsers = async (): Promise<User[]> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { data, error } = await supabase.from('users').select('*').neq('user_id', ADMIN_IDS[0]);
    if (error) handleError(error, 'getAllUsers');
    return data || [];
};

export const getUserById = async (userId: number): Promise<User | null> => {
    // --- MOCK USER LOGIC ---
    if (userId === ADMIN_IDS[0]) return Promise.resolve(getMockUserFromStorage(userId) || MOCK_ADMIN_USER);
    if (userId === TEST_USER_ID) return Promise.resolve(getMockUserFromStorage(userId) || MOCK_TEST_USER);
    // --- END MOCK USER LOGIC ---
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
        story_requests: 0,
        caption_idea_requests: 0,
        chat_messages: 0,
        story_limit: 2,
        caption_idea_limit: 2,
        chat_limit: 150,
        last_request_date: new Date().toISOString().split('T')[0],
        last_weekly_reset_date: new Date().toISOString().split('T')[0],
        about_info: '',
        preferred_name: '',
        is_vip: isVip,
        subscription_expires_at: expires.toISOString(),
    };
    
    // Generate a unique user_id that isn't an admin id
    newUser.user_id = Date.now();
    
    const { error } = await supabase.from('users').insert(newUser);
    if (error) {
        handleError(error, 'addUser:insert');
        return { success: false, message: `خطا در افزودن کاربر: ${error.message}` };
    }
    return { success: true, message: `کاربر '${fullName}' با موفقیت اضافه شد.` };
};

export const deleteUser = async (userId: number): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').delete().eq('user_id', userId);
    if (error) handleError(error, 'deleteUser');
    // Note: Cascading deletes should be set up in Supabase to handle related data.
};

export const updateUserInfo = async (userId: number, info: { about_info: string, preferred_name: string }): Promise<void> => {
    // --- MOCK USER LOGIC ---
    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || mockUserDefault;
        mockUser.about_info = info.about_info;
        mockUser.preferred_name = info.preferred_name;
        saveMockUserToStorage(mockUser);
        return;
    }
    // --- END MOCK USER LOGIC ---

    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update({ about_info: info.about_info, preferred_name: info.preferred_name }).eq('user_id', userId);
    if (error) {
        // Catch specific schema error and provide a helpful message.
        if (error.message.includes("preferred_name") && error.message.includes("column") && error.message.includes("users")) {
             throw new Error(`خطای پایگاه داده: ستون 'preferred_name' در جدول 'users' پیدا نشد.\n\nلطفاً اسکریپت SQL راهنمای موجود در انتهای همین فایل ('services/dbService.ts') را اجرا کنید تا ستون‌های مورد نیاز به جدول کاربران اضافه شوند.`);
        }
        handleError(error, 'updateUserInfo');
        throw new Error(error.message);
    }
};

export const updateUserVipStatus = async (userId: number, isVip: boolean): Promise<void> => {
    // --- MOCK USER LOGIC ---
    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || mockUserDefault;
        mockUser.is_vip = isVip;
        saveMockUserToStorage(mockUser);
        return;
    }
    // --- END MOCK USER LOGIC ---
    
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update({ is_vip: isVip }).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserVipStatus');
        throw error;
    }
}

export const updateUserUsageLimits = async (userId: number, limits: Partial<Pick<User, 'story_requests' | 'caption_idea_requests' | 'chat_messages'>>): Promise<void> => {
    // --- MOCK USER LOGIC ---
    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || { ...mockUserDefault };
        Object.assign(mockUser, limits);
        saveMockUserToStorage(mockUser);
        return;
    }
    // --- END MOCK USER LOGIC ---

    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserUsageLimits');
        throw error;
    }
}

export const updateUserTotalLimits = async (userId: number, limits: Partial<Pick<User, 'story_limit' | 'caption_idea_limit' | 'chat_limit'>>): Promise<void> => {
    // --- MOCK USER LOGIC ---
    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || { ...mockUserDefault };
        Object.assign(mockUser, limits);
        saveMockUserToStorage(mockUser);
        return;
    }
    // --- END MOCK USER LOGIC ---

    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('users').update(limits).eq('user_id', userId);
    if (error) {
        handleError(error, 'updateUserTotalLimits');
        throw error;
    }
}


// --- Usage Tracking ---
export const incrementUsage = async (userId: number, type: 'story' | 'chat' | 'caption_idea'): Promise<void> => {
    // --- MOCK USER LOGIC ---
    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || { ...mockUserDefault };
        if (type === 'story') mockUser.story_requests++;
        else if (type === 'chat') mockUser.chat_messages++;
        else if (type === 'caption_idea') mockUser.caption_idea_requests++;
        saveMockUserToStorage(mockUser);
        // Mock activity log is not implemented for simplicity.
        return;
    }
    // --- END MOCK USER LOGIC ---
    
    if (!supabase) return;
    const user = await getUserById(userId);
    if (!user) return;

    let columnToIncrement: 'story_requests' | 'chat_messages' | 'caption_idea_requests' = 'chat_messages';
    let action = '';
    
    if (type === 'story') { 
        columnToIncrement = 'story_requests';
        action = `یک سناریوی استوری (${user.story_requests + 1}/${user.story_limit ?? 2} روزانه) تولید کرد.`;
    }
    else if (type === 'caption_idea') {
        columnToIncrement = 'caption_idea_requests';
        action = `یک کپشن از ایده (${user.caption_idea_requests + 1}/${user.caption_idea_limit ?? 2} روزانه) تولید کرد.`;
    }
    else if (type === 'chat') {
        columnToIncrement = 'chat_messages';
        action = `یک پیام در چت (${user.chat_messages + 1}/${user.chat_limit ?? 150} هفتگی) ارسال کرد.`;
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

    const mockUserDefault = userId === TEST_USER_ID ? MOCK_TEST_USER : userId === ADMIN_IDS[0] ? MOCK_ADMIN_USER : null;
    if (mockUserDefault) {
        const mockUser = getMockUserFromStorage(userId) || { ...mockUserDefault };
        const currentExpiry = mockUser.subscription_expires_at ? new Date(mockUser.subscription_expires_at) : new Date();
        const baseDate = currentExpiry < new Date() ? new Date() : currentExpiry;
        baseDate.setDate(baseDate.getDate() + days);
        mockUser.subscription_expires_at = baseDate.toISOString();
        saveMockUserToStorage(mockUser);
        return { success: true, message: `اشتراک کاربر نمایشی برای ${days} روز تمدید شد.` };
    }

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

// NOTE FOR ADMINS: If you get a "duplicate key value violates unique constraint" error
// on a key like 'plans_user_id_key', it means your 'plans' table has an incorrect unique constraint
// on the user_id column. A user should be able to have multiple plans.
// Run this command in your Supabase SQL Editor to fix it:
// ALTER TABLE public.plans DROP CONSTRAINT plans_user_id_key;

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

export const saveReportForUser = async (userId: number, content: string): Promise<void> => {
    if (!supabase) throw new Error(SUPABASE_INIT_ERROR);
    const { error } = await supabase.from('reports').insert({ user_id: userId, content, timestamp: new Date().toISOString() });
    if (error) {
        console.error('Supabase error in saveReportForUser:', error);
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
    const { data, error } = await supabase.from('captions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (error) handleError(error, 'getCaptionsForUser');
    return data || [];
};
export const addCaption = async (userId: number, title: string, content: string, originalScenarioContent: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('captions').insert({ user_id: userId, title, content, original_scenario_content: originalScenarioContent });
    if (error) handleError(error, 'addCaption');
};

// --- Broadcasts ---
export const getLatestBroadcast = async (): Promise<BroadcastMessage | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('broadcasts').select('*').order('timestamp', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') handleError(error, 'getLatestBroadcast');
    return data;
};
export const addBroadcast = async (message: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('broadcasts').insert({ message, timestamp: new Date().toISOString() });
    if (error) handleError(error, 'addBroadcast');
};

// --- Activity Log ---
export const logActivity = async (userId: number, action: string): Promise<void> => {
    if (!supabase) return;
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
    if (!supabase) return [];
    const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) handleError(error, 'getActivityLogs');
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
    // Don't save image data URLs to the database to keep it clean.
    const cleanMessages = messages.map(({imageUrl, ...rest}) => rest);
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
    if (currentHistory.length > 10) currentHistory.pop();
    const { error } = await supabase.from('story_history').upsert({ user_id: userId, stories: currentHistory }, { onConflict: 'user_id' });
    if (error) handleError(error, 'saveStoryHistory');
};


// --- Notifications for Badges ---
export const getNotificationCounts = async (userId: number): Promise<{ scenarios: number, plans: number, reports: number }> => {
    if (!supabase) return { scenarios: 0, plans: 0, reports: 0 };
    const { data: scenarios, error: sError, count } = await supabase.from('scenarios').select('id', { count: 'exact' }).eq('user_id', userId);
    if (sError) handleError(sError, 'getNotificationCounts:scenarios');

    const plansList = await getPlansForUser(userId);
    const lastPlanView = localStorage.getItem(`lastView_plans_${userId}`);
    const newPlansCount = plansList.filter(plan => !lastPlanView || new Date(plan.timestamp).getTime() > Number(lastPlanView)).length;

    const reportsList = await getReportsForUser(userId);
    const lastReportView = localStorage.getItem(`lastView_reports_${userId}`);
    const newReportsCount = reportsList.filter(report => !lastReportView || new Date(report.timestamp).getTime() > Number(lastReportView)).length;

    return { scenarios: count || 0, plans: newPlansCount, reports: newReportsCount };
};

export const getAdminNotificationCounts = async (): Promise<{ ideas: number, logs: number }> => {
    if (!supabase) return { ideas: 0, logs: 0 };
    const { count: ideasCount, error: iError } = await supabase.from('ideas').select('id', { count: 'exact' });
    if (iError) handleError(iError, 'getAdminNotificationCounts:ideas');

    const lastLogView = localStorage.getItem(`lastView_admin_logs`);
    const lastLogTime = lastLogView ? new Date(Number(lastLogView)).toISOString() : new Date(0).toISOString();
    
    const { count: logsCount, error: lError } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gt('created_at', lastLogTime);
    if (lError) handleError(lError, 'getAdminNotificationCounts:logs');

    return { ideas: ideasCount || 0, logs: logsCount || 0 };
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

// --- IMPORTANT: SQL for Subscription Feature ---
// Please run the following SQL commands in your Supabase SQL Editor to enable the new subscription feature.

/*
-- 1. Add subscription expiry column to users table
ALTER TABLE public.users
ADD COLUMN subscription_expires_at TIMESTAMPTZ;

-- 2. Create a table to log subscription history
CREATE TABLE public.subscription_history (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extended_for_days INT NOT NULL,
  new_expiry_date TIMESTAMPTZ NOT NULL
);

-- 3. Enable Row Level Security (RLS) for the new table
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for the new table (adjust as needed for your security model)
CREATE POLICY "Allow authenticated users to read their own history"
ON public.subscription_history
FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT user_uid FROM users WHERE user_id = subscription_history.user_id));

CREATE POLICY "Allow full access for service_role"
ON public.subscription_history
FOR ALL
TO service_role
USING (true);


-- 5. Create RPC function to safely extend a subscription
CREATE OR REPLACE FUNCTION extend_subscription(p_user_id BIGINT, p_days_to_add INT)
RETURNS VOID AS $$
DECLARE
  v_current_expiry TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
BEGIN
  -- Get the current expiry date for the user
  SELECT subscription_expires_at INTO v_current_expiry
  FROM public.users
  WHERE user_id = p_user_id;

  -- If current expiry is null or in the past, extend from today.
  -- Otherwise, extend from the current expiry date.
  IF v_current_expiry IS NULL OR v_current_expiry < NOW() THEN
    v_new_expiry := NOW() + (p_days_to_add || ' days')::INTERVAL;
  ELSE
    v_new_expiry := v_current_expiry + (p_days_to_add || ' days')::INTERVAL;
  END IF;

  -- Update the user's subscription expiry date
  UPDATE public.users
  SET subscription_expires_at = v_new_expiry
  WHERE user_id = p_user_id;

  -- Log the extension in the history table
  INSERT INTO public.subscription_history (user_id, extended_for_days, new_expiry_date)
  VALUES (p_user_id, p_days_to_add, v_new_expiry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add preferred_name column for personalized chat greetings
ALTER TABLE public.users
ADD COLUMN preferred_name TEXT;

*/
// NOTE: To support the new features, you may need to add the following columns to your 'users' table in Supabase:
// - is_vip (boolean, default: false)
// - last_weekly_reset_date (date)
// - caption_idea_requests (integer, default: 0)
// - story_limit (integer, default: 2)
// - caption_idea_limit (integer, default: 2)
// - chat_limit (integer, default: 150)
// - preferred_name (text)
// - REMOVED: image_limit (integer, default: 35)