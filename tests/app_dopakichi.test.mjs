// Costume markup. The shapes are hand-written path data, and the failure modes
// are quiet ones: a mistyped coordinate opens a hairline gap in a band nobody
// looks at closely, and a colour reverting to white is only a lost detail. The
// hachimaki was changed to four flat colour segments (id041-era look), so what is
// checked here is that the four still tile the band's outline exactly.
import test from 'node:test';
import assert from 'node:assert/strict';

// dopakichi.js pulls in core.js, which reads location.search at module load, so
// Node needs that one global before the import can run.
globalThis.location ??= { search: '' };
const { COSTUMES } = await import('../app/js/dopakichi.js');

const NUM = /-?\d+(?:\.\d+)?/g;
// The generated slice format is M Q L Q Z, so the numbers come out as six points
// in a fixed order.
const points = (d) => {
  const n = d.match(NUM).map(Number);
  assert.equal(n.length, 12, `unexpected path shape: ${d}`);
  return {
    topStart: [n[0], n[1]], topCtrl: [n[2], n[3]], topEnd: [n[4], n[5]],
    botStart: [n[6], n[7]], botCtrl: [n[8], n[9]], botEnd: [n[10], n[11]],
  };
};
const hachi = () => COSTUMES.hachimaki.head;

test('the hachimaki band is four flat segments', () => {
  const paths = [...hachi().matchAll(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>/g)];
  const slices = paths.filter(([, d, fill]) => fill !== 'none' && !/^#(fff|ffffff)$/i.test(fill) && d.includes('L'));
  assert.equal(slices.length, 4, 'the band must be four segments');
  const colors = slices.map(([, , fill]) => fill);
  assert.equal(new Set(colors).size, 4, `the four segments must differ: ${colors.join(',')}`);
});

test('the red dot is gone', () => {
  assert.ok(!/ff4f6d/i.test(hachi()), 'the band must not carry the red centre dot');
  assert.ok(!/<circle/.test(hachi()), 'nothing in the hachimaki is a circle any more');
});

test('the tips are coloured too, not left white', () => {
  const tips = [...hachi().matchAll(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>/g)]
    .filter(([, d]) => d.includes('M50') || d.includes('M52'));
  assert.equal(tips.length, 2, 'the two tips must both be drawn');
  for (const [, , fill] of tips) {
    assert.ok(!/^#(fff|ffffff)$/i.test(fill), 'a tip is still white');
  }
});

test('the four segments tile the band outline exactly', () => {
  const paths = [...hachi().matchAll(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>/g)];
  const outline = paths.find(([, , fill]) => fill === 'none');
  assert.ok(outline, 'the band outline (fill="none") must still be there');
  assert.ok(/class="dk-l"/.test(hachi()), 'and must keep its ink stroke');
  const band = outline[1].match(NUM).map(Number);
  // Outline: M(-55,-128) Q(0,-142) (55,-128) L(55,-116) Q(0,-130) (-55,-116) Z
  assert.deepEqual([band[0], band[1]], [-55, -128]);
  assert.deepEqual([band[4], band[5]], [55, -128]);
  assert.deepEqual([band[6], band[7]], [55, -116]);
  assert.deepEqual([band[10], band[11]], [-55, -116]);

  const slices = paths.filter(([, d, fill]) => fill !== 'none' && d.includes('L')).map(([, d]) => points(d));
  // The chain: each segment starts where the last one ended, top and bottom.
  assert.deepEqual(slices[0].topStart, [-55, -128], 'the first segment must start at the band corner');
  assert.deepEqual(slices[0].botEnd, [-55, -116], 'and close on the other corner');
  for (let i = 1; i < slices.length; i++) {
    assert.deepEqual(slices[i].topStart, slices[i - 1].topEnd, `segment ${i + 1} leaves a gap along the top`);
    assert.deepEqual(slices[i].botEnd, slices[i - 1].botStart, `segment ${i + 1} leaves a gap along the bottom`);
  }
  assert.deepEqual(slices[3].topEnd, [55, -128], 'the last segment must reach the far corner');
  assert.deepEqual(slices[3].botStart, [55, -116]);
  // Each segment's own top and bottom must span the same x range, or a segment
  // would be a wedge rather than a slice of the band.
  for (const [i, s] of slices.entries()) {
    assert.equal(s.topStart[0], s.botEnd[0], `segment ${i + 1} is skewed at its left edge`);
    assert.equal(s.topEnd[0], s.botStart[0], `segment ${i + 1} is skewed at its right edge`);
  }
});
