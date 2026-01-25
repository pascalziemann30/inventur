import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, Shield, User, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Users() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('user');

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list('-created_date')
    });

    // Redirect if not admin
    useEffect(() => {
        if (currentUser && currentUser.role !== 'admin') {
            toast.error('Zugriff verweigert');
            navigate(createPageUrl('Dashboard'));
        }
    }, [currentUser, navigate]);

    const inviteUserMutation = useMutation({
        mutationFn: async ({ email, role }) => {
            await base44.users.inviteUser(email, role);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Einladung versendet');
            setShowInviteDialog(false);
            setInviteEmail('');
            setInviteRole('user');
        },
        onError: (error) => {
            toast.error(error.message || 'Fehler beim Einladen');
        }
    });

    const handleInvite = (e) => {
        e.preventDefault();
        inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole });
    };

    if (!currentUser || currentUser.role !== 'admin') {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Settings')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Benutzerverwaltung
                            </h1>
                            <p className="text-sm text-slate-500">
                                Benutzer einladen und Rollen verwalten
                            </p>
                        </div>
                        <Button 
                            onClick={() => setShowInviteDialog(true)}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Einladen
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Registrierte Benutzer</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold">Name</TableHead>
                                    <TableHead className="font-semibold">E-Mail</TableHead>
                                    <TableHead className="font-semibold">Rolle</TableHead>
                                    <TableHead className="font-semibold">Registriert</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                            Keine Benutzer gefunden
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                                        {user.role === 'admin' ? (
                                                            <Shield className="w-4 h-4 text-amber-600" />
                                                        ) : (
                                                            <User className="w-4 h-4 text-blue-600" />
                                                        )}
                                                    </div>
                                                    <span className="font-medium">{user.full_name || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Mail className="w-4 h-4" />
                                                    {user.email}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant="secondary" 
                                                    className={user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}
                                                >
                                                    {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-600">
                                                {user.created_date ? format(new Date(user.created_date), 'dd.MM.yyyy', { locale: de }) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="mt-6 bg-amber-50 border-amber-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Rollen-Erklärung</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <div className="font-semibold text-amber-900">Administrator</div>
                                    <div className="text-amber-800">
                                        Voller Zugriff: Artikel, Lieferanten, Preise, Auswertungen, Benutzerverwaltung
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <div className="font-semibold text-blue-900">Mitarbeiter</div>
                                    <div className="text-blue-800">
                                        Inventur-Erfassung, Artikel anzeigen (keine Preise), keine Verwaltungsfunktionen
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Invite Dialog */}
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Benutzer einladen</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleInvite} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-Mail-Adresse *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="benutzer@beispiel.de"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Rolle *</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Mitarbeiter</SelectItem>
                                    <SelectItem value="admin">Administrator</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-900">
                            <p className="font-semibold mb-1">Hinweis:</p>
                            <p>Der Benutzer erhält eine E-Mail mit einem Link zur Registrierung.</p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setShowInviteDialog(false)} 
                                className="flex-1"
                            >
                                Abbrechen
                            </Button>
                            <Button 
                                type="submit" 
                                className="flex-1 bg-amber-600 hover:bg-amber-700"
                                disabled={inviteUserMutation.isPending}
                            >
                                {inviteUserMutation.isPending ? 'Wird gesendet...' : 'Einladung senden'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}