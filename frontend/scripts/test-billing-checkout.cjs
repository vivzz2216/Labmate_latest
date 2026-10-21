const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/razorpay-checkout.ts'), 'utf8');
const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const sandbox = {exports: {}};
vm.runInNewContext(output, sandbox);
const {checkoutMethods, checkoutFailure} = sandbox.exports;

test('test checkout offers card and mock bank without UPI or default QR blocks', () => {
  const display = checkoutMethods('test').config.display;
  assert.equal(display.preferences.show_default_blocks, false);
  assert.equal(display.hide[0].method, 'upi');
  assert.equal(display.blocks.test_methods.instruments.map(i => i.method).join(','), 'card,netbanking');
  assert.equal(display.sequence.join(','), 'block.test_methods');
});
test('live checkout keeps merchant-enabled payment methods unchanged', () => {
  assert.equal(Object.keys(checkoutMethods('live')).length, 0);
});
test('bank failure preserves the real cause and explains test-mode recovery', () => {
  const message = checkoutFailure({error:{description:'Declined by the bank.'}}, 'test');
  assert.match(message, /Declined by the bank/);
  assert.match(message, /domestic test card/);
  assert.match(message, /Success on the mock bank page/);
  assert.match(message, /cannot pay test QR/);
  assert.match(message, /Check payment status/);
});
test('live failures do not recommend test credentials', () => {
  assert.doesNotMatch(checkoutFailure({error:{description:'Declined.'}}, 'live'), /test card|mock bank|test QR/);
});
test('missing failure details still give actionable recovery', () => {
  assert.match(checkoutFailure(undefined, 'test'), /Razorpay could not complete/);
  assert.match(checkoutFailure({error:{}}, 'live'), /Check payment status/);
});
