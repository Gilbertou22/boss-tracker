// src/context/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const UserContext = createContext();

const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');
    const BASE_URL = process.env.REACT_APP_API_URL || '';

    useEffect(() => {
        const fetchUserInfo = async () => {
            if (token) {
                try {
                    const res = await axios.get(`${BASE_URL}/api/users/profile`, {
                        headers: { 'x-auth-token': token },
                    });
                    setUser(res.data);
                } catch (err) {
                    setUser(null);
                    localStorage.removeItem('token');
                }
            }
            setLoading(false);
        };

        fetchUserInfo();
    }, [token]);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export { UserContext, UserProvider };