import React, { createContext, useContext } from 'react';
import type { User } from '../types';

interface UserContextType {
    user: User | null;
    updateUser: () => Promise<void>;
    logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = UserContext.Provider;

export const useUser = (): UserContextType => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    // The user can be null during logout or before login. 
    // Components are responsible for handling the null case.
    return context;
};
