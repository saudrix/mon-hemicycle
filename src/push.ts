// Abonnement aux notifications push, via le Worker (dossier worker/).
// L'adresse du Worker est fournie au build : VITE_API_URL=https://mon-hemicycle.<compte>.workers.dev

export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

import type { Depute } from './data';

export type Mode = 'tous' | 'importants';
export type EtatPush =
  | { statut: 'indisponible'; raison: string }
  | { statut: 'a-installer' }
  | { statut: 'refuse' }
  | { statut: 'inactif' }
  | { statut: 'actif'; mode: Mode; suivi: boolean };

const CLE_MODE = 'mon-hemicycle:notifications';
/** « 1 » si l'on veut aussi être prévenu de chaque vote de son député */
const CLE_SUIVI = 'mon-hemicycle:notifications-depute';

const estIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estInstallee = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const estNatif = () => (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

export async function etatPush(): Promise<EtatPush> {
  // Les notifications de l'app native passeront par les services d'Apple et de Google (à venir).
  if (estNatif()) return { statut: 'indisponible', raison: 'Bientôt disponible dans l’application.' };
  if (!API) return { statut: 'indisponible', raison: "Le service de notifications n'est pas configuré." };
  // Sur iPhone, les notifications ne sont proposées qu'à une application ajoutée à l'écran d'accueil.
  if (estIos() && !estInstallee()) return { statut: 'a-installer' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { statut: 'indisponible', raison: 'Ce navigateur ne prend pas en charge les notifications.' };
  }
  if (Notification.permission === 'denied') return { statut: 'refuse' };
  const reg = await navigator.serviceWorker.getRegistration();
  const abonnement = await reg?.pushManager.getSubscription();
  if (!abonnement) return { statut: 'inactif' };
  return { statut: 'actif', mode: (localStorage.getItem(CLE_MODE) as Mode) || 'tous', suivi: localStorage.getItem(CLE_SUIVI) === '1' };
}

async function appel(chemin: string, methode: string, corps: unknown) {
  const res = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!res.ok) throw new Error(`Service de notifications indisponible (${res.status})`);
  return res.json();
}

const suiviDe = (d: Depute | null) => (d ? { id: d.id, nom: `${d.prenom} ${d.nom}` } : undefined);

/** Abonne le téléphone ; avec un député, prévient aussi de chacun de ses votes. */
export async function activer(mode: Mode, depute: Depute | null) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications refusées.');
  const reg = await navigator.serviceWorker.ready;
  const { vapidPublicKey } = await (await fetch(`${API}/api/config`)).json();
  const abonnement =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64url(vapidPublicKey) }));
  await appel('/api/abonnement', 'POST', { abonnement: abonnement.toJSON(), mode, depute: suiviDe(depute) });
  localStorage.setItem(CLE_MODE, mode);
  if (depute) localStorage.setItem(CLE_SUIVI, '1');
  else localStorage.removeItem(CLE_SUIVI);
  return abonnement;
}

/** Après un changement de circonscription : met à jour le député suivi, si l'option est active. */
export async function suivreDepute(depute: Depute | null) {
  const e = await etatPush();
  if (e.statut !== 'actif' || !e.suivi) return;
  const reg = await navigator.serviceWorker.ready;
  const abonnement = await reg.pushManager.getSubscription();
  if (abonnement) await appel('/api/abonnement', 'POST', { abonnement: abonnement.toJSON(), mode: e.mode, depute: suiviDe(depute) });
}

export async function desactiver() {
  const reg = await navigator.serviceWorker.ready;
  const abonnement = await reg.pushManager.getSubscription();
  if (abonnement) {
    await appel('/api/abonnement', 'DELETE', { endpoint: abonnement.endpoint }).catch(() => {});
    await abonnement.unsubscribe();
  }
  localStorage.removeItem(CLE_MODE);
  localStorage.removeItem(CLE_SUIVI);
}

export async function essai() {
  const reg = await navigator.serviceWorker.ready;
  const abonnement = await reg.pushManager.getSubscription();
  if (!abonnement) throw new Error('Notifications non activées.');
  return appel('/api/essai', 'POST', { endpoint: abonnement.endpoint });
}

function base64url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
