const MAX_BODY_BYTES = 8_000_000;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const generalGuide = {
  status: 'general',
  title: 'Cuidados para una suculenta sana',
  summary: 'Para mantener tu suculenta saludable, empieza por revisar la luz, el riego y el drenaje de la maceta.',
  visibleSigns: [],
  possibleCauses: [],
  firstSteps: [
    'Déjala en un lugar con mucha luz natural. Si estaba a la sombra, acostúmbrala al sol poco a poco.',
    'Antes de regar, comprueba que el sustrato esté seco. Después, deja que el agua salga por el agujero de la maceta.',
    'Usa una maceta con drenaje y un sustrato ligero que no retenga humedad durante demasiado tiempo.'
  ],
  avoid: [
    'No riegues por calendario sin revisar la tierra.',
    'No dejes agua acumulada debajo de la maceta.'
  ],
  outlook: 'Con buena luz, drenaje y riegos ajustados al estado del sustrato, la planta tiene mejores condiciones para mantenerse firme y crecer.',
  recheck: 'Observa las hojas y la tierra cada pocos días. Si aparecen partes blandas, manchas nuevas o plagas, busca una orientación específica.'
};

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plantVisible: { type: 'boolean' },
    status: { type: 'string', enum: ['bien', 'atencion', 'urgente', 'sin_lectura'] },
    title: { type: 'string' },
    summary: { type: 'string' },
    visibleSigns: { type: 'array', items: { type: 'string' } },
    possibleCauses: { type: 'array', items: { type: 'string' } },
    firstSteps: { type: 'array', items: { type: 'string' } },
    avoid: { type: 'array', items: { type: 'string' } },
    outlook: { type: 'string' },
    recheck: { type: 'string' }
  },
  required: ['plantVisible', 'status', 'title', 'summary', 'visibleSigns', 'possibleCauses', 'firstSteps', 'avoid', 'outlook', 'recheck']
};

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('IMAGE_TOO_LARGE');
  }
  return JSON.parse(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa el botón para enviar una foto.' });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return send(res, error.message === 'IMAGE_TOO_LARGE' ? 413 : 400, { error: 'No pudimos leer la foto. Prueba con otra imagen.' });
  }

  const accessCode = typeof body.accessCode === 'string' ? body.accessCode.trim() : '';
  if (process.env.SOS_ACCESS_CODE && accessCode !== process.env.SOS_ACCESS_CODE) {
    return send(res, 403, { error: 'El código de acceso no es válido.' });
  }

  const image = typeof body.image === 'string' ? body.image : '';
  const match = image.match(IMAGE_PATTERN);
  if (!match) return send(res, 400, { error: 'Envía una foto JPG, PNG o WEBP válida.' });
  if (Buffer.from(match[2], 'base64').length > 5_000_000) {
    return send(res, 413, { error: 'La foto es muy grande. Usa una imagen de hasta 5 MB.' });
  }

  if (!process.env.OPENAI_API_KEY) return send(res, 200, { mode: 'general', result: generalGuide });

  const details = {
    watering: typeof body.watering === 'string' ? body.watering.slice(0, 80) : 'No informado',
    light: typeof body.light === 'string' ? body.light.slice(0, 80) : 'No informado',
    drainage: typeof body.drainage === 'string' ? body.drainage.slice(0, 80) : 'No informado'
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        store: false,
        max_output_tokens: 850,
        instructions: `Eres SOS Suculentas, un asistente de orientación visual para el cuidado de suculentas. Responde SIEMPRE en español latino neutro, de forma cálida, clara, breve y accionable. Observa solamente lo visible en la foto y usa los datos aportados por la persona como contexto, no como prueba. No inventes una especie, enfermedad, plaga o causa con certeza. Si la foto no muestra una suculenta, es borrosa o no permite evaluar su estado, usa status sin_lectura, plantVisible false si corresponde, indica cómo tomar otra foto y deja los demás campos con listas vacías o consejos mínimos. Si parece saludable, usa status bien. Si hay señales visibles que sugieren problemas, usa atencion o urgente según la gravedad observable. En possibleCauses presenta hipótesis prudentes, nunca diagnósticos definitivos. firstSteps debe incluir acciones simples, seguras y ordenadas; no recomendar pesticidas peligrosos, mezclas caseras, trasplantes inmediatos por sistema ni riego sin comprobar el sustrato. outlook explica en términos condicionales qué podría pasar si la causa no se corrige, sin prometer recuperación. recheck dice cuándo observar de nuevo o cuándo buscar ayuda especializada. No uses más de 3 elementos por lista.`,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analiza esta foto de una suculenta. Contexto de la persona: riego: ${details.watering}; luz: ${details.light}; maceta con drenaje: ${details.drainage}. Devuelve una orientación práctica y honesta en el esquema solicitado.` },
          { type: 'input_image', image_url: image, detail: 'high' }
        ] }],
        text: { format: { type: 'json_schema', name: 'sos_suculentas_result', strict: true, schema } }
      })
    });
    if (!response.ok) {
      console.error('OpenAI status:', response.status);
      return send(res, 502, { error: 'No se pudo completar el análisis ahora. Inténtalo de nuevo en unos minutos.' });
    }
    const data = await response.json();
    const output = data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
    if (!output) return send(res, 502, { error: 'No recibimos un resultado completo. Prueba de nuevo con otra foto.' });
    const result = JSON.parse(output);
    return send(res, 200, { result });
  } catch (error) {
    console.error('Analysis error:', error.name || 'Unknown');
    return send(res, 502, { error: 'La conexión tardó demasiado. Inténtalo otra vez.' });
  } finally {
    clearTimeout(timeout);
  }
}
