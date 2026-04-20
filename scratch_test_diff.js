const { applyPatch } = require('rfc6902');

const snapshot = {
  pages: {
    start: {
      blocks: [
        { id: 'b1', content: { label: 'Block 1' } },
        { id: 'b2', content: { label: 'Block 2' } }
      ]
    }
  }
};

const patches = [
  { op: 'remove', path: '/pages/start/blocks/0' } // Removes b1
];

console.log('Original Snapshot:', snapshot.pages.start.blocks.map(b => b.id));

// Simulate acceptPatch
const updated = JSON.parse(JSON.stringify(snapshot));
const results = applyPatch(updated, patches);
console.log('Apply Results:', results);
console.log('Updated Snapshot:', updated.pages.start.blocks.map(b => b.id));

// Now, if we build the review model with (updated, updated, [])
// The originalBlocks will be just ['b2']
// The targetBlocks will be just ['b2']
// The result should not contain 'b1' at all.
