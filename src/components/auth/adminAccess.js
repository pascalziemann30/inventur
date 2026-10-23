// This only controls mounting the admin UI. Entity rules and backend handlers remain authoritative.
export function isNativeAdmin(user) {
    return typeof user?.id === 'string' && user.id.length > 0 && user.role === 'admin';
}
export async function checkNativeAdmin(auth) {
    try {
        const user = await auth.me();
        return isNativeAdmin(user) ? {status: 'allowed', user} : {status: 'forbidden'};
    } catch (error) {
        const status = error?.status ?? error?.response?.status;
        return {status: status === 401 ? 'login' : 'unavailable'};
    }
}
export function requiresNativeAdmin(page, search = '') {
    if (page === 'OutletLogin') return false;
    if (page === 'InventoryCapture') {
        const params = new URLSearchParams(search);
        return params.has('diagnostics') || !['entry', 'server', 'scan', 'delivery'].includes(params.get('workflow'));
    }
    return true;
}

export const inventoryDataEnvironment = functionsVersion => typeof functionsVersion === 'string' && functionsVersion.startsWith('branch:') ? 'dev' : 'prod';
