const en = require('./messages/en.json');
const es = require('./messages/es.json');

function getKeys(obj, prefix = '') {
  let keys = [];
  for (let k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys.push(...getKeys(obj[k], prefix ? prefix + '.' + k : k));
    } else {
      keys.push(prefix ? prefix + '.' + k : k);
    }
  }
  return keys;
}

const enKeys = getKeys(en).sort();
const esKeys = getKeys(es).sort();
const missing = enKeys.filter(k => !esKeys.includes(k));
const extra = esKeys.filter(k => !enKeys.includes(k));

console.log('Total EN keys:', enKeys.length);
console.log('Total ES keys:', esKeys.length);
console.log('Missing in ES:', missing.length);
if (missing.length > 0) {
  console.log('First 5 missing:', missing.slice(0, 5));
}
console.log('Extra in ES:', extra.length);
if (extra.length > 0) {
  console.log('First 5 extra:', extra.slice(0, 5));
}
