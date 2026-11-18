// Si assicura che esista il sito Firebase Hosting courage-magazzino.web.app (gratis).
import { GoogleAuth } from 'google-auth-library';
const P = 'courage-magazzino';
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const base = `https://firebasehosting.googleapis.com/v1beta1/projects/${P}/sites`;
const h = { 'x-goog-user-project': P };
const list = (await c.request({ url: base, headers: h })).data.sites || [];
console.log('Siti esistenti:', list.map(s => s.name.split('/').pop()).join(', ') || 'nessuno');
if (!list.some(s => s.name.endsWith('/' + P))) {
  try { await c.request({ url: `${base}?siteId=${P}`, method: 'POST', headers: h, data: {} }); console.log('Sito creato:', P); }
  catch (e) { console.log('Creazione sito non riuscita:', e.response ? JSON.stringify(e.response.data) : e.message); process.exit(1); }
}
