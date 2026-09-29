# SOS Suculentas

Web app em português do Brasil para o Plano Premium do Método Suculenta Rentável. A pessoa envia uma foto e recebe orientações de cuidado. Sem chave da API, o app apresenta um guia geral; com a chave configurada, a função usa a foto e as informações opcionais de luz, rega e drenagem para gerar uma orientação visual individual.

## Publicar pelo GitHub e Vercel

1. Extraia o ZIP e envie todos os arquivos para a raiz de um repositório GitHub.
2. Na Vercel, importe o repositório. Escolha **Other** como framework; deixe o diretório raiz em `./` e sem comando de build.
3. O modo de cuidados gerais funciona imediatamente. Quando quiser ativar a análise individual da foto, em **Settings → Environment Variables**, adicione:
   - `OPENAI_API_KEY`: sua chave da API OpenAI.
   - `SOS_ACCESS_CODE`: um código que você entregará aos compradores do Plano Premium. Esta variável é opcional durante testes, mas recomendada antes de compartilhar o link.
   - `OPENAI_MODEL`: opcional; o padrão é `gpt-4o-mini`.
4. Faça o deploy. Depois de alterar variáveis, faça um novo deploy para aplicá-las.

No modo geral, a foto é enviada à função do próprio projeto para liberar o guia, mas seu conteúdo não é avaliado. As fotos não são gravadas em banco de dados. No modo personalizado, a função envia a foto à API OpenAI. O código de acesso compartilhado é uma proteção simples; se precisar liberar acesso individual por comprador, será necessária uma integração de autenticação/Hotmart.

## Testar no computador

Use Node.js 20 ou superior. Rode `npm run dev` e abra `http://localhost:3000` para testar o modo geral. Para testar a análise individual, crie `.env.local` na pasta do projeto com os valores de `.env.example` antes de iniciar o servidor. Abrir `index.html` com `file://` mostra a interface, mas o resultado precisa do servidor.

## Arquivos

- `index.html`, `styles.css`, `app.js`: interface responsiva.
- `api/analyze.js`: função da Vercel que valida a imagem e consulta a API OpenAI.
- `assets/succulent.webp`: fotografia da abertura.
- `dev-server.js`: servidor local para desenvolvimento.

O resultado é uma orientação de cuidado baseada na foto, não um diagnóstico definitivo. Quando não é possível observar uma suculenta ou a foto está ruim, o app pede outra imagem.
