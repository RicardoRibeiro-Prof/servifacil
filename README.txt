SERVIFÁCIL V3 - FIREBASE / FIRESTORE

O que mudou nesta versão:
- O app agora tem uma camada de dados que funciona em dois modos:
  1) Modo Local: salva no aparelho, usando localStorage.
  2) Modo Online Firebase: salva no Firestore, compartilhando dados entre celulares/computadores.
- Se o arquivo firebase-config.js estiver com os dados reais do Firebase, o app entra no modo Online Firebase.
- Se ainda estiver com os textos de exemplo, o app entra automaticamente no modo Local.

COMO CONFIGURAR O FIREBASE

1. Acesse o Firebase Console.
2. Crie um projeto.
3. Dentro do projeto, crie um app Web.
4. Copie as configurações do app Web.
5. Abra o arquivo firebase-config.js.
6. Substitua os valores:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId
7. No Firebase, ative o Firestore Database.
8. Publique o projeto em uma hospedagem, por exemplo:
   - Firebase Hosting
   - GitHub Pages
   - Netlify
   - Vercel

CONTA ADMIN DE TESTE

E-mail: admin@servifacil.com
Senha: 123456

OBSERVAÇÃO IMPORTANTE

Esta versão usa login simples salvo na coleção users do Firestore. Ela é ótima para testar e validar o aplicativo, mas ainda não é o modelo final de segurança para produção.

Para uma versão profissional de verdade, o próximo passo recomendado é implementar:
- Firebase Authentication
- Regras de segurança do Firestore
- Upload de imagens com Firebase Storage
- Painel admin protegido
- Recuperação de senha

REGRAS TEMPORÁRIAS DO FIRESTORE PARA TESTE

Use somente durante desenvolvimento:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

Atenção: essas regras deixam o banco aberto. Não use em produção.
