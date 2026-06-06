ServiFácil V4 - Marketplace de Serviços Locais

Novidades da versão 4:
- Upload de foto principal do prestador.
- Upload de até 3 fotos de trabalhos realizados.
- As imagens são reduzidas automaticamente antes de salvar.
- Galeria de imagens no perfil público.
- Cartões de profissionais com imagem de destaque.
- Painel do prestador com botão Editar perfil.
- Prestador pode pausar/ativar o próprio perfil.
- Mantém integração Firebase/Firestore já configurada.
- Continua funcionando em modo local caso o Firebase não esteja disponível.

Conta admin de teste:
E-mail: admin@servifacil.com
Senha: 123456

Observação importante:
Nesta versão, as imagens são salvas como texto Base64 dentro do Firestore. Isso funciona bem para testes e MVP, mas para uso grande/profissional o ideal é implementar Firebase Storage.

Como atualizar no GitHub Pages:
1. Extraia este ZIP.
2. Suba/substitua todos os arquivos no repositório do GitHub.
3. Faça commit.
4. Aguarde o GitHub Pages atualizar.
5. No celular, feche e abra o app novamente. Se ainda aparecer a versão antiga, limpe o cache ou atualize a página.


VERSÃO 5 - MELHORIAS IMPLEMENTADAS
- Filtros avançados por texto, cidade/bairro, categoria e plano.
- Ordenação por destaque, avaliação, visualizações e mais recentes.
- Planos do prestador: Grátis, Destaque e Premium.
- Admin pode mudar o plano do prestador pelo painel administrativo.
- Contador de visualizações no perfil do profissional.
- Avaliações dos clientes com nota e comentário.
- Exportação das avaliações em JSON.
- Solicitação de orçamento agora permite informar urgência e data desejada.

Observação: o login ainda é simples para MVP. Para uso público profissional, a próxima etapa recomendada é Firebase Authentication + Firebase Storage.
