const ADMIN_EMAIL = 'admin@servifacil.com';
const ADMIN_TEST_PASSWORD = '123456';

const categories = [
  { id: 'construcao', name: 'Casa e construção', icon: '🏠' },
  { id: 'beleza', name: 'Beleza e estética', icon: '💇' },
  { id: 'tecnologia', name: 'Tecnologia', icon: '💻' },
  { id: 'aulas', name: 'Aulas e consultorias', icon: '📚' },
  { id: 'servicos-gerais', name: 'Serviços gerais', icon: '🧰' },
  { id: 'entregas', name: 'Entregas e transporte', icon: '🛵' }
];


const planConfig = {
  gratis: {
    name: 'Plano Grátis',
    price: 'R$ 0,00',
    short: 'Perfil básico para começar',
    adminNote: 'Aparece na busca, sem prioridade nos destaques.',
    photoLimit: 0,
    badge: 'Entrada',
    features: ['Perfil público aprovado', 'Contato via WhatsApp para clientes cadastrados', '1 foto principal', 'Sem galeria de trabalhos']
  },
  destaque: {
    name: 'Plano Destaque',
    price: 'R$ 19,90/mês',
    short: 'Mais visibilidade para receber contatos',
    adminNote: 'Plano intermediário: aparece nos destaques, fica acima do grátis e libera galeria com até 3 fotos.',
    photoLimit: 3,
    badge: 'Mais escolhido',
    features: ['Tudo do plano grátis', 'Aparece em Destaques da sua região', 'Prioridade acima do plano grátis', '1 foto principal + até 3 fotos de trabalhos', 'Ideal para quem quer mais visibilidade sem ir para o premium']
  },
  premium: {
    name: 'Plano Premium',
    price: 'R$ 39,90/mês',
    short: 'Prioridade máxima no app',
    adminNote: 'Melhor posição, galeria completa e maior prioridade nas buscas.',
    photoLimit: 10,
    badge: 'Mais completo',
    features: ['Tudo do plano destaque', 'Prioridade máxima na ordenação', 'Mais força nas buscas', '1 foto principal + até 10 fotos de trabalhos', 'Galeria completa para mostrar portfólio']
  }
};

const planOrder = ['gratis', 'destaque', 'premium'];

const sampleProviders = [
  { id:'sample-provider-1', userId:null, name:'João Silva', category:'construcao', city:'São Raimundo Nonato - PI', neighborhood:'Centro', whatsapp:'5589999999999', price:'A partir de R$ 50,00', description:'Eletricista residencial. Faço instalação de tomadas, troca de chuveiro, manutenção em disjuntores e instalação de iluminação.', rating:4.8, ratingCount:12, views:0, plan:'destaque', featured:true, status:'aprovado', active:true, workImages:[], createdAt:new Date().toISOString() },
  { id:'sample-provider-2', userId:null, name:'Maria Designer', category:'tecnologia', city:'São Raimundo Nonato - PI', neighborhood:'Centro', whatsapp:'5589999999999', price:'Artes a partir de R$ 30,00', description:'Criação de artes para Instagram, cartões digitais, logotipos simples e materiais para divulgação.', rating:4.9, ratingCount:8, views:0, plan:'premium', featured:true, status:'aprovado', active:true, workImages:[], createdAt:new Date().toISOString() }
];

const $ = id => document.getElementById(id);
let app = null, db = null, auth = null, storage = null;
let firebaseOnline = false;
let authOnline = false;
let storageOnline = false;
let currentUser = null;
let deferredInstallPrompt = null;

function newId(){ return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function now(){ return new Date().toISOString(); }
function moneySafe(v){ return safeText(v || ''); }
function displayPrice(p){ return p && p.price && String(p.price).trim() ? moneySafe(p.price) : 'Preço sob orçamento'; }
function safeText(value){ return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function categoryName(id){ return categories.find(c => c.id === id)?.name || 'Categoria'; }
function planLabel(plan){ return planConfig[plan]?.name?.replace('Plano ','') || 'Grátis'; }
function planClass(plan){ return plan === 'premium' ? 'premium' : plan === 'destaque' ? 'featured-plan' : 'free-plan'; }
function planFullName(plan){ return planConfig[plan]?.name || 'Plano Grátis'; }
function planPrice(plan){ return planConfig[plan]?.price || 'R$ 0,00'; }
function planSummary(plan){ return planConfig[plan]?.short || 'Perfil básico'; }
function planPhotoLimit(plan){ return Number(planConfig[plan]?.photoLimit ?? 0); }
function planPhotoText(plan){ const limit = planPhotoLimit(plan); return limit ? `1 foto principal + até ${limit} foto${limit>1?'s':''} de trabalhos` : '1 foto principal'; }
function planWeight(p){ const plan = p.plan || (p.featured ? 'destaque':'gratis'); return plan === 'premium' ? 3 : plan === 'destaque' ? 2 : 1; }

function getThreePlans(){
  return [
    ['gratis', planConfig.gratis],
    ['destaque', planConfig.destaque],
    ['premium', planConfig.premium]
  ].filter(([key, plan]) => Boolean(plan));
}

function planCardHtml(key, plan, actionHtml = ''){
  return `<article class="plan-card ${planClass(key)}" data-plan-card="${key}">
    <div class="plan-badge">${safeText(plan.badge || plan.name)}</div>
    <div class="plan-card-head"><strong>${safeText(plan.name)}</strong><span>${safeText(plan.price)}</span></div>
    <p>${safeText(plan.short)}</p>
    <div class="plan-photo-limit">📷 ${safeText(planPhotoText(key))}</div>
    <ul>${plan.features.map(f=>`<li>${safeText(f)}</li>`).join('')}</ul>
    ${actionHtml}
  </article>`;
}

function statusLabel(s){ return s === 'aprovado' ? 'Aprovado' : s === 'bloqueado' ? 'Bloqueado' : 'Pendente'; }
function statusClass(s){ return s === 'aprovado' ? 'approved' : s === 'bloqueado' ? 'blocked' : 'pending'; }
function isAdmin(user = currentUser){ return Boolean(user && (user.role === 'admin' || user.type === 'admin' || String(user.email).toLowerCase() === ADMIN_EMAIL)); }
function isProviderUser(user = currentUser){ return Boolean(user && !isAdmin(user) && (user.role === 'prestador' || user.type === 'prestador')); }
function showToast(message){ const t=$('toast'); t.textContent=message; t.classList.remove('hidden'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.add('hidden'),3500); }
function localGet(key, fallback){ try{ const raw=localStorage.getItem(key); if(!raw){ localStorage.setItem(key,JSON.stringify(fallback)); return fallback; } return JSON.parse(raw); }catch{return fallback;} }
function localSet(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function hasFirebaseConfig(){ const cfg = window.SERVIFACIL_FIREBASE_CONFIG; return cfg && cfg.projectId && window.firebase; }
async function initFirebase(){
  if(!hasFirebaseConfig()){ updateMode(); return; }
  try{
    app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(window.SERVIFACIL_FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth ? firebase.auth() : null;
    storage = firebase.storage ? firebase.storage() : null;
    firebaseOnline = true; authOnline = Boolean(auth); storageOnline = Boolean(storage);
    await seedFirebaseIfEmpty();
    if(authOnline){ auth.onAuthStateChanged(handleAuthState); }
  }catch(err){ console.warn(err); firebaseOnline=false; authOnline=false; storageOnline=false; }
  updateMode();
}
function updateMode(){
  const parts = [];
  parts.push(firebaseOnline ? 'online' : 'local');
  if(authOnline) parts.push('login seguro');
  if(storageOnline) parts.push('fotos');
  $('dataModeBadge').textContent = firebaseOnline ? 'Sistema online' : 'Modo local';
}
async function seedFirebaseIfEmpty(){
  if(!firebaseOnline) return;
  const snap = await db.collection('providers').limit(1).get();
  if(snap.empty){ for(const p of sampleProviders) await db.collection('providers').doc(p.id).set(p); }
}
async function handleAuthState(userCredential){
  if(!userCredential){ currentUser=null; updateSessionUI(); return; }
  const ref = db.collection('users').doc(userCredential.uid);
  const snap = await ref.get();
  if(snap.exists){ currentUser = { id:userCredential.uid, ...snap.data() }; }
  else{
    currentUser = { id:userCredential.uid, name:userCredential.displayName || userCredential.email.split('@')[0], email:userCredential.email, role:String(userCredential.email).toLowerCase()===ADMIN_EMAIL ? 'admin':'cliente', type:String(userCredential.email).toLowerCase()===ADMIN_EMAIL ? 'admin':'cliente', createdAt:now() };
    await ref.set(currentUser, { merge:true });
  }
  updateSessionUI();
  await refreshAll();
  const active=document.querySelector('.active-screen')?.id;
  if(isProviderUser() && (active==='inicio' || active==='buscar' || active==='solicitacoes')) showScreen('painel');
}
function canManageProvider(user = currentUser){ return Boolean(user && (isAdmin(user) || user.role === 'prestador' || user.type === 'prestador')); }
function isClientUser(user = currentUser){ return Boolean(user && !isAdmin(user) && !isProviderUser(user)); }
function requireClientAccount(){
  if(!currentUser){
    showToast('Para falar com o prestador, crie uma conta ou entre no app.');
    showScreen('login');
    return false;
  }
  if(!isClientUser()){
    showToast('O contato com prestadores é exclusivo para clientes cadastrados.');
    showScreen(isAdmin() ? 'admin' : 'painel');
    return false;
  }
  return true;
}
function contactBlock(p, phone, msg){
  if(isClientUser()){
    return `<div class="profile-actions"><a href="https://wa.me/${phone}?text=${msg}" target="_blank" rel="noopener"><button class="whatsapp">Chamar no WhatsApp</button></a><button data-request-for="${p.id}">Pedir orçamento</button></div>`;
  }
  if(!currentUser){
    return `<div class="contact-lock"><strong>Cadastre-se para entrar em contato</strong><p>Para proteger clientes e prestadores, o WhatsApp e o pedido de orçamento ficam disponíveis apenas para usuários cadastrados.</p><button data-go="login">Entrar ou criar conta</button></div>`;
  }
  return `<div class="contact-lock"><strong>Contato disponível para clientes</strong><p>Prestadores e administradores podem visualizar o perfil, mas o contato comercial é liberado apenas para clientes cadastrados.</p></div>`;
}

function updateSessionUI(){
  const badge=$('userBadge'), logout=$('btnLogout'), mode=$('dataModeBadge');
  const adminButton=$('adminTabButton');
  const plansButton=$('plansTabButton');
  const heroLogin=$('heroLoginButton');
  const heroOffer=document.querySelector('[data-go="cadastro"]');
  const tabInicio=document.querySelector('.tabs button[data-screen="inicio"]');
  const tabBuscar=document.querySelector('.tabs button[data-screen="buscar"]');
  const tabPedidos=document.querySelector('.tabs button[data-screen="solicitacoes"]');
  const adminAccess = isAdmin();
  const providerAccess = isProviderUser();

  if(currentUser){
    badge.textContent = adminAccess ? 'Administrador' : `Olá, ${currentUser.name || currentUser.email}`;
    badge.classList.remove('hidden');
    logout.classList.remove('hidden');
    if(heroLogin) heroLogin.classList.add('hidden');
  } else {
    badge.classList.add('hidden');
    logout.classList.add('hidden');
    if(heroLogin) heroLogin.classList.remove('hidden');
  }

  const accountTab=$('accountTabButton');
  if(accountTab) accountTab.textContent = adminAccess ? 'Dashboard' : providerAccess ? 'Meu painel' : 'Minha conta';

  if(heroOffer){
    heroOffer.classList.toggle('hidden', adminAccess);
    heroOffer.textContent = providerAccess ? 'Meu perfil profissional' : 'Oferecer meus serviços';
  }
  const heroSearch=document.querySelector('[data-go="buscar"]');
  if(heroSearch) heroSearch.classList.toggle('hidden', providerAccess);

  if(tabInicio) tabInicio.classList.toggle('hidden', providerAccess);
  if(tabBuscar) tabBuscar.classList.toggle('hidden', providerAccess);
  if(tabPedidos) tabPedidos.classList.toggle('hidden', providerAccess);
  if(adminButton) adminButton.classList.toggle('hidden', !adminAccess);
  if(plansButton) plansButton.classList.toggle('hidden', !(adminAccess || providerAccess));
  if(mode) mode.classList.add('hidden');
}


async function getCollection(name, fallback=[]){
  if(!firebaseOnline) return localGet(name, fallback);
  const snap = await db.collection(name).get();
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}
async function upsertDoc(name, item){
  if(!firebaseOnline){ const list=localGet(name,[]); const idx=list.findIndex(x=>x.id===item.id); idx>=0?list[idx]=item:list.unshift(item); localSet(name,list); return; }
  await db.collection(name).doc(item.id).set(item, { merge:true });
}
async function deleteDoc(name,id){
  if(!firebaseOnline){ localSet(name, localGet(name,[]).filter(x=>x.id!==id)); return; }
  await db.collection(name).doc(id).delete();
}
async function getUsers(){ return getCollection('users', []); }
function normalizeProvider(p){
  const profileImage = p.profileImage || p.profilePhoto || p.photoUrl || p.imageUrl || p.image || p.avatar || '';
  let workImages = Array.isArray(p.workImages) ? p.workImages : (Array.isArray(p.images) ? p.images : (Array.isArray(p.photos) ? p.photos : []));
  workImages = workImages.filter(Boolean);
  return {status:'aprovado', active:true, workImages:[], plan:p.featured?'destaque':'gratis', views:0, ratingCount:0, ...p, profileImage, workImages};
}
async function getProviders(){ return (await getCollection('providers', sampleProviders)).map(normalizeProvider); }
async function getRequests(){ return getCollection('requests', []); }
async function getReviews(){ return getCollection('reviews', []); }
async function approvedProviders(){ return (await getProviders()).filter(p=>p.status==='aprovado' && p.active!==false); }

async function resizeImageToBlob(file, maxWidth=900, quality=.72){
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onerror=()=>reject(new Error('Erro ao ler imagem.')); reader.onload=()=>{ const img=new Image(); img.onerror=()=>reject(new Error('Imagem inválida.')); img.onload=()=>{ const scale=Math.min(1,maxWidth/img.width); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale)); const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Erro ao comprimir imagem.')), 'image/jpeg', quality); }; img.src=reader.result; }; reader.readAsDataURL(file); });
}
async function blobToDataUrl(blob){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onerror=()=>reject(new Error('Erro ao converter imagem.')); reader.onload=()=>resolve(reader.result); reader.readAsDataURL(blob); }); }
async function uploadImage(file, path){
  // Correção V8.1.4: para garantir que a foto apareça no GitHub Pages,
  // salvamos uma versão bem comprimida como Data URL no perfil.
  // Depois podemos voltar ao Firebase Storage quando estiver 100% configurado.
  const blob = await resizeImageToBlob(file, 520, .55);
  return await blobToDataUrl(blob);
}
async function processProviderImages(providerId, existing={}){
  let profileImage = existing.profileImage || '';
  const profileFile = $('profileImage').files?.[0];
  if(profileFile) profileImage = await uploadImage(profileFile, `providers/${currentUser?.id || 'local'}/${providerId}/perfil.jpg`);

  const currentPlan = existing.plan || 'gratis';
  const limit = planPhotoLimit(currentPlan);
  let workImages = Array.isArray(existing.workImages) ? [...existing.workImages].slice(0, limit) : [];
  const selectedFiles = Array.from($('workImages').files || []);

  if(selectedFiles.length && limit <= 0){
    showToast('Seu plano atual permite apenas a foto principal. Para galeria, solicite Destaque ou Premium.');
    workImages = [];
  } else if(selectedFiles.length){
    const files = selectedFiles.slice(0, limit);
    if(selectedFiles.length > limit){
      showToast(`Seu plano permite ${limit} foto${limit>1?'s':''} de trabalhos. As extras foram ignoradas.`);
    }
    workImages = [];
    for(let i=0;i<files.length;i++){
      workImages.push(await uploadImage(files[i], `providers/${currentUser?.id || 'local'}/${providerId}/trabalho-${i+1}.jpg`));
    }
  }

  return { profileImage, workImages };
}
function firstImage(p){ return p.profileImage || (Array.isArray(p.workImages) && p.workImages[0]) || ''; }
function imageTag(src,alt){ return src ? `<img src="${src}" alt="${safeText(alt)}" loading="lazy">` : ''; }
function providerGallery(p){ const imgs=[]; if(p.profileImage) imgs.push(p.profileImage); if(Array.isArray(p.workImages)) imgs.push(...p.workImages.filter(Boolean)); return imgs.length ? `<div class="gallery">${imgs.slice(0,11).map((img,i)=>imageTag(img,`${p.name} foto ${i+1}`)).join('')}</div>` : ''; }

function renderCategories(){
  $('categoryGrid').innerHTML = categories.map(c=>`<div class="category-card" data-cat="${c.id}"><span>${c.icon}</span><strong>${c.name}</strong></div>`).join('');
  const opts = categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('category').innerHTML = '<option value="">Selecione uma categoria</option>'+opts;
  $('categoryFilter').innerHTML = '<option value="">Todas as categorias</option>'+opts;
  $('requestCategory').innerHTML = '<option value="">Selecione uma categoria</option>'+opts;
}
function showScreen(id){
  if(id==='admin' && !isAdmin()){ showToast('Área administrativa restrita.'); id = currentUser ? 'painel' : 'login'; }
  if(id==='planos' && !(isAdmin() || isProviderUser())){ showToast('Os planos são para prestadores de serviço.'); id = currentUser ? 'painel' : 'login'; }
  if(id==='cadastro' && !currentUser){ showToast('Entre ou crie uma conta para oferecer seus serviços.'); id = 'login'; }
  if(id==='solicitacoes' && !currentUser){ showToast('Para pedir orçamento, crie uma conta ou entre no app.'); id = 'login'; }
  if(id==='solicitacoes' && currentUser && !isClientUser()){ showToast('A tela de pedidos é exclusiva para clientes.'); id = isAdmin() ? 'admin' : 'painel'; }
  if(isProviderUser() && (id==='inicio' || id==='buscar' || id==='solicitacoes')){
    id = 'painel';
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active-screen'));
  $(id).classList.add('active-screen');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.screen===id));
  if(id==='buscar') renderProfessionals();
  if(id==='inicio') renderFeatured();
  if(id==='solicitacoes'){ renderRequestProviderOptions(); renderRequests(); fillRequestClient(); }
  if(id==='painel') renderDashboard();
  if(id==='admin') renderAdmin();
  if(id==='planos') renderPlansPage();
  scrollTo({top:0,behavior:'smooth'});
}
function providerBadges(p, admin=false, owner=false){
  const status=p.status||'aprovado';
  const badges=[];
  // No card público removemos selos redundantes. O cliente só precisa ver nome, serviço, cidade e contato.
  if(admin || owner){
    badges.push(`<span class="badge ${planClass(p.plan)}">Plano ${planLabel(p.plan)}</span>`);
    badges.push(`<span class="badge ${statusClass(status)}">${statusLabel(status)}</span>`);
  }
  if(admin && p.planRequest && p.planRequest !== p.plan) badges.push(`<span class="badge pending">Solicitou ${planLabel(p.planRequest)}</span>`);
  if((admin || owner) && p.active===false) badges.push('<span class="badge pending">Pausado</span>');
  return badges.join('');
}
function providerMetaLine(p, admin=false, owner=false){
  const parts=[];
  if(p.rating && Number(p.ratingCount||0)>0) parts.push(`⭐ ${safeText(p.rating)} (${Number(p.ratingCount)} avaliações)`);
  else parts.push('⭐ Sem avaliações ainda');
  parts.push(displayPrice(p));
  if(admin || owner) parts.push(`👁️ ${Number(p.views||0)} visualizações`);
  return parts.join(' • ');
}
function providerCard(p, admin=false, owner=false){
  const thumb=firstImage(p);
  return `<article class="pro-card ${p.active===false?'is-paused':''}">
    <div class="pro-card-main ${thumb?'has-thumb':'no-thumb'}">
      ${thumb?`<div class="card-thumb">${imageTag(thumb,p.name)}</div>`:''}
      <div class="pro-card-content">
        <div class="pro-header"><div><strong>${safeText(p.name)}</strong><p class="muted">${categoryName(p.category)} • ${safeText(p.city)}${p.neighborhood?' • '+safeText(p.neighborhood):''}</p></div><div class="badges">${providerBadges(p,admin,owner)}</div></div>
        <p class="service-desc">${safeText(p.description)}</p>
        <p><span class="rating">${providerMetaLine(p,admin,owner)}</span></p>
        <div class="profile-actions"><button data-profile="${p.id}">Ver detalhes</button>${owner?ownerButtons(p):''}${admin?adminButtons(p):''}</div>
      </div>
    </div>
  </article>`;
}
function ownerButtons(p){ return `<button class="secondary" data-edit="${p.id}">Editar perfil</button><button class="outline" data-toggle-active="${p.id}">${p.active===false?'Ativar perfil':'Pausar perfil'}</button>`; }
function adminButtons(p){ return `${p.status!=='aprovado'?`<button class="success" data-status="${p.id}|aprovado">Aprovar</button>`:''}${p.status!=='bloqueado'?`<button class="danger" data-status="${p.id}|bloqueado">Bloquear</button>`:''}<button class="outline" data-plan="${p.id}|gratis">Definir grátis</button><button class="secondary" data-plan="${p.id}|destaque">Definir destaque</button><button class="success" data-plan="${p.id}|premium">Definir premium</button><button class="danger" data-delete-provider="${p.id}">Excluir</button>`; }
async function renderFeatured(){
  if(isProviderUser()){
    const mine=(await getProviders()).filter(p=>p.userId===currentUser.id);
    $('featuredList').innerHTML=mine.length?mine.map(p=>providerCard(p,false,true)).join(''):'<p class="empty-card muted">Você ainda não cadastrou seu perfil profissional.</p>';
    return;
  }
  const list=(await approvedProviders()).filter(p=>p.featured||p.plan==='destaque'||p.plan==='premium').sort((a,b)=>planWeight(b)-planWeight(a)||Number(b.rating||0)-Number(a.rating||0));
  $('featuredList').innerHTML=list.length?list.map(p=>providerCard(p)).join(''):'<p class="empty-card muted">Nenhum profissional em destaque ainda.</p>';
}
async function renderProfessionals(){
  if(isProviderUser()){
    $('professionalList').innerHTML='<p class="empty-card muted">Use seu painel para gerenciar seu perfil e pedidos.</p>';
    return;
  }
  const text=$('searchText').value.toLowerCase().trim(), city=$('cityFilter').value.toLowerCase().trim(), cat=$('categoryFilter').value, plan=$('planFilter').value, sort=$('sortFilter').value;
  let list=(await approvedProviders()).filter(p=>{ const h=[p.name,p.description,categoryName(p.category)].join(' ').toLowerCase(); const loc=[p.city,p.neighborhood].join(' ').toLowerCase(); const pp=p.plan||(p.featured?'destaque':'gratis'); return (!text||h.includes(text))&&(!city||loc.includes(city))&&(!cat||p.category===cat)&&(!plan||pp===plan); });
  list.sort((a,b)=>{ if(sort==='rating') return Number(b.rating||0)-Number(a.rating||0); if(sort==='views') return Number(b.views||0)-Number(a.views||0); if(sort==='newest') return new Date(b.createdAt||0)-new Date(a.createdAt||0); return planWeight(b)-planWeight(a)||Number(b.featured)-Number(a.featured)||Number(b.rating||0)-Number(a.rating||0); });
  $('professionalList').innerHTML=list.length?list.map(p=>providerCard(p)).join(''):'<p class="empty-card muted">Nenhum profissional encontrado com esses filtros.</p>';
}
async function openProfile(id){
  const all=await getProviders(); const found=all.find(p=>p.id===id); if(!found) return;
  if(isProviderUser() && found.userId !== currentUser.id){ showToast('Como prestador, você acessa apenas seu próprio perfil.'); showScreen('painel'); return; }
  const isOwnerView = currentUser && found.userId === currentUser.id;
  const p=isOwnerView ? {...found} : {...found, views:Number(found.views||0)+1};
  if(!isOwnerView) await upsertDoc('providers',p);
  const reviews=(await getReviews()).filter(r=>r.providerId===p.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const phone=String(p.whatsapp||'').replace(/\D/g,''); const msg=encodeURIComponent(`Olá, vi seu perfil no ServiFácil e gostaria de solicitar um orçamento para: ${categoryName(p.category)}.`);
  const profileBadges = `<span class="badge">${categoryName(p.category)}</span>`;
  const ratingText = p.rating && Number(p.ratingCount||0)>0 ? `⭐ ${safeText(p.rating)} (${Number(p.ratingCount)} avaliação(ões))` : '⭐ Sem avaliações ainda';
  $('profileBox').innerHTML=`<article class="profile-card">${providerGallery(p)}<h2>${safeText(p.name)}</h2><p>${profileBadges}</p><p class="muted">📍 ${safeText(p.city)}${p.neighborhood?' • '+safeText(p.neighborhood):''}</p><p class="rating">${ratingText}</p><h4>Descrição</h4><p>${safeText(p.description)}</p><h4>Preço</h4><p>${displayPrice(p)}</p>${p.photo?`<h4>Link externo</h4><p><a href="${safeText(p.photo)}" target="_blank" rel="noopener">Abrir Instagram, site ou portfólio</a></p>`:''}${contactBlock(p, phone, msg)}<div class="review-box"><h4>Avaliar profissional</h4><div class="review-form"><input id="reviewName" placeholder="Seu nome" value="${currentUser?safeText(currentUser.name):''}"><select id="reviewRating"><option value="5">5 estrelas</option><option value="4">4 estrelas</option><option value="3">3 estrelas</option><option value="2">2 estrelas</option><option value="1">1 estrela</option></select><textarea id="reviewComment" rows="3" placeholder="Comentário sobre o atendimento"></textarea><button data-review="${p.id}">Enviar avaliação</button></div><h4>Avaliações recentes</h4><div>${reviews.length?reviews.map(reviewCard).join(''):'<p class="muted">Nenhuma avaliação ainda.</p>'}</div></div></article>`;
  showScreen('perfil'); renderFeatured();
}
function reviewCard(r){ return `<div class="review-card"><strong>⭐ ${safeText(r.rating)}</strong> <span>${safeText(r.clientName)}</span><p>${safeText(r.comment || 'Sem comentário.')}</p><small class="muted">${new Date(r.createdAt).toLocaleDateString('pt-BR')}</small></div>`; }
async function addReview(providerId){ const name=$('reviewName').value.trim()||'Cliente'; const rating=Number($('reviewRating').value); const comment=$('reviewComment').value.trim(); await upsertDoc('reviews',{id:newId(),providerId,clientName:name,rating,comment,clientUserId:currentUser?.id||null,createdAt:now()}); const reviews=(await getReviews()).filter(r=>r.providerId===providerId); const avg=reviews.reduce((s,r)=>s+Number(r.rating||0),0)/Math.max(1,reviews.length); const p=(await getProviders()).find(x=>x.id===providerId); if(p) await upsertDoc('providers',{...p,rating:Number(avg.toFixed(1)),ratingCount:reviews.length}); await openProfile(providerId); showToast('Avaliação enviada.'); }

async function login(email,password){
  if(authOnline){
    try{ await auth.signInWithEmailAndPassword(email,password); showToast('Login realizado.'); showScreen('painel'); return; }
    catch(err){
      if(email.toLowerCase()===ADMIN_EMAIL && password===ADMIN_TEST_PASSWORD && err.code==='auth/user-not-found'){
        const cred=await auth.createUserWithEmailAndPassword(email,password); const admin={id:cred.user.uid,name:'Administrador',email,role:'admin',type:'admin',createdAt:now()}; await db.collection('users').doc(cred.user.uid).set(admin,{merge:true}); showToast('Admin criado no Firebase Authentication.'); showScreen('admin'); return;
      }
      throw err;
    }
  }
  const users=localGet('users',[{id:'admin-local',name:'Administrador',email:ADMIN_EMAIL,password:ADMIN_TEST_PASSWORD,role:'admin',type:'admin'}]);
  const u=users.find(x=>x.email.toLowerCase()===email.toLowerCase() && x.password===password); if(!u) throw new Error('E-mail ou senha inválidos.'); currentUser=u; updateSessionUI(); showToast('Login local realizado.'); showScreen('painel');
}
async function createAccount(name,email,password,type){
  if(authOnline){ const cred=await auth.createUserWithEmailAndPassword(email,password); await cred.user.updateProfile({displayName:name}); const user={id:cred.user.uid,name,email,role:type,type,createdAt:now()}; await db.collection('users').doc(cred.user.uid).set(user,{merge:true}); currentUser=user; updateSessionUI(); showToast('Conta criada com login seguro.'); showScreen(type==='prestador'?'painel':'painel'); return; }
  const users=localGet('users',[]); if(users.some(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error('E-mail já cadastrado.'); const user={id:newId(),name,email,password,role:type,type,createdAt:now()}; users.push(user); localSet('users',users); currentUser=user; updateSessionUI(); showToast('Conta local criada.'); showScreen(type==='prestador'?'painel':'painel');
}
async function logout(){ if(authOnline) await auth.signOut(); currentUser=null; updateSessionUI(); showToast('Você saiu da conta.'); showScreen('inicio'); }


async function ensureProviderRole(){
  if(!currentUser || isAdmin()) return;
  if(currentUser.role === 'prestador' || currentUser.type === 'prestador') return;
  currentUser = { ...currentUser, role:'prestador', type:'prestador', updatedAt:now() };
  if(firebaseOnline && db){
    await db.collection('users').doc(currentUser.id).set(currentUser, { merge:true });
  } else {
    const users = localGet('users', []);
    const idx = users.findIndex(u => u.id === currentUser.id || String(u.email).toLowerCase() === String(currentUser.email).toLowerCase());
    if(idx >= 0) users[idx] = { ...users[idx], ...currentUser };
    else users.push(currentUser);
    localSet('users', users);
  }
  updateSessionUI();
}

async function saveProvider(event){
  event.preventDefault();
  if(!currentUser){ showToast('Entre na sua conta para cadastrar um serviço.'); showScreen('login'); return; }

  const firebaseUid = (authOnline && auth && auth.currentUser) ? auth.currentUser.uid : null;
  const userId = firebaseUid || currentUser.id;
  if(!userId){ showToast('Erro: usuário sem identificação. Saia e entre novamente.'); return; }
  currentUser = { ...currentUser, id:userId };

  const name = $('name').value.trim();
  const category = $('category').value;
  const city = $('city').value.trim();
  const whatsapp = $('whatsapp').value.trim();
  const description = $('description').value.trim();
  const selectedPlan = $('providerPlan')?.value || 'gratis';

  if(!name || !category || !city || !whatsapp || !description){
    showToast('Preencha nome, categoria, cidade, WhatsApp e descrição.');
    return;
  }

  const editId=$('editingProviderId').value;
  const id=editId || `provider-${userId}`;

  try{
    showToast('Salvando perfil profissional...');

    // Atualiza o usuário para prestador, mas não deixa isso travar o cadastro.
    if(!isAdmin()){
      const updatedUser = { ...currentUser, role:'prestador', type:'prestador', updatedAt:now() };
      try{
        if(firebaseOnline && db){ await db.collection('users').doc(userId).set(updatedUser, { merge:true }); }
        else {
          const users = localGet('users', []);
          const idx = users.findIndex(u => u.id === userId || String(u.email).toLowerCase() === String(currentUser.email).toLowerCase());
          if(idx >= 0) users[idx] = { ...users[idx], ...updatedUser };
          else users.push(updatedUser);
          localSet('users', users);
        }
        currentUser = updatedUser;
        updateSessionUI();
      }catch(userErr){
        console.warn('Não consegui atualizar o tipo do usuário, mas vou tentar salvar o prestador.', userErr);
      }
    }

    const providers = await getProviders();
    const old = providers.find(p=>p.id===editId || p.id===id || p.userId===userId);
    if(old && editId && !isAdmin() && old.userId!==userId){ showToast('Você não tem permissão para editar este perfil.'); return; }

    let imgs={ profileImage: old?.profileImage || '', workImages: Array.isArray(old?.workImages) ? old.workImages : [] };
    try{
      imgs = await processProviderImages(id, old||{});
    }catch(imgErr){
      console.warn('Falha nas imagens. Salvando perfil sem novas fotos.', imgErr);
      showToast('Fotos ignoradas. Salvando os dados do perfil...');
    }

    const item={
      id,
      userId,
      name,
      category,
      city,
      neighborhood:$('neighborhood').value.trim(),
      whatsapp,
      price:$('price').value.trim(),
      description,
      photo:$('photo').value.trim(),
      ...imgs,
      photoUrl:imgs.profileImage || old?.photoUrl || '',
      status:old?.status || (isAdmin()?'aprovado':'pendente'),
      active:old?.active ?? true,
      plan:selectedPlan || old?.plan || 'gratis',
      featured:(selectedPlan === 'destaque' || selectedPlan === 'premium'),
      rating:old?.rating || null,
      ratingCount:old?.ratingCount || 0,
      views:old?.views || 0,
      createdAt:old?.createdAt || now(),
      updatedAt:now()
    };

    if(firebaseOnline && db){
      if(authOnline && !auth.currentUser){ throw new Error('Você não está autenticado no Firebase. Saia e entre novamente.'); }
      await db.collection('providers').doc(id).set(item, { merge:true });
    } else {
      const list=localGet('providers',[]);
      const idx=list.findIndex(x=>x.id===item.id);
      idx>=0?list[idx]=item:list.unshift(item);
      localSet('providers',list);
    }

    cancelProviderEdit(false);
    await refreshAll();
    showToast(editId?'Perfil atualizado.':'Perfil enviado para aprovação.');
    showScreen('painel');
  }catch(err){
    console.error('Erro ao salvar prestador:', err);
    const msg = err?.code === 'permission-denied'
      ? 'Firebase bloqueou o cadastro. Confira as regras do Firestore.'
      : 'Erro ao salvar: ' + (err?.message || err);
    alert(msg);
    showToast(msg);
  }
}
async function editProvider(id){ const p=(await getProviders()).find(x=>x.id===id); if(!p) return; if(!isAdmin() && p.userId!==currentUser?.id){ showToast('Você não tem permissão para editar este perfil.'); return; } $('editingProviderId').value=p.id; $('name').value=p.name||''; $('category').value=p.category||''; $('city').value=p.city||''; $('neighborhood').value=p.neighborhood||''; $('whatsapp').value=p.whatsapp||''; $('price').value=p.price||''; $('description').value=p.description||''; $('providerPlan').value=p.plan || 'gratis'; $('photo').value=p.photo||''; $('providerSubmitButton').textContent='Salvar alterações'; $('cancelEditProvider').classList.remove('hidden'); updateImagePreview(); showScreen('cadastro'); }
function cancelProviderEdit(toast=true){ $('providerForm').reset(); $('editingProviderId').value=''; $('providerSubmitButton').textContent='Cadastrar serviço'; $('cancelEditProvider').classList.add('hidden'); updateImagePreview(); if(toast) showToast('Edição cancelada.'); }
async function toggleProviderActive(id){ const p=(await getProviders()).find(x=>x.id===id); if(!p) return; if(!isAdmin() && p.userId!==currentUser?.id) return showToast('Sem permissão.'); await upsertDoc('providers',{...p,active:p.active===false}); await refreshAll(); showToast(p.active===false?'Perfil ativado.':'Perfil pausado.'); }
async function updateProviderStatus(id,status){ if(!isAdmin()) return showToast('Acesso negado.'); const p=(await getProviders()).find(x=>x.id===id); if(!p) return; await upsertDoc('providers',{...p,status}); await refreshAll(); showToast(`Prestador ${statusLabel(status).toLowerCase()}.`); }
async function updateProviderPlan(id,plan){ if(!isAdmin()) return showToast('Acesso negado.'); const p=(await getProviders()).find(x=>x.id===id); if(!p) return; await upsertDoc('providers',{...p,plan,featured:plan==='destaque'||plan==='premium'}); await refreshAll(); showToast('Plano atualizado para ' + planFullName(plan) + '.'); }
async function deleteProvider(id){ if(!isAdmin()) return showToast('Acesso negado.'); if(!confirm('Excluir este prestador?')) return; await deleteDoc('providers',id); await refreshAll(); showToast('Prestador excluído.'); }

async function renderRequestProviderOptions(){ const providers=await approvedProviders(); $('requestProvider').innerHTML='<option value="">Todos da categoria</option>'+providers.map(p=>`<option value="${p.id}">${safeText(p.name)} - ${safeText(p.city)}</option>`).join(''); }
function fillRequestClient(){ if(currentUser && !$('requestClientName').value) $('requestClientName').value=currentUser.name||''; }
async function saveRequest(event){
  event.preventDefault();
  if(!requireClientAccount()) return;
  const providerId=$('requestProvider').value;
  const provider=providerId?(await getProviders()).find(p=>p.id===providerId):null;
  const clientName=$('requestClientName').value.trim() || currentUser.name || '';
  const phone=$('requestPhone').value.trim();
  const location=$('requestLocation').value.trim();
  const description=$('requestDescription').value.trim();
  if(!$('requestCategory').value || !clientName || !phone || !location || !description){ showToast('Preencha categoria, nome, telefone, localização e descrição.'); return; }
  const req={id:newId(), category:$('requestCategory').value, providerId:providerId||null, providerName:provider?.name||'', clientUserId:currentUser.id, clientName, phone, location, desiredDate:$('requestDate').value, urgency:$('requestUrgency').value, description, status:'Aberto', createdAt:now()};
  await upsertDoc('requests',req);
  $('requestForm').reset();
  fillRequestClient();
  await renderRequests();
  showToast('Solicitação enviada.');
}
async function renderRequests(){
  if(!currentUser){ $('requestList').innerHTML='<p class="empty-card muted">Entre ou crie uma conta para enviar e acompanhar pedidos.</p>'; return; }
  let list=(await getRequests()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(isClientUser()) list=list.filter(r=>r.clientUserId===currentUser.id || String(r.clientName).toLowerCase()===String(currentUser.name).toLowerCase());
  $('requestList').innerHTML=list.length?list.slice(0,10).map(r=>requestCard(r)).join(''):'<p class="empty-card muted">Nenhuma solicitação cadastrada ainda.</p>';
}
function requestCard(r, actions=false){ const phone=String(r.phone||'').replace(/\D/g,''); const msg=encodeURIComponent(`Olá ${r.clientName}, vi sua solicitação no ServiFácil sobre ${categoryName(r.category)}. Posso te passar um orçamento.`); return `<article class="request-card"><strong>${categoryName(r.category)}</strong><div class="request-meta"><span>${safeText(r.location)}</span><span>${safeText(r.status)}</span>${r.urgency?`<span>${safeText(r.urgency)}</span>`:''}${r.desiredDate?`<span>Data: ${new Date(r.desiredDate+'T00:00:00').toLocaleDateString('pt-BR')}</span>`:''}${r.providerName?`<span>Para: ${safeText(r.providerName)}</span>`:'<span>Para todos da categoria</span>'}</div><p>${safeText(r.description)}</p><p class="muted">Cliente: ${safeText(r.clientName)} • ${new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>${actions?`<div class="row-actions"><a href="https://wa.me/${phone}?text=${msg}" target="_blank"><button class="whatsapp">Responder no WhatsApp</button></a><button data-done-request="${r.id}">Marcar atendido</button></div>`:''}</article>`; }
async function markRequestDone(id){ const r=(await getRequests()).find(x=>x.id===id); if(!r) return; await upsertDoc('requests',{...r,status:'Atendido'}); await renderDashboard(); await renderRequests(); showToast('Solicitação marcada como atendida.'); }
function startRequestForProvider(id){ if(!requireClientAccount()) return; $('requestProvider').value=id; showScreen('solicitacoes'); setTimeout(()=>$('requestProvider').value=id,100); }

async function renderDashboard(){
  if(!currentUser){ $('dashboardBox').innerHTML='<div class="empty-card"><p>Entre ou crie uma conta para acessar seu painel.</p><button data-go="login">Entrar agora</button></div>'; return; }
  if(isAdmin()){ $('dashboardBox').innerHTML='<div class="empty-card"><p>Você está como administrador.</p><button data-go="admin">Abrir painel administrativo</button></div>'; return; }
  const requests=await getRequests(), providers=await getProviders();
  if(currentUser.role==='cliente'||currentUser.type==='cliente'){ const mine=requests.filter(r=>r.clientUserId===currentUser.id || String(r.clientName).toLowerCase()===String(currentUser.name).toLowerCase()); $('dashboardBox').innerHTML=`<div class="empty-card"><h4>Minha conta</h4><p class="muted">Acompanhe seus pedidos e seus dados.</p><div class="action-row"><button data-go="solicitacoes">Nova solicitação</button><button class="secondary" data-go="cadastro">Oferecer meus serviços</button></div><h4>Minhas solicitações</h4>${mine.length?mine.map(r=>requestCard(r)).join(''):'<p class="muted">Você ainda não fez solicitações.</p>'}</div>`; return; }
  const myProviders=providers.filter(p=>p.userId===currentUser.id); const myIds=myProviders.map(p=>p.id), myCats=myProviders.map(p=>p.category); const myReq=requests.filter(r=>myIds.includes(r.providerId)||(!r.providerId&&myCats.includes(r.category)));
  $('dashboardBox').innerHTML=myProviders.length?`<div class="stats"><div><strong>${myProviders.length}</strong><span>Perfis</span></div><div><strong>${myReq.length}</strong><span>Pedidos recebidos</span></div><div><strong>${myProviders.filter(p=>p.status==='aprovado').length}</strong><span>Aprovados</span></div><div><strong>${myProviders.reduce((s,p)=>s+Number(p.views||0),0)}</strong><span>Visualizações</span></div></div><h4>Meu plano</h4><div class="plan-status-card"><strong>${planFullName(myProviders[0]?.plan || 'gratis')}</strong><span>${planPrice(myProviders[0]?.plan || 'gratis')}</span><p>${planSummary(myProviders[0]?.plan || 'gratis')}</p>${myProviders[0]?.planRequest?`<p class="muted small">Solicitação enviada: ${planFullName(myProviders[0].planRequest)}</p>`:''}<button class="outline" data-go="planos">Ver planos e benefícios</button></div><h4>Meus perfis</h4><div class="cards">${myProviders.map(p=>providerCard(p,false,true)).join('')}</div><h4>Pedidos para mim</h4><div class="cards">${myReq.length?myReq.map(r=>requestCard(r,true)).join(''):'<p class="empty-card muted">Nenhum pedido recebido ainda.</p>'}</div>`:'<div class="empty-card"><p>Você ainda não cadastrou seu perfil profissional.</p><button data-go="cadastro">Oferecer meus serviços</button></div>';
}

function renderPlanCards(){
  const el=$('planConfigCards');
  if(!el) return;
  el.className = 'plans-three-grid';
  el.innerHTML = getThreePlans().map(([key, plan]) => {
    return planCardHtml(key, plan, `<small>${safeText(plan.adminNote)}</small>`);
  }).join('');
}

async function requestProviderPlan(plan){
  if(!isProviderUser()){
    showToast('Entre como prestador para escolher um plano.');
    showScreen(currentUser ? 'painel' : 'login');
    return;
  }
  const providers = await getProviders();
  const mine = providers.filter(p => p.userId === currentUser.id);
  if(!mine.length){
    showToast('Cadastre seu perfil profissional antes de escolher um plano.');
    showScreen('cadastro');
    return;
  }
  for(const p of mine){ await upsertDoc('providers', { ...p, planRequest: plan, planRequestAt: now() }); }
  showToast(`Solicitação do ${planFullName(plan)} enviada ao administrador.`);
  await renderDashboard();
  await renderPlansPage();
}

async function renderPlansPage(){
  const el=$('plansPageCards');
  if(!el) return;
  el.className = 'plans-three-grid';

  const providers = currentUser ? await getProviders() : [];
  const mine = isProviderUser() ? providers.filter(p => p.userId === currentUser.id) : [];
  const currentPlan = mine[0]?.plan || 'gratis';
  const requestedPlan = mine[0]?.planRequest || '';

  el.innerHTML = getThreePlans().map(([key, plan]) => {
    const isCurrent = isProviderUser() && key === currentPlan;
    const isRequested = isProviderUser() && key === requestedPlan && key !== currentPlan;
    const providerAction = isProviderUser()
      ? `<button class="${key==='premium'?'success':key==='destaque'?'secondary':'outline'}" data-request-plan="${key}" ${isCurrent?'disabled':''}>${isCurrent?'Plano atual':isRequested?'Solicitado':'Quero este plano'}</button>`
      : '';
    return planCardHtml(key, plan, providerAction);
  }).join('');

  const info=$('plansInfoBox');
  if(info){
    if(isProviderUser()){
      info.innerHTML = `<p><strong>Como funciona:</strong> escolha o plano desejado e sua solicitação ficará registrada para o administrador aprovar e combinar o pagamento.</p><p><strong>Plano atual:</strong> ${planFullName(currentPlan)} ${requestedPlan && requestedPlan !== currentPlan ? `• Solicitação pendente: ${planFullName(requestedPlan)}` : ''}</p>`;
    } else if(isAdmin()){
      info.innerHTML = `<p><strong>Administração:</strong> os prestadores visualizam esta tela e podem solicitar um plano. A aprovação continua sendo feita no painel administrativo.</p><button data-go="admin">Gerenciar prestadores</button>`;
    } else {
      info.innerHTML = `<p>Os planos são exclusivos para prestadores de serviço.</p><button data-go="login">Entrar ou criar conta</button>`;
    }
  }
}


async function renderAdmin(){ renderPlanCards(); const providers=await getProviders(), requests=await getRequests(); $('totalProviders').textContent=providers.length; $('pendingProviders').textContent=providers.filter(p=>p.status==='pendente').length; $('totalRequests').textContent=requests.length; $('totalFeatured').textContent=providers.filter(p=>p.featured||p.plan==='destaque'||p.plan==='premium').length; if(!isAdmin()){ $('adminList').innerHTML='<p class="empty-card muted">Acesse com a conta admin para gerenciar o app.</p>'; return; } $('adminList').innerHTML=providers.length?providers.sort((a,b)=>(a.status==='pendente'?-1:1)).map(p=>providerCard(p,true)).join(''):'<p class="empty-card muted">Nenhum prestador cadastrado.</p>'; }

function exportJson(filename,data){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
async function refreshAll(){ await renderCategories(); await renderFeatured(); if($('buscar').classList.contains('active-screen')) await renderProfessionals(); if($('admin').classList.contains('active-screen')) await renderAdmin(); if($('planos') && $('planos').classList.contains('active-screen')) await renderPlansPage(); if($('painel').classList.contains('active-screen')) await renderDashboard(); }
async function updateImagePreview(){
  const profileTotal = $('profileImage')?.files?.length || 0;
  const workTotal = $('workImages')?.files?.length || 0;
  let plan = $('providerPlan')?.value || 'gratis';
  try{
    const editId = $('editingProviderId')?.value || '';
    const providers = currentUser ? await getProviders() : [];
    const p = providers.find(x => x.id === editId || x.userId === currentUser?.id);
    plan = $('providerPlan')?.value || p?.plan || 'gratis';
  }catch(e){}
  const limit = planPhotoLimit(plan);
  const extra = workTotal && workTotal > limit ? ` Seu plano atual permite ${limit} foto${limit>1?'s':''} de trabalhos; as extras serão ignoradas.` : '';
  $('imagePreview').textContent = (profileTotal || workTotal)
    ? `${profileTotal ? '1 foto principal' : 'Sem nova foto principal'} • ${workTotal} foto(s) de trabalhos selecionada(s).${extra}`
    : `Nenhuma nova foto selecionada. Seu plano atual permite: ${planPhotoText(plan)}.`;
}
function clearFilters(){ $('searchText').value=''; $('cityFilter').value=''; $('categoryFilter').value=''; $('planFilter').value=''; $('sortFilter').value='featured'; renderProfessionals(); }

function bindEvents(){
  document.body.addEventListener('click', async e=>{
    const go=e.target.closest('[data-go]')?.dataset.go; if(go){ showScreen(go); return; }
    const screen=e.target.closest('.tabs button')?.dataset.screen; if(screen){ showScreen(screen); return; }
    const cat=e.target.closest('[data-cat]')?.dataset.cat; if(cat){ $('categoryFilter').value=cat; showScreen('buscar'); return; }
    const prof=e.target.closest('[data-profile]')?.dataset.profile; if(prof){ await openProfile(prof); return; }
    const edit=e.target.closest('[data-edit]')?.dataset.edit; if(edit){ await editProvider(edit); return; }
    const active=e.target.closest('[data-toggle-active]')?.dataset.toggleActive; if(active){ await toggleProviderActive(active); return; }
    const status=e.target.closest('[data-status]')?.dataset.status; if(status){ const [id,s]=status.split('|'); await updateProviderStatus(id,s); return; }
    const plan=e.target.closest('[data-plan]')?.dataset.plan; if(plan){ const [id,p]=plan.split('|'); await updateProviderPlan(id,p); return; }
    const requestPlan=e.target.closest('[data-request-plan]')?.dataset.requestPlan; if(requestPlan){ await requestProviderPlan(requestPlan); return; }
    const del=e.target.closest('[data-delete-provider]')?.dataset.deleteProvider; if(del){ await deleteProvider(del); return; }
    const review=e.target.closest('[data-review]')?.dataset.review; if(review){ await addReview(review); return; }
    const reqFor=e.target.closest('[data-request-for]')?.dataset.requestFor; if(reqFor){ startRequestForProvider(reqFor); return; }
    const done=e.target.closest('[data-done-request]')?.dataset.doneRequest; if(done){ await markRequestDone(done); return; }
  });
  $('loginForm').addEventListener('submit', async e=>{ e.preventDefault(); try{ await login($('loginEmail').value.trim(), $('loginPassword').value); e.target.reset(); }catch(err){ showToast(authError(err)); } });
  $('accountForm').addEventListener('submit', async e=>{ e.preventDefault(); try{ await createAccount($('accountName').value.trim(), $('accountEmail').value.trim(), $('accountPassword').value, $('accountType').value); e.target.reset(); }catch(err){ showToast(authError(err)); } });
  $('providerForm').addEventListener('submit', saveProvider);
  $('requestForm').addEventListener('submit', saveRequest);
  $('btnLogout').addEventListener('click', logout);
  $('cancelEditProvider').addEventListener('click', ()=>cancelProviderEdit());
  $('clearFilters').addEventListener('click', clearFilters);
  ['searchText','cityFilter','categoryFilter','planFilter','sortFilter'].forEach(id=>$(id).addEventListener('input', renderProfessionals));
  $('profileImage').addEventListener('change', updateImagePreview); $('workImages').addEventListener('change', updateImagePreview); $('providerPlan').addEventListener('change', updateImagePreview);
  $('exportProviders').addEventListener('click', async()=>exportJson('prestadores-servifacil.json', await getProviders()));
  $('exportRequests').addEventListener('click', async()=>exportJson('solicitacoes-servifacil.json', await getRequests()));
  $('exportReviews').addEventListener('click', async()=>exportJson('avaliacoes-servifacil.json', await getReviews()));
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredInstallPrompt=e; $('btnInstall').classList.remove('hidden'); });
  $('btnInstall').addEventListener('click', async()=>{ if(!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; $('btnInstall').classList.add('hidden'); });
}
function authError(err){ const code=err?.code||''; if(code.includes('email-already-in-use')) return 'Este e-mail já está cadastrado.'; if(code.includes('weak-password')) return 'Use uma senha com pelo menos 6 caracteres.'; if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found')) return 'E-mail ou senha inválidos.'; if(code.includes('operation-not-allowed')) return 'Ative Email/Senha no Firebase Authentication.'; return err?.message || 'Erro ao executar ação.'; }

async function init(){ bindEvents(); renderCategories(); await initFirebase(); await refreshAll(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js').catch(()=>{}); } }
init();
