import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ShieldCheck, Lock } from 'lucide-react';
import { useOutlet } from '../components/outlet/OutletContext';
import { toast } from 'sonner';

export default function OutletLogin() {
    const navigate = useNavigate();
    const { setOutlet } = useOutlet();
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [selectedOutletId, setSelectedOutletId] = useState('');

    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list(),
        onSuccess: (data) => {
            if (data.length > 0 && !selectedOutletId) {
                const kuno15 = data.find(o =>
                    o.name.includes('Kuno 15') || o.name.toLowerCase().includes('kuno15')
                );
                setSelectedOutletId(kuno15 ? kuno15.id : data[0].id);
            }
        }
    });

    // Also set default when outlets load (onSuccess may not fire in all versions)
    React.useEffect(() => {
        if (outlets.length > 0 && !selectedOutletId) {
            const kuno15 = outlets.find(o =>
                o.name.includes('Kuno 15') || o.name.toLowerCase().includes('kuno15')
            );
            setSelectedOutletId(kuno15 ? kuno15.id : outlets[0].id);
        }
    }, [outlets]);

    const getSelectedOutlet = () => outlets.find(o => o.id === selectedOutletId);

    const handleEmployeeLogin = () => {
        const outlet = getSelectedOutlet();
        if (!outlet) {
            toast.error('Bitte wähle ein Outlet aus');
            return;
        }
        localStorage.setItem('user_role', 'employee');
        setOutlet(outlet.id, outlet.name);
        navigate('/Dashboard');
    };

    const handleAdminLogin = () => {
        if (adminPassword === 'Kuno4488!') {
            const outlet = getSelectedOutlet();
            if (!outlet) {
                toast.error('Bitte wähle ein Outlet aus');
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
            <p className="text-slate-500 mb-6">Willkommen — bitte auswählen</p>

            {/* Outlet Selection */}
            <div className="w-full max-w-xl mb-8">
                <label className="block text-sm font-medium text-slate-700 mb-2">Outlet auswählen</label>
                <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
                    <SelectTrigger className="w-full h-11">
                        <SelectValue placeholder="Outlet wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                        {outlets.map(outlet => (
                            <SelectItem key={outlet.id} value={outlet.id}>
                                {outlet.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

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