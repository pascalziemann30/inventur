/** Verify the record exists through the authorized endpoint both before and after
 * client denial tests. Delete may hide an unreadable record with 404 rather than 403.
 */
export async function checkRunPermissions({entity,loadRun,run,makeId=()=>crypto.randomUUID()}) {
    const before=await loadRun(run.id);
    const checks=[];
    const cases=[
        ['Direktes Lesen gesperrt',[404],()=>entity.get(run.id)],
        ['Direktes Anlegen gesperrt',[403],()=>entity.create({outlet_id:run.outlet_id,actor_id:'client-permission-test',start_key:makeId(),start_fingerprint:'direct-permission-probe',session_date:run.session_date,period_type:run.period_type,status:'draft',revision:0,entries:[],request_receipts:[]})],
        ['Direktes Ändern gesperrt',[403],()=>entity.update(run.id,{status:run.status})],
        ['Direktes Löschen gesperrt',[403,404],()=>entity.delete(run.id)],
    ];
    for (const [name,expected,call] of cases) {
        try {await call();checks.push({name,passed:false});}
        catch(cause){const status=cause.status ?? cause.response?.status;checks.push({name,passed:expected.includes(status),status});}
    }
    try {
        const after=await loadRun(run.id);
        checks.push({name:'Sitzung nach Zugriffstests unverändert vorhanden',passed:after.id === before.id && after.revision === before.revision && after.status === before.status});
    } catch {checks.push({name:'Sitzung nach Zugriffstests unverändert vorhanden',passed:false});}
    return {permission_checks:checks,passed:checks.every(check=>check.passed),scope:'Aktuelles echtes Benutzerkonto; keine simulierte Mitarbeiteranmeldung.'};
}
