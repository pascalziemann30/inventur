// Exact preview hosts for this app only; preview requests remain in development.
export const inventoryPreviewOrigins=['https://preview--6975d510bbe0422af7fe76ca--b-c2d3901.base44.app','https://preview--siftcntrl-bestand.base44.app'];
// Preview hosts carry a build hash that changes with every build. Any host of this app is
// therefore recognised by app id or published name instead of an exact list.
export function inventoryAppOrigin(origin){
 return typeof origin==='string'
  &&/^https:\/\/[a-z0-9.-]+\.base44\.app$/.test(origin)
  &&(origin.includes('6975d510bbe0422af7fe76ca')||origin.includes('siftcntrl-bestand'));
}
// Values are read only on the server. No key or location can be supplied by the browser.
export const locationEntryConfig=secrets=>({issuer:secrets.get('INVENTORY_SHIFT_SOURCE_ID_DEV'),
 launchSecret:secrets.get('INVENTORY_SHIFT_LAUNCH_KEY_DEV'),sessionSecret:secrets.get('INVENTORY_EMPLOYEE_SESSION_KEY_DEV'),
 adminPassword:secrets.get('INVENTORY_ADMIN_PASSWORD'),
 origins:inventoryPreviewOrigins,
});