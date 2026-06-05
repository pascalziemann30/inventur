import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, ShieldCheck, Lock } from 'lucide-react';
import { useOutlet } from '../components/outlet/OutletContext';
import { toast } from 'sonner';

export default function OutletLogin() {
    const navigate = useNavigate();
    const { setOutlet } = useOutlet();
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');

    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list()
    });

    const getFirstActiveOutlet = () => {
        return outlets.find(o => o.is_active !== false && o.type !== 'AGGREGATOR');
    };

    const handleEmployeeLogin = () => {
        const outlet = getFirstActiveOutlet();
        if (!outlet) {
            toast.error('Kein aktives Outlet gefunden');
            return;
        }
        localStorage.setItem('user_role', 'employee');
        setOutlet(outlet.id, outlet.name);
        navigate('/Dashboard');
    };

    const handleAdminLogin = () => {
        if (adminPassword === 'Kuno4488!') {
            const outlet = getFirstActiveOutlet();
            if (!outlet) {
                toast.error('Kein aktives Outlet gefunden');
                return;
            }
            localStorage.setItem('user_role', 'admin');
            setOutlet(outlet.id, outlet.name);
            navigate('/Dashboard');
        } else {
            toast.error('Falsches Passwort');
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
            {/* Logo */}
            <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6975d510bbe0422af7fe76ca/19feb6d1b_ChatGPTImage1Feb202616_14_34.png"
                alt="Kolek Schröder Logo"
                className="h-24 w-auto mb-6"
            />

            <h1 className="text-3xl font-bold text-slate-900 mb-1">Bestandsverwaltung</h1>
            <p className="text-slate-500 mb-10">Willkommen — bitte auswählen</p>

            {/* Role Cards */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl">
                {/* Mitarbeiter */}
                <button
                    onClick={handleEmployeeLogin}
                    className="flex-1 flex flex-col items-center justify-center gap-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-10 shadow-md transition-all"
                >
                    <Users className="w-12 h-12" />
                    <div className="text-center">
                        <div className="text-xl font-bold">Mitarbeiter</div>
                        <div className="text-sm text-emerald-100 mt-1">Direkt einloggen</div>
                    </div>
                </button>

                {/* Administrator */}
                <div className="flex-1 flex flex-col">
                    <button
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-10 shadow-md transition-all"
                    >
                        <ShieldCheck className="w-12 h-12" />
                        <div className="text-center">
                            <div className="text-xl font-bold">Administrator</div>
                            <div className="text-sm text-slate-400 mt-1">Passwort erforderlich</div>
                        </div>
                    </button>

                    {showAdminPassword && (
                        <div className="mt-3 flex gap-2">
                            <div className="relative flex-1">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder="Passwort"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                                    className="pl-9"
                                    autoFocus
                                />
                            </div>
                            <Button onClick={handleAdminLogin} className="bg-slate-900 hover:bg-slate-800">
                                Anmelden
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}