// Tests du Worker sans compte Cloudflare :
// 1. lecture de la vraie page des scrutins de l'Assemblée ;
// 2. chiffrement push : un faux navigateur déchiffre le message avec http_ece (implémentation de référence) ;
// 3. signature VAPID vérifiée avec la clé publique.
//   node --experimental-strip-types scripts/test.mjs

import assert from 'node:assert/strict';
import { createECDH, randomBytes, createPublicKey, verify } from 'node:crypto';
import ece from 'http_ece';
import { URL_LISTE, lireListe } from '../src/an.ts';
import { b64url, chiffrer } from '../src/webpush.ts';

// 1. Page réelle
const html = await (await fetch(URL_LISTE)).text();
const liste = lireListe(html);
assert.ok(liste.length >= 40, `seulement ${liste.length} scrutins lus`);
for (const s of liste) {
  assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(s.titre.length > 10);
}
console.log(`✓ ${liste.length} scrutins lus, le dernier :`, liste[0]);
console.log(`  dont ${liste.filter((s) => s.important).length} importants :`, liste.filter((s) => s.important).map((s) => s.num).join(', ') || 'aucun');

// 2. Chiffrement : on joue le rôle du navigateur abonné
const navigateur = createECDH('prime256v1');
navigateur.generateKeys();
const auth = randomBytes(16);
const abonnement = {
  endpoint: 'https://exemple.test/push',
  keys: { p256dh: b64url.encode(navigateur.getPublicKey()), auth: b64url.encode(auth) },
};
const message = { title: 'Adopté', body: 'Scrutin n° 9201 : accents éàç ✓' };
const chiffre = await chiffrer(abonnement, new TextEncoder().encode(JSON.stringify(message)));
const clair = ece.decrypt(Buffer.from(chiffre), { version: 'aes128gcm', privateKey: navigateur, dh: undefined, authSecret: auth });
assert.deepEqual(JSON.parse(clair.toString()), message);
console.log('✓ message push chiffré puis déchiffré par l’implémentation de référence');

// 3. Signature VAPID (même code que le Worker, clé générée à la volée)
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const jwt = await (async () => {
  const mod = await import('../src/webpush.ts');
  // envoyer() appelle fetch : on l'intercepte pour lire l'en-tête Authorization
  let entete = '';
  globalThis.fetch = async (_url, init) => {
    entete = init.headers.Authorization;
    return new Response(null, { status: 201 });
  };
  const statut = await mod.envoyer(abonnement, message, {
    publicKey: b64url.encode(await crypto.subtle.exportKey('raw', publicKey)),
    privateJwk: await crypto.subtle.exportKey('jwk', privateKey),
    sujet: 'https://github.com/',
  });
  assert.equal(statut, 201);
  return entete.match(/t=([^,]+)/)[1];
})();
const [h, c, sig] = jwt.split('.');
const cleVerif = createPublicKey({ key: await crypto.subtle.exportKey('jwk', publicKey), format: 'jwk' });
assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key: cleVerif, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
assert.equal(JSON.parse(Buffer.from(c, 'base64url')).aud, 'https://exemple.test');
console.log('✓ jeton VAPID valide');
