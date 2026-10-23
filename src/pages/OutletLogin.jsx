import {useState, useEffect} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Users, Lock} from 'lucide-react';
import {base44} from '@/api/base44Client';
import {useOutlet} from '../components/outlet/OutletContext';
import NativeAdminBoundary from '../components/auth/NativeAdminBoundary';
import {selectAdminMode} from '../components/inventory/entry/entryMode.js';

function AdminOutletSelection() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const {setOutlet, currentOutletId} = useOutlet();
    const [selected, setSelected] = useState('');
    const {data: outlets = [], isPending, isError} = useQuery({
        queryKey: ['admin-active-outlets'],
        queryFn: () => base44.entities.Outlet.filter({is_active: true}),
    });
    useEffect(() => {
        selectAdminMode();
        sessionStorage.removeItem('user_role');
    }, []);
    useEffect(() => {
        setSelected(previous => outlets.some(o => o.id === previous) ? previous :
            outlets.some(o => o.id === currentOutletId) ? currentOutletId : outlets.length === 1 ? outlets[0].id : '');
    }, [outlets, currentOutletId]);
    return <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Standort verwalten</h2>
        {isPending ? <p role="status">Standorte werden geladen …</p> : isError ? <p role="alert">Standorte konnten nicht geladen werden.</p> : <>
            <label className="block">Standort<select className="block w-full border rounded-lg p-3 mt-1" value={selected} onChange={event => setSelected(event.target.value)}>
                <option value="">Bitte wählen</option>{outlets.map(outlet => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
            </select></label>
            {!outlets.length && <p>Zurzeit ist kein aktiver Standort eingerichtet.</p>}
            <button className="w-full border rounded-lg p-3" disabled={!selected} onClick={() => {
                const outlet = outlets.find(o => o.id === selected);
                if (!outlet) return;
                setOutlet(outlet.id, outlet.name);
                navigate(`/Dashboard?${params}`);
            }}>Verwaltung öffnen</button>
        </>}
    </section>;
}
export default function OutletLogin() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [showAdmin, setShowAdmin] = useState(false);
    const enterEmployee = () => {
        const next = new URLSearchParams(params);
        next.set('workflow', 'entry');
        next.delete('outlet');
        next.delete('run');
        navigate(`/InventoryCapture?${next}`);
    };
    return <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
            <h1 className="text-xl font-semibold text-center">ShiftCntrl · Inventur</h1>
            <div className="mt-8 grid grid-cols-2 gap-3">
                <button onClick={enterEmployee} className="text-left bg-card border rounded-2xl p-5 space-y-2">
                    <Users aria-hidden="true" className="w-5 h-5"/><strong className="block">Mitarbeiterbereich</strong><span className="block text-sm">Standort aus Shift Control übernehmen</span>
                </button>
                <button onClick={() => setShowAdmin(value => !value)} aria-expanded={showAdmin} className="text-left bg-card border rounded-2xl p-5 space-y-2">
                    <Lock aria-hidden="true" className="w-5 h-5"/><strong className="block">Administratorbereich</strong><span className="block text-sm">Mit Base44-Admin-Anmeldung</span>
                </button>
            </div>
            {showAdmin && <NativeAdminBoundary><AdminOutletSelection/></NativeAdminBoundary>}
        </div>
    </main>;
}
