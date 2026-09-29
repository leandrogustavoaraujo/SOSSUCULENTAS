const MAX_BODY_BYTES = 8_000_000;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const generalGuide = {
  status: 'general',
  title: 'Cuidados para uma suculenta saudável',
  summary: 'Para manter sua suculenta saudável, comece observando a luz, a rega e a drenagem do vaso.',
  visibleSigns: [],
  possibleCauses: [],
  firstSteps: [
    'Deixe a planta em um lugar com bastante luz natural. Se ela estava na sombra, acostume-a ao sol aos poucos.',
    'Antes de regar, confirme que o substrato está seco. Depois, deixe a água sair pelo furo do vaso.',
    'Use um vaso com drenagem e um substrato leve, que não retenha umidade por muito tempo.'
  ],
  avoid: [
    'Não regue apenas por calendário sem verificar a terra.',
    'Não deixe água acumulada embaixo do vaso.'
  ],
  outlook: 'Com boa iluminação, drenagem e regas ajustadas ao estado do substrato, a planta terá melhores condições para se manter firme e crescer.',
  recheck: 'Observe as folhas e a terra a cada poucos dias. Se surgirem partes moles, novas manchas ou pragas, procure uma orientação específica.'
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
  if (req.method !== 'POST') return send(res, 405, { error: 'Use o botão para enviar uma foto.' });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return send(res, error.message === 'IMAGE_TOO_LARGE' ? 413 : 400, { error: 'Não foi possível ler a foto. Tente outra imagem.' });
  }

  const accessCode = typeof body.accessCode === 'string' ? body.accessCode.trim() : '';
  if (process.env.SOS_ACCESS_CODE && accessCode !== process.env.SOS_ACCESS_CODE) {
    return send(res, 403, { error: 'O código de acesso não é válido.' });
  }

  const image = typeof body.image === 'string' ? body.image : '';
  const match = image.match(IMAGE_PATTERN);
  if (!match) return send(res, 400, { error: 'Envie uma foto JPG, PNG ou WEBP válida.' });
  if (Buffer.from(match[2], 'base64').length > 5_000_000) {
    return send(res, 413, { error: 'A foto é muito grande. Use uma imagem de até 5 MB.' });
  }

  if (!process.env.OPENAI_API_KEY) return send(res, 200, { mode: 'general', result: generalGuide });

  const details = {
    watering: typeof body.watering === 'string' ? body.watering.slice(0, 80) : 'Não informado',
    light: typeof body.light === 'string' ? body.light.slice(0, 80) : 'Não informado',
    drainage: typeof body.drainage === 'string' ? body.drainage.slice(0, 80) : 'Não informado'
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
        instructions: `Você é o SOS Suculentas, um assistente de orientação visual para o cuidado de suculentas. Responda SEMPRE em português do Brasil, de forma acolhedora, clara, breve e prática. Observe somente o que estiver visível na foto e use os dados fornecidos pela pessoa como contexto, nunca como prova. Não afirme com certeza a espécie, doença, praga ou causa quando a imagem não permitir. Se a foto não mostrar uma suculenta, estiver desfocada ou não permitir avaliar seu estado, use status sin_lectura, plantVisible false quando apropriado, explique como tirar outra foto e mantenha os demais campos com listas vazias ou orientações mínimas. Se a planta parecer saudável, use status bien. Se houver sinais visíveis de problemas, use atencion ou urgente conforme a gravidade observável. Em possibleCauses, apresente hipóteses prudentes, nunca diagnósticos definitivos. firstSteps deve conter ações simples, seguras e ordenadas; não recomende pesticidas perigosos, misturas caseiras, transplante imediato por padrão nem rega sem verificar o substrato. outlook deve explicar de forma condicional o que pode acontecer se a causa não for corrigida, sem prometer recuperação. recheck deve dizer quando observar novamente ou procurar ajuda especializada. Use no máximo 3 itens por lista.`,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analise esta foto de uma suculenta. Contexto informado pela pessoa: rega: ${details.watering}; luz: ${details.light}; vaso com drenagem: ${details.drainage}. Responda com uma orientação prática e honesta no formato solicitado.` },
          { type: 'input_image', image_url: image, detail: 'high' }
        ] }],
        text: { format: { type: 'json_schema', name: 'sos_suculentas_result', strict: true, schema } }
      })
    });
    if (!response.ok) {
      console.error('OpenAI status:', response.status);
      return send(res, 502, { error: 'Não foi possível concluir a análise agora. Tente novamente em alguns minutos.' });
    }
    const data = await response.json();
    const output = data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
    if (!output) return send(res, 502, { error: 'Não recebemos um resultado completo. Tente novamente com outra foto.' });
    const result = JSON.parse(output);
    return send(res, 200, { result });
  } catch (error) {
    console.error('Analysis error:', error.name || 'Unknown');
    return send(res, 502, { error: 'A conexão demorou demais. Tente novamente.' });
  } finally {
    clearTimeout(timeout);
  }
}
