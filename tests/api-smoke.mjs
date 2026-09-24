import assert from 'node:assert/strict';
import handler from '../api/analyze.js';

const image = 'data:image/jpeg;base64,' + Buffer.from('test image').toString('base64');
const sampleResult = {
  plantVisible: true, status: 'atencion', title: 'Revisa sus hojas', summary: 'Se ven algunas hojas blandas.',
  visibleSigns: ['Hojas blandas'], possibleCauses: ['Podría haber exceso de humedad'],
  firstSteps: ['Revisa si el sustrato está seco'], avoid: ['No riegues de nuevo todavía'],
  outlook: 'Si la humedad continúa, podría empeorar.', recheck: 'Observa la planta en dos días.'
};

function response() {
  return { headers: {}, statusCode: 200, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}

delete process.env.OPENAI_API_KEY;
const general = response();
await handler({ method: 'POST', body: { image } }, general);
assert.equal(general.statusCode, 200);
assert.equal(general.body.mode, 'general');
assert.equal(general.body.result.status, 'general');

process.env.OPENAI_API_KEY = 'test-key';
process.env.SOS_ACCESS_CODE = 'premium';
const denied = response();
await handler({ method: 'POST', body: { image, accessCode: 'wrong' } }, denied);
assert.equal(denied.statusCode, 403);

const invalid = response();
await handler({ method: 'POST', body: { image: 'not-an-image', accessCode: 'premium' } }, invalid);
assert.equal(invalid.statusCode, 400);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  const request = JSON.parse(options.body);
  assert.equal(request.input[0].content[1].type, 'input_image');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.store, false);
  return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(sampleResult) }] }] }) };
};
try {
  const success = response();
  await handler({ method: 'POST', body: { image, accessCode: 'premium', watering: 'Hace 4 a 7 días' } }, success);
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.result.title, sampleResult.title);
  console.log('API: guia geral, código, validação da imagem e resposta personalizada verificados.');
} finally {
  globalThis.fetch = originalFetch;
}
