// Exposés sommaires des amendements : HTML de l'open data ramené à du texte lisible.

import { expect, test } from 'vitest';
// @ts-expect-error module JavaScript des scripts de données, sans types
import { texteBrut } from '../../scripts/textes.mjs';

test('balises retirées, paragraphes conservés, entités décodées', () => {
  expect(texteBrut('<p>Cet amendement vise à&nbsp;supprimer l&rsquo;article.</p><p>Il &laquo;&#160;simplifie&#xA0;&raquo; la loi.</p>')).toBe(
    'Cet amendement vise à supprimer l’article.\nIl « simplifie » la loi.',
  );
});

test('espaces et lignes vides superflus supprimés', () => {
  expect(texteBrut('  <div>Un</div>\n\n\n<br/>  <div>Deux   mots</div> ')).toBe('Un\nDeux mots');
});
