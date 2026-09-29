const form = document.getElementById('analysis-form');
const photoInput = document.getElementById('photo');
const dropZone = document.getElementById('drop-zone');
const preview = document.getElementById('photo-preview');
const changePhoto = document.getElementById('change-photo');
const errorBox = document.getElementById('form-error');
const button = document.getElementById('analyze-button');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
let selectedFile = null;
let previewUrl = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function selectPhoto(file) {
  clearError();
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showError('Escolha uma foto JPG, PNG ou WEBP.');
    return;
  }
  if (file.size > 10_000_000) {
    showError('A foto tem mais de 10 MB. Escolha uma imagem menor.');
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  changePhoto.hidden = false;
  dropZone.classList.add('has-photo');
}

photoInput.addEventListener('change', () => selectPhoto(photoInput.files?.[0]));
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', event => {
  event.preventDefault();
  dropZone.classList.remove('drag-over');
  selectPhoto(event.dataTransfer.files?.[0]);
});

async function prepareImage(file) {
  const bitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta foto. Tente outra imagem.')); };
    image.src = url;
  });
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } finally {
    bitmap.close?.();
  }
}

function listPanel(title, items, wide = false) {
  if (!Array.isArray(items) || !items.length) return null;
  const panel = document.createElement('section');
  panel.className = `result-panel${wide ? ' wide' : ''}`;
  const heading = document.createElement('h4');
  heading.textContent = title;
  panel.append(heading);
  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.append(li);
  });
  panel.append(list);
  return panel;
}

function textPanel(title, value, wide = false) {
  if (!value) return null;
  const panel = document.createElement('section');
  panel.className = `result-panel${wide ? ' wide' : ''}`;
  const heading = document.createElement('h4');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = value;
  panel.append(heading, paragraph);
  return panel;
}

function showResult(result, mode) {
  const isGeneral = mode === 'general';
  document.getElementById('result-title').textContent = isGeneral ? 'Cuidados para sua suculenta' : 'Isto é o que observamos';
  resultContent.replaceChildren();
  const card = document.createElement('article');
  card.className = 'result-card';
  const photo = document.createElement('div');
  photo.className = 'result-photo';
  const image = document.createElement('img');
  image.src = previewUrl;
  image.alt = 'Foto enviada para orientação visual';
  photo.append(image);
  const body = document.createElement('div');
  body.className = 'result-body';
  const status = document.createElement('span');
  status.className = `status-pill ${result.status || 'sin_lectura'}`;
  status.textContent = ({ general: 'CUIDADOS ESSENCIAIS', bien: 'PARECE BEM', atencion: 'MERECE ATENÇÃO', urgente: 'REVISE LOGO', sin_lectura: 'PRECISAMOS DE OUTRA FOTO' })[result.status] || 'ORIENTAÇÃO VISUAL';
  const title = document.createElement('h3');
  title.textContent = result.title || 'Sua orientação visual';
  const summary = document.createElement('p');
  summary.textContent = result.summary || 'Revise a foto e tente novamente.';
  body.append(status, title, summary);
  const grid = document.createElement('div');
  grid.className = 'result-grid';
  const panels = [
    listPanel('O QUE APARECE NA FOTO', result.visibleSigns),
    listPanel('POSSÍVEIS CAUSAS', result.possibleCauses),
    listPanel('O QUE REVISAR PRIMEIRO', result.firstSteps, true),
    listPanel('POR ENQUANTO, EVITE', result.avoid),
    textPanel('SE O CUIDADO NÃO FOR AJUSTADO', result.outlook),
    textPanel('QUANDO OBSERVAR NOVAMENTE', result.recheck, true)
  ];
  panels.filter(Boolean).forEach(panel => grid.append(panel));
  body.append(grid);
  if (!isGeneral) {
    const disclaimer = document.createElement('div');
    disclaimer.className = 'result-disclaimer';
    disclaimer.textContent = 'Orientação baseada em sinais visíveis. Não é um diagnóstico definitivo.';
    body.append(disclaimer);
  }
  card.append(photo, body);
  resultContent.append(card);
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();
  if (!selectedFile) {
    showError('Primeiro envie ou tire uma foto da sua suculenta.');
    photoInput.focus();
    return;
  }
  button.disabled = true;
  button.querySelector('span:nth-child(2)').textContent = 'PREPARANDO SUA ORIENTAÇÃO...';
  try {
    const image = await prepareImage(selectedFile);
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        watering: document.getElementById('watering').value,
        light: document.getElementById('light').value,
        drainage: document.getElementById('drainage').value,
        accessCode: document.getElementById('access-code').value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível analisar sua foto. Tente novamente.');
    showResult(data.result, data.mode);
  } catch (error) {
    if (error.message === 'O código de acesso não é válido.') document.querySelector('.access-details').open = true;
    showError(error.message === 'Failed to fetch' ? 'Não foi possível conectar. Abra o site publicado na Vercel ou inicie o servidor local.' : error.message);
  } finally {
    button.disabled = false;
    button.querySelector('span:nth-child(2)').textContent = 'VER COMO CUIDAR DA MINHA SUCULENTA';
  }
});

document.getElementById('new-analysis').addEventListener('click', () => {
  resultSection.hidden = true;
  resultContent.replaceChildren();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  photoInput.value = '';
  preview.removeAttribute('src');
  preview.hidden = true;
  changePhoto.hidden = true;
  dropZone.classList.remove('has-photo');
  clearError();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
