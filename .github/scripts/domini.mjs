// Domini autorizzati per l'accesso + accesso con link via email (senza password).
import { GoogleAuth } from 'google-auth-library';
const P = 'courage-magazzino', D = ['courage-magazzino.web.app', 'courage-magazzino.firebaseapp.com', 'simonemanfredaa-glitch.github.io'];
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config`, h = { 'x-goog-user-project': P };
const cfg = (await c.request({ url, headers: h })).data;
const em = (cfg.signIn && cfg.signIn.email) || {};
if (em.enabled && em.passwordRequired === false) console.log('Accesso via email già attivo');
else {
  await c.request({ url: url + '?updateMask=signIn.email.enabled,signIn.email.passwordRequired', method: 'PATCH', headers: h, data: { signIn: { email: { enabled: true, passwordRequired: false } } } });
  console.log('Accesso via email attivato');
}
const att = cfg.authorizedDomains || [], nuovi = D.filter(d => !att.includes(d));
if (!nuovi.length) console.log('Domini già autorizzati');
else {
  await c.request({ url: url + '?updateMask=authorizedDomains', method: 'PATCH', headers: h, data: { authorizedDomains: att.concat(nuovi) } });
  console.log('Domini autorizzati aggiunti:', nuovi.join(', '));
}
