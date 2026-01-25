import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, History, Settings } from 'lucide-react';
import { Toaster } from "sonner";

export default function Layout({ children }) {
    const location = useLocation();
    
    const navigation = [
        { name: 'Übersicht', page: 'Dashboard', icon: Package },
        { name: 'Historie', page: 'History', icon: History },
        { name: 'Einstellungen', page: 'Settings', icon: Settings },
    ];

    const isActive = (page) => {
        const pageUrl = createPageUrl(page);
        return location.pathname === pageUrl || location.pathname === pageUrl + '/';
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {children}
            
            {/* Bottom Navigation - Mobile */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 sm:hidden z-50">
                <div className="flex justify-around py-2">
                    {navigation.map((item) => (
                        <Link
                            key={item.page}
                            to={createPageUrl(item.page)}
                            className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                                isActive(item.page)
                                    ? 'text-slate-900'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-xs mt-1">{item.name}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Add padding for bottom nav on mobile */}
            <div className="h-16 sm:hidden" />
            
            <Toaster position="top-center" richColors />
        </div>
    );
}