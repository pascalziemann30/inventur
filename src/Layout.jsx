import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, History, Settings, Store, BookOpen } from 'lucide-react';
import { Toaster } from "sonner";
import { OutletProvider } from './components/outlet/OutletContext';

function LayoutContent({ children }) {
    const location = useLocation();
    const userRole = sessionStorage.getItem('user_role');
    
    const navigation = [
        { name: 'Übersicht', page: 'Dashboard', icon: Package },
        { name: 'Historie', page: 'History', icon: History },
        { name: 'Einstellungen', page: 'Settings', icon: Settings },
        ...(userRole === 'admin' ? [{ name: 'Produktpass', page: 'Produktpass', icon: BookOpen }] : []),
    ];
    
    const adminNavigation = [
        { name: 'Zentrale Übersicht', page: 'AdminOverview', icon: Store }
    ];

    const isActive = (page) => {
        const pageUrl = createPageUrl(page);
        return location.pathname === pageUrl || location.pathname === pageUrl + '/';
    };

    // Don't show layout on login page
    if (location.pathname === createPageUrl('OutletLogin') || location.pathname === createPageUrl('AdminOverview')) {
        return <>{children}</>;
    }

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

export default function Layout({ children }) {
    return (
        <OutletProvider>
            <LayoutContent>{children}</LayoutContent>
        </OutletProvider>
    );
}