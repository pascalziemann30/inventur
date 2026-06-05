import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Lock } from 'lucide-react';
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
        queryFn: () => base44.entities.Outlet.list()
    });

    useEffect(() => {
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
        if (!outlet) { toast.error('Bitte wähle ein Outlet aus'); return; }
        localStorage.setItem('user_role', 'employee');
        setOutlet(outlet.id, outlet.name);
        navigate('/Dashboard');
    };

    const handleAdminLogin = () => {
        if (adminPassword === 'Kuno4488!') {
            const outlet = getSelectedOutlet();
            if (!outlet) { toast.error('Bitte wähle ein Outlet aus'); return; }
            localStorage.setItem('user_role', 'admin');
            setOutlet(outlet.id, outlet.name);
            navigate('/Dashboard');
        } else {
            toast.error('Falsches Passwort');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                {/* Title */}
                <div className="text-center">
                    <h1 className="text-lg font-semibold text-foreground">Inventur</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Bestandsverwaltung · Kolek Schröder</p>
                </div>

                {/* Outlet Selection */}
                <div className="mt-8">
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
                        Standort
                    </label>
                    <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
                        <SelectTrigger className="w-full">
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
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* Mitarbeiter */}
                    <div
                        onClick={handleEmployeeLogin}
                        className="bg-card border border-border rounded-2xl p-5 hover:bg-accent transition-colors cursor-pointer"
                    >
                        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center mb-3">
                            <Users className="w-4 h-4 text-primary" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-semibold text-foreground">Mitarbeiter</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Direkt einloggen</p>
                    </div>

                    {/* Administrator */}
                    <div>
                        <div
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="bg-card border border-border rounded-2xl p-5 hover:bg-accent transition-colors cursor-pointer"
                        >
                            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center mb-3">
                                <Lock className="w-4 h-4 text-primary" strokeWidth={1.5} />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Administrator</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Passwort erforderlich</p>
                        </div>

                        {showAdminPassword && (
                            <div className="mt-3 space-y-2">
                                <Input
                                    type="password"
                                    placeholder="Passwort"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                                    autoFocus
                                />
                                <Button
                                    onClick={handleAdminLogin}
                                    className="w-full rounded-xl text-sm"
                                >
                                    Anmelden
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}