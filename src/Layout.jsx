import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, History, Settings, LogOut, Store } from 'lucide-react';
import { Toaster } from "sonner";
import { OutletProvider, useOutlet } from './components/outlet/OutletContext';
import { Button } from "@/components/ui/button";

function LayoutContent({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentOutletName, clearOutlet } = useOutlet();
    
    const navigation = [
        { name: 'Übersicht', page: 'Dashboard', icon: Package },
        { name: 'Historie', page: 'History', icon: History },
        { name: 'Einstellungen', page: 'Settings', icon: Settings },
    ];
    
    const adminNavigation = [
        { name: 'Zentrale Übersicht', page: 'AdminOverview', icon: Store }
    ];

    const isActive = (page) => {
        const pageUrl = createPageUrl(page);
        return location.pathname === pageUrl || location.pathname === pageUrl + '/';
    };

    const handleLogout = () => {
        localStorage.removeItem('user_role');
        clearOutlet();
        navigate('/OutletLogin');
    };

    // Don't show layout on login page
    if (location.pathname === createPageUrl('OutletLogin') || location.pathname === createPageUrl('AdminOverview')) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Outlet Header Bar */}
            {currentOutletName && (
                <div className="bg-slate-900 text-white py-2 px-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm">
                                <Store className="w-4 h-4" />
                                <span className="font-medium">{currentOutletName}</span>
                            </div>
                            <div className="hidden sm:block h-4 w-px bg-slate-700" />
                            <Link 
                                to={createPageUrl('AdminOverview')}
                                className="hidden sm:flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
                            >
                                <Store className="w-3 h-3" />
                                Admin Übersicht
                            </Link>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleLogout}
                            className="text-white hover:bg-slate-800 h-7"
                        >
                            <LogOut className="w-3 h-3 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>
            )}
            
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