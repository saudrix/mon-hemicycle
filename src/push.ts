// Abonnement aux notifications push, via le Worker (dossier worker/).
// L'adresse du Worker est fournie au build : VITE_API_URL=https://mon-hemicycle.<compte>.workers.dev

export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type Mode = 'tous' | 'importants';
export type EtatPush =
  | { statut: 'indisponible'; raison: string }
  | { statut: 'a-installer' }
  | { statut: 'refuse' }
  | { statut: 'inactif' }
  | { statut: 'actif'; mode: Mode };

const CLE_MODE = 'mon-hemicycle:notifications';

const estIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estInstallee = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export async function etatPush(): Promise<EtatPush> {
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
  return { statut: 'actif', mode: (localStorage.getItem(CLE_MODE) as Mode) || 'tous' };
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

export async function activer(mode: Mode) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications refusées.');
  const reg = await navigator.serviceWorker.ready;
  const { vapidPublicKey } = await (await fetch(`${API}/api/config`)).json();
  const abonnement =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64url(vapidPublicKey) }));
  await appel('/api/abonnement', 'POST', { abonnement: abonnement.toJSON(), mode });
  localStorage.setItem(CLE_MODE, mode);
  return abonnement;
}

export async function desactiver() {
  const reg = await navigator.serviceWorker.ready;
  const abonnement = await reg.pushManager.getSubscription();
  if (abonnement) {
    await appel('/api/abonnement', 'DELETE', { endpoint: abonnement.endpoint }).catch(() => {});
    await abonnement.unsubscribe();
  }
  localStorage.removeItem(CLE_MODE);
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
