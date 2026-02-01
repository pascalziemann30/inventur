import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Lock, User } from 'lucide-react';
import { useOutlet } from '../components/outlet/OutletContext';
import { toast } from 'sonner';

export default function OutletLogin() {
    const navigate = useNavigate();
    const { setOutlet } = useOutlet();
    const [selectedOutletId, setSelectedOutletId] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list()
    });

    const activeOutlets = outlets.filter(o => o.is_active !== false);

    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!selectedOutletId) {
            toast.error('Bitte Outlet auswählen');
            return;
        }

        if (!username || !password) {
            toast.error('Bitte Name und Passwort eingeben');
            return;
        }

        setLoading(true);

        try {
            // Simple password check (in production, use proper authentication)
            // For now: username = outlet code, password = "admin"
            const selectedOutlet = outlets.find(o => o.id === selectedOutletId);
            
            // Basic validation - replace with real auth later
            if (password === 'admin' || password === selectedOutlet?.code) {
                setOutlet(selectedOutletId, selectedOutlet.name);
                toast.success(`Angemeldet bei ${selectedOutlet.name}`);
                navigate('/Dashboard');
            } else {
                toast.error('Falsches Passwort');
            }
        } catch (error) {
            toast.error('Fehler beim Login: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6975d510bbe0422af7fe76ca/19feb6d1b_ChatGPTImage1Feb202616_14_34.png" 
                        alt="Kolek Schröder Logo" 
                        className="h-20 w-auto mx-auto mb-2"
                    />
                    <CardTitle className="text-2xl">Bestandsverwaltung</CardTitle>
                    <CardDescription>Outlet auswählen und anmelden</CardDescription>
                </CardHeader>
                
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="outlet">Outlet / Standort *</Label>
                            <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
                                <SelectTrigger id="outlet">
                                    <SelectValue placeholder="Outlet wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeOutlets.map(outlet => (
                                        <SelectItem key={outlet.id} value={outlet.id}>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{outlet.name}</span>
                                                <span className="text-xs text-slate-500">({outlet.code})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username">Name *</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Benutzername"
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Passwort *</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full bg-slate-900 hover:bg-slate-800"
                            disabled={loading || !selectedOutletId}
                        >
                            {loading ? 'Anmelden...' : 'Anmelden'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500">
                            Demo: Passwort = "admin" oder Outlet-Code
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}