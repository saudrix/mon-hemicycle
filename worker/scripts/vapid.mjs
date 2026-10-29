// Génère une paire de clés VAPID pour les notifications push.
// La clé publique va dans wrangler.toml (VAPID_PUBLIC_KEY), la clé privée en secret :
//   node scripts/vapid.mjs
//   npx wrangler secret put VAPID_PRIVATE_JWK   (coller la ligne « privée »)

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const brut = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);

console.log('publique :', Buffer.from(brut).toString('base64url'));
console.log('privée   :', JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
