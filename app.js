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
    showError('Elige una foto JPG, PNG o WEBP.');
    return;
  }
  if (file.size > 10_000_000) {
    showError('La foto pesa más de 10 MB. Elige una imagen más pequeña.');
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
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos abrir esta foto. Prueba con otra imagen.')); };
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
  document.getElementById('result-title').textContent = isGeneral ? 'Cuidados para tu suculenta' : 'Esto es lo que observamos';
  resultContent.replaceChildren();
  const card = document.createElement('article');
  card.className = 'result-card';
  const photo = document.createElement('div');
  photo.className = 'result-photo';
  const image = document.createElement('img');
  image.src = previewUrl;
  image.alt = 'Foto enviada para orientación visual';
  photo.append(image);
  const body = document.createElement('div');
  body.className = 'result-body';
  const status = document.createElement('span');
  status.className = `status-pill ${result.status || 'sin_lectura'}`;
  status.textContent = ({ general: 'CUIDADOS ESENCIALES', bien: 'SE VE BIEN', atencion: 'MERECE ATENCIÓN', urgente: 'REVISA PRONTO', sin_lectura: 'NECESITAMOS OTRA FOTO' })[result.status] || 'ORIENTACIÓN VISUAL';
  const title = document.createElement('h3');
  title.textContent = result.title || 'Tu orientación visual';
  const summary = document.createElement('p');
  summary.textContent = result.summary || 'Revisa la foto y prueba de nuevo.';
  body.append(status, title, summary);
  const grid = document.createElement('div');
  grid.className = 'result-grid';
  const panels = [
    listPanel('LO QUE SE VE EN LA FOTO', result.visibleSigns),
    listPanel('POSIBLES CAUSAS', result.possibleCauses),
    listPanel('QUÉ REVISAR PRIMERO', result.firstSteps, true),
    listPanel('POR AHORA, EVITA', result.avoid),
    textPanel('SI NO AJUSTAS EL CUIDADO', result.outlook),
    textPanel('CUÁNDO VOLVER A REVISAR', result.recheck, true)
  ];
  panels.filter(Boolean).forEach(panel => grid.append(panel));
  body.append(grid);
  if (!isGeneral) {
    const disclaimer = document.createElement('div');
    disclaimer.className = 'result-disclaimer';
    disclaimer.textContent = 'Orientación basada en señales visibles. No es un diagnóstico definitivo.';
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
    showError('Primero sube o toma una foto de tu suculenta.');
    photoInput.focus();
    return;
  }
  button.disabled = true;
  button.querySelector('span:nth-child(2)').textContent = 'PREPARANDO TUS CUIDADOS...';
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
    if (!response.ok) throw new Error(data.error || 'No pudimos analizar tu foto. Inténtalo otra vez.');
    showResult(data.result, data.mode);
  } catch (error) {
    if (error.message === 'El código de acceso no es válido.') document.querySelector('.access-details').open = true;
    showError(error.message === 'Failed to fetch' ? 'No se pudo conectar. Abre el sitio publicado en Vercel o inicia el servidor local.' : error.message);
  } finally {
    button.disabled = false;
    button.querySelector('span:nth-child(2)').textContent = 'VER CÓMO CUIDAR MI SUCULENTA';
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
