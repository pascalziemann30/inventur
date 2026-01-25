import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Users, TrendingUp, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";

export default function Settings() {
    const navigate = useNavigate();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const isAdmin = currentUser?.role === 'admin';

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Dashboard')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Einstellungen
                            </h1>
                            <p className="text-sm text-slate-500">
                                System verwalten & konfigurieren
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Suppliers */}
                    <Card 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate(createPageUrl('Suppliers'))}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Building2 className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Lieferanten</CardTitle>
                                    <CardDescription>Lieferanten verwalten</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600">
                                Lieferanten anlegen, bearbeiten und Kontaktdaten pflegen
                            </p>
                        </CardContent>
                    </Card>

                    {/* Analytics */}
                    <Card 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate(createPageUrl('Analytics'))}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Auswertungen</CardTitle>
                                    <CardDescription>Einkaufs- & Verbrauchsanalyse</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600">
                                Monats- und Jahresauswertungen mit Einkaufspreisen
                            </p>
                        </CardContent>
                    </Card>

                    {/* User Management - Admin Only */}
                    {isAdmin && (
                        <Card 
                            className="cursor-pointer hover:shadow-lg transition-shadow border-amber-200 bg-amber-50/50"
                            onClick={() => navigate(createPageUrl('Users'))}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Users className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            Benutzer
                                            <Lock className="w-4 h-4 text-amber-600" />
                                        </CardTitle>
                                        <CardDescription>Nur für Admins</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600">
                                    Benutzer einladen und Rollen verwalten
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* User Info */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Angemeldeter Benutzer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Name:</span>
                                <span className="font-medium">{currentUser?.full_name || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">E-Mail:</span>
                                <span className="font-medium">{currentUser?.email || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Rolle:</span>
                                <span className={`font-medium ${currentUser?.role === 'admin' ? 'text-amber-600' : 'text-slate-900'}`}>
                                    {currentUser?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}