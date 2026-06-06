SERVIFÁCIL V8 - MENU PROFISSIONAL E FLUXO POR TIPO DE USUÁRIO

ServiFácil V7.1 Profissional
Correção: selo de plano/destaque não aparece duplicado nos cards.

SERVIFÁCIL V7 PROFISSIONAL

Implementações principais:
- Firebase Authentication para login e criação de conta.
- Firestore sem salvar senha de usuário.
- Firebase Storage para upload profissional de fotos.
- Fallback local se algum serviço do Firebase não estiver disponível.
- Painel do prestador com edição, pausa/ativação e pedidos.
- Painel admin com aprovação, bloqueio, planos e exclusão.
- Exportação de prestadores, solicitações e avaliações.
- PWA instalável no celular.

IMPORTANTE - O QUE ATIVAR NO FIREBASE:

1) Authentication
- Firebase Console > Segurança/Authentication > Começar
- Método de login > E-mail/senha
- Ativar E-mail/senha
- Salvar

2) Storage
- Firebase Console > Bancos de dados e armazenamento > Storage
- Começar
- Modo de teste para testar
- Criar

3) Firestore
Você já ativou. Pode trocar as regras abertas por regras melhores abaixo.

REGRAS SUGERIDAS DO FIRESTORE:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'admin@servifacil.com';
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }

    match /providers/{providerId} {
      allow read: if true;
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    match /requests/{requestId} {
      allow read: if true;
      allow create: if true;
      allow update: if isSignedIn() || isAdmin();
      allow delete: if isAdmin();
    }

    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if isAdmin();
    }
  }
}

REGRAS SUGERIDAS DO STORAGE:

rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /providers/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'admin@servifacil.com')
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}

ADMIN:
- Entre no app com:
  E-mail: admin@servifacil.com
  Senha: 123456

Na primeira tentativa, se o admin ainda não existir no Firebase Authentication, o app cria automaticamente essa conta.
Depois, entre no Firebase Authentication e troque a senha por uma senha forte.

ATUALIZAÇÃO NO GITHUB:
1. Extraia este ZIP.
2. Substitua os arquivos no repositório GitHub Pages.
3. Faça Commit changes.
4. Aguarde 1 a 2 minutos.
5. Abra o link do app e pressione Ctrl + F5.

OBSERVAÇÃO:
Para uso comercial sério, o ideal é futuramente adicionar Cloud Functions e custom claims para validar admin no servidor. Esta versão já é bem mais profissional que a anterior e suficiente para o MVP público.


V7.2 - Limpeza visual
- Remove informações técnicas da tela inicial.
- Remove selo duplicado de destaque.
- Oculta planos no card público do profissional.
- Exibe visualizações apenas em áreas de gestão.
- Atualiza o cache do PWA para forçar renovação.


V8:
- Aba Cadastrar removida do menu principal.
- Cliente usa o botão Oferecer meus serviços para virar prestador.
- Menu mostra Admin apenas para administradores.
- Menu Minha conta/Dashboard ajustado por perfil.
- Textos do fluxo de cadastro profissionalizados.


V8.3: Corrige salvamento do cadastro de prestador, torna upload de fotos mais tolerante a erro e salva o perfil mesmo se a foto falhar.
