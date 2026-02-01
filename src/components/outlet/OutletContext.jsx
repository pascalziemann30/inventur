import React, { createContext, useContext, useState, useEffect } from 'react';

const OutletContext = createContext();

export function OutletProvider({ children }) {
    const [currentOutletId, setCurrentOutletId] = useState(() => {
        return localStorage.getItem('current_outlet_id') || null;
    });

    const [currentOutletName, setCurrentOutletName] = useState(() => {
        return localStorage.getItem('current_outlet_name') || null;
    });

    const setOutlet = (outletId, outletName) => {
        setCurrentOutletId(outletId);
        setCurrentOutletName(outletName);
        localStorage.setItem('current_outlet_id', outletId);
        localStorage.setItem('current_outlet_name', outletName);
    };

    const clearOutlet = () => {
        setCurrentOutletId(null);
        setCurrentOutletName(null);
        localStorage.removeItem('current_outlet_id');
        localStorage.removeItem('current_outlet_name');
    };

    return (
        <OutletContext.Provider value={{ 
            currentOutletId, 
            currentOutletName, 
            setOutlet, 
            clearOutlet 
        }}>
            {children}
        </OutletContext.Provider>
    );
}

export function useOutlet() {
    const context = useContext(OutletContext);
    if (!context) {
        throw new Error('useOutlet must be used within OutletProvider');
    }
    return context;
}