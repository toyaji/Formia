const { applyPatch } = require('rfc6902');
const formFactor = { pages: { start: { blocks: [] } } };
const patches = [{ op: 'add', path: '/pages/start/blocks/-', value: { id: 'test' } }];
const result = applyPatch(formFactor, patches);
console.log(JSON.stringify(formFactor), result);
