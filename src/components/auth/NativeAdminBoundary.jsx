import {createContext, useContext} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useLocation} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {checkNativeAdmin} from './adminAccess.js';

const AdminIdentity = createContext(null);
export const useNativeAdminUser = () => useContext(AdminIdentity);
export default function NativeAdminBoundary({children}) {
    const location = useLocation();
    const {data, isPending, isFetching, refetch} = useQuery({
        queryKey: ['native-admin-access', location.pathname],
        queryFn: () => checkNativeAdmin(base44.auth),
        staleTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: 'always',
    });
    if (isPending || isFetching) return <main className="p-8 text-center" role="status">Admin-Berechtigung wird geprüft …</main>;
    if (data?.status === 'allowed') return <AdminIdentity.Provider value={data.user}>{children}</AdminIdentity.Provider>;
    return <main className="max-w-md mx-auto p-8 space-y-4">
        <h1 className="text-xl font-semibold">Geschützter Administratorbereich</h1>
        <p role="alert">{data?.status === 'unavailable' ? 'Die Berechtigung konnte gerade nicht geprüft werden. Bitte erneut versuchen.' : 'Hier ist eine Base44-Anmeldung mit Administratorberechtigung für diese Inventur-App erforderlich.'}</p>
        <button className="border rounded-lg px-4 py-2" onClick={() => base44.auth.redirectToLogin(window.location.href)}>Mit Base44 anmelden</button>
        <button className="border rounded-lg px-4 py-2 ml-2" onClick={() => refetch()}>Erneut prüfen</button>
        <p><Link className="underline" to={`/OutletLogin${location.search}`}>Zur Startauswahl</Link></p>
    </main>;
}
