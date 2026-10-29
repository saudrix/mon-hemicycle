// Envoi de notifications Web Push avec la seule Web Crypto API (disponible dans les Workers) :
// authentification VAPID (RFC 8292) et chiffrement du contenu aes128gcm (RFC 8291).

export type Abonnement = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Vapid = { publicKey: string; privateJwk: JsonWebKey; sujet: string };

const enc = new TextEncoder();

export const b64url = {
  encode(buf: ArrayBuffer | Uint8Array) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, longueur: number) {
  const cle = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, cle, longueur * 8));
}

/** Jeton VAPID signé pour le service de push du destinataire. */
async function jetonVapid(endpoint: string, vapid: Vapid) {
  const aud = new URL(endpoint).origin;
  const entete = b64url.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64url.encode(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.sujet })),
  );
  const cle = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(`${entete}.${corps}`));
  return `${entete}.${corps}.${b64url.encode(signature)}`;
}

/** Chiffre le message pour un abonnement (RFC 8291, un seul enregistrement). */
export async function chiffrer(abonnement: Abonnement, message: Uint8Array) {
  const uaPublic = b64url.decode(abonnement.keys.p256dh);
  const authSecret = b64url.decode(abonnement.keys.auth);

  const serveur = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', serveur.publicKey)) as ArrayBuffer);
  const cleClient = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: cleClient } as SubtleCryptoDeriveKeyAlgorithm, serveur.privateKey, 256),
  );

  const ikm = await hkdf(authSecret, secret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const cleAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes, concat(message, new Uint8Array([2]))),
  );

  const taille = new Uint8Array(4);
  new DataView(taille.buffer).setUint32(0, 4096);
  return concat(sel, taille, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

/** Envoie une notification ; renvoie le statut HTTP du service de push (404 / 410 : abonnement expiré). */
export async function envoyer(abonnement: Abonnement, contenu: unknown, vapid: Vapid, ttl = 6 * 3600) {
  const corps = await chiffrer(abonnement, enc.encode(JSON.stringify(contenu)));
  const res = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await jetonVapid(abonnement.endpoint, vapid)}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body: corps,
  });
  return res.status;
}
