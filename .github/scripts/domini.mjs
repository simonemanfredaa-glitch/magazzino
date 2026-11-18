// Controlla che il sito sia tra i domini autorizzati per l'accesso con Google (e lo aggiunge se manca).
import { GoogleAuth } from 'google-auth-library';
const P = 'courage-magazzino', D = ['simonemanfredaa-glitch.github.io'];
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config`;
try {
  const cfg = (await c.request({ url, headers: { 'x-goog-user-project': P } })).data;
  const att = cfg.authorizedDomains || [], nuovi = D.filter(d => !att.includes(d));
  if (!nuovi.length) console.log('Domini già autorizzati');
  else {
    await c.request({ url: url + '?updateMask=authorizedDomains', method: 'PATCH', headers: { 'x-goog-user-project': P }, data: { authorizedDomains: att.concat(nuovi) } });
    console.log('Domini autorizzati aggiunti:', nuovi.join(', '));
  }
} catch (e) { console.log('Controllo domini non riuscito (non blocca):', e.response ? e.response.status : e.message); }
