// Controlla se Google accetta il ritorno dell'accesso su courage-magazzino.web.app
import { GoogleAuth } from 'google-auth-library';
const P = 'courage-magazzino';
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const idp = (await c.request({ url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/defaultSupportedIdpConfigs/google.com`, headers: { 'x-goog-user-project': P } })).data;
console.log('Google attivo:', idp.enabled);
for (const host of ['courage-magazzino.firebaseapp.com', 'courage-magazzino.web.app']) {
  const u = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(idp.clientId)}&redirect_uri=${encodeURIComponent('https://' + host + '/__/auth/handler')}&response_type=code&scope=openid%20email`;
  const r = await fetch(u, { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  const body = r.status === 200 ? await r.text() : '';
  const bad = /redirect_uri_mismatch/.test(loc + body);
  console.log(host, '→', r.status, bad ? 'NON AUTORIZZATO' : 'ok', loc.slice(0, 120));
}
