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
function safeText(value){ return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function categoryName(id){ return categories.find(c => c.id === id)?.name || 'Categoria'; }
function planLabel(plan){ return plan === 'premium' ? 'Premium' : plan === 'destaque' ? 'Destaque' : 'Grátis'; }
function planClass(plan){ return plan === 'premium' ? 'premium' : plan === 'destaque' ? 'featured-plan' : 'free-plan'; }
function planWeight(p){ const plan = p.plan || (p.featured ? 'destaque':'gratis'); return plan === 'premium' ? 3 : plan === 'destaque' ? 2 : 1; }
function statusLabel(s){ return s === 'aprovado' ? 'Aprovado' : s === 'bloqueado' ? 'Bloqueado' : 'Pendente'; }
function statusClass(s){ return s === 'aprovado' ? 'approved' : s === 'bloqueado' ? 'blocked' : 'pending'; }
function isAdmin(user = currentUser){ return Boolean(user && (user.role === 'admin' || user.type === 'admin' || String(user.email).toLowerCase() === ADMIN_EMAIL)); }
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
}
function updateSessionUI(){
  const badge=$('userBadge'), logout=$('btnLogout'), mode=$('dataModeBadge');
  if(currentUser){ badge.textContent = `Olá, ${currentUser.name || currentUser.email}`; badge.classList.remove('hidden'); logout.classList.remove('hidden'); }
  else{ badge.classList.add('hidden'); logout.classList.add('hidden'); }
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
async function getProviders(){ return (await getCollection('providers', sampleProviders)).map(p => ({status:'aprovado', active:true, workImages:[], plan:p.featured?'destaque':'gratis', views:0, ratingCount:0, ...p})); }
async function getRequests(){ return getCollection('requests', []); }
async function getReviews(){ return getCollection('reviews', []); }
async function approvedProviders(){ return (await getProviders()).filter(p=>p.status==='aprovado' && p.active!==false); }

async function resizeImageToBlob(file, maxWidth=1000, quality=.76){
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onerror=()=>reject(new Error('Erro ao ler imagem.')); reader.onload=()=>{ const img=new Image(); img.onerror=()=>reject(new Error('Imagem inválida.')); img.onload=()=>{ const scale=Math.min(1,maxWidth/img.width); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale)); const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Erro ao comprimir imagem.')), 'image/jpeg', quality); }; img.src=reader.result; }; reader.readAsDataURL(file); });
}
async function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>resolve(reader.result); reader.readAsDataURL(file); }); }
async function uploadImage(file, path){
  if(storageOnline && currentUser){ const blob = await resizeImageToBlob(file); const ref = storage.ref().child(path); await ref.put(blob, { contentType:'image/jpeg' }); return ref.getDownloadURL(); }
  return fileToDataUrl(file);
}
async function processProviderImages(providerId, existing={}){
  let profileImage = existing.profileImage || '';
  const profileFile = $('profileImage').files?.[0];
  if(profileFile) profileImage = await uploadImage(profileFile, `providers/${currentUser?.id || 'local'}/${providerId}/perfil.jpg`);
  let workImages = Array.isArray(existing.workImages) ? [...existing.workImages] : [];
  const files = Array.from($('workImages').files || []).slice(0,3);
  if(files.length){ workImages = []; for(let i=0;i<files.length;i++) workImages.push(await uploadImage(files[i], `providers/${currentUser?.id || 'local'}/${providerId}/trabalho-${i+1}.jpg`)); }
  return { profileImage, workImages };
}
function firstImage(p){ return p.profileImage || (Array.isArray(p.workImages) && p.workImages[0]) || ''; }
function imageTag(src,alt){ return src ? `<img src="${src}" alt="${safeText(alt)}" loading="lazy">` : ''; }
function providerGallery(p){ const imgs=[]; if(p.profileImage) imgs.push(p.profileImage); if(Array.isArray(p.workImages)) imgs.push(...p.workImages.filter(Boolean)); return imgs.length ? `<div class="gallery">${imgs.slice(0,4).map((img,i)=>imageTag(img,`${p.name} foto ${i+1}`)).join('')}</div>` : ''; }

function renderCategories(){
  $('categoryGrid').innerHTML = categories.map(c=>`<div class="category-card" data-cat="${c.id}"><span>${c.icon}</span><strong>${c.name}</strong></div>`).join('');
  const opts = categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('category').innerHTML = '<option value="">Selecione uma categoria</option>'+opts;
  $('categoryFilter').innerHTML = '<option value="">Todas as categorias</option>'+opts;
  $('requestCategory').innerHTML = '<option value="">Selecione uma categoria</option>'+opts;
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active-screen'));
  $(id).classList.add('active-screen');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.screen===id));
  if(id==='buscar') renderProfessionals();
  if(id==='inicio') renderFeatured();
  if(id==='solicitacoes'){ renderRequestProviderOptions(); renderRequests(); fillRequestClient(); }
  if(id==='painel') renderDashboard();
  if(id==='admin') renderAdmin();
  scrollTo({top:0,behavior:'smooth'});
}
function providerBadges(p, admin=false, owner=false){
  const status=p.status||'aprovado';
  const isBoosted = p.featured || p.plan === 'destaque' || p.plan === 'premium';
  const badges=[];
  if(admin || owner){ badges.push(`<span class="badge ${planClass(p.plan)}">Plano ${planLabel(p.plan)}</span>`); }
  else if(isBoosted){ badges.push('<span class="badge featured-plan">Destaque</span>'); }
  if(p.active===false) badges.push('<span class="badge pending">Pausado</span>');
  if(admin||owner) badges.push(`<span class="badge ${statusClass(status)}">${statusLabel(status)}</span>`);
  return badges.join('');
}
function providerMetaLine(p, admin=false, owner=false){
  const parts=[];
  if(p.rating && Number(p.ratingCount||0)>0) parts.push(`⭐ ${safeText(p.rating)} (${Number(p.ratingCount)} avaliações)`);
  else parts.push('⭐ Sem avaliações ainda');
  if(p.price) parts.push(moneySafe(p.price));
  if(admin || owner) parts.push(`👁️ ${Number(p.views||0)} visualizações`);
  return parts.join(' • ');
}
function providerCard(p, admin=false, owner=false){
  const thumb=firstImage(p);
  return `<article class="pro-card ${p.active===false?'is-paused':''}">
    ${thumb?`<div class="card-thumb">${imageTag(thumb,p.name)}</div>`:''}
    <div class="pro-header"><div><strong>${safeText(p.name)}</strong><p class="muted">${categoryName(p.category)} • ${safeText(p.city)}${p.neighborhood?' • '+safeText(p.neighborhood):''}</p></div><div class="badges">${providerBadges(p,admin,owner)}</div></div>
    <p>${safeText(p.description)}</p>
    <p><span class="rating">${providerMetaLine(p,admin,owner)}</span></p>
    <div class="profile-actions"><button data-profile="${p.id}">Ver perfil</button>${owner?ownerButtons(p):''}${admin?adminButtons(p):''}</div>
  </article>`;
}
function ownerButtons(p){ return `<button class="secondary" data-edit="${p.id}">Editar perfil</button><button class="outline" data-toggle-active="${p.id}">${p.active===false?'Ativar perfil':'Pausar perfil'}</button>`; }
function adminButtons(p){ return `${p.status!=='aprovado'?`<button class="success" data-status="${p.id}|aprovado">Aprovar</button>`:''}${p.status!=='bloqueado'?`<button class="danger" data-status="${p.id}|bloqueado">Bloquear</button>`:''}<button class="outline" data-plan="${p.id}|gratis">Plano grátis</button><button class="secondary" data-plan="${p.id}|destaque">Plano destaque</button><button class="success" data-plan="${p.id}|premium">Plano premium</button><button class="danger" data-delete-provider="${p.id}">Excluir</button>`; }
async function renderFeatured(){ const list=(await approvedProviders()).filter(p=>p.featured||p.plan==='destaque'||p.plan==='premium').sort((a,b)=>planWeight(b)-planWeight(a)||Number(b.rating||0)-Number(a.rating||0)); $('featuredList').innerHTML=list.length?list.map(p=>providerCard(p)).join(''):'<p class="empty-card muted">Nenhum profissional em destaque ainda.</p>'; }
async function renderProfessionals(){
  const text=$('searchText').value.toLowerCase().trim(), city=$('cityFilter').value.toLowerCase().trim(), cat=$('categoryFilter').value, plan=$('planFilter').value, sort=$('sortFilter').value;
  let list=(await approvedProviders()).filter(p=>{ const h=[p.name,p.description,categoryName(p.category)].join(' ').toLowerCase(); const loc=[p.city,p.neighborhood].join(' ').toLowerCase(); const pp=p.plan||(p.featured?'destaque':'gratis'); return (!text||h.includes(text))&&(!city||loc.includes(city))&&(!cat||p.category===cat)&&(!plan||pp===plan); });
  list.sort((a,b)=>{ if(sort==='rating') return Number(b.rating||0)-Number(a.rating||0); if(sort==='views') return Number(b.views||0)-Number(a.views||0); if(sort==='newest') return new Date(b.createdAt||0)-new Date(a.createdAt||0); return planWeight(b)-planWeight(a)||Number(b.featured)-Number(a.featured)||Number(b.rating||0)-Number(a.rating||0); });
  $('professionalList').innerHTML=list.length?list.map(p=>providerCard(p)).join(''):'<p class="empty-card muted">Nenhum profissional encontrado com esses filtros.</p>';
}
async function openProfile(id){
  const all=await getProviders(); const found=all.find(p=>p.id===id); if(!found) return;
  const p={...found, views:Number(found.views||0)+1}; await upsertDoc('providers',p);
  const reviews=(await getReviews()).filter(r=>r.providerId===p.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const phone=String(p.whatsapp||'').replace(/\D/g,''); const msg=encodeURIComponent(`Olá, vi seu perfil no ServiFácil e gostaria de solicitar um orçamento para: ${categoryName(p.category)}.`);
  const profileBadges = `<span class="badge">${categoryName(p.category)}</span>${(p.featured || p.plan==='destaque' || p.plan==='premium') ? ' <span class="badge featured-plan">Destaque</span>' : ''}`;
  const ratingText = p.rating && Number(p.ratingCount||0)>0 ? `⭐ ${safeText(p.rating)} (${Number(p.ratingCount)} avaliação(ões))` : '⭐ Sem avaliações ainda';
  $('profileBox').innerHTML=`<article class="profile-card">${providerGallery(p)}<h2>${safeText(p.name)}</h2><p>${profileBadges}</p><p class="muted">📍 ${safeText(p.city)}${p.neighborhood?' • '+safeText(p.neighborhood):''}</p><p class="rating">${ratingText}</p><h4>Descrição</h4><p>${safeText(p.description)}</p>${p.price?`<h4>Preço inicial</h4><p>${safeText(p.price)}</p>`:''}${p.photo?`<h4>Link externo</h4><p><a href="${safeText(p.photo)}" target="_blank" rel="noopener">Abrir Instagram, site ou portfólio</a></p>`:''}<div class="profile-actions"><a href="https://wa.me/${phone}?text=${msg}" target="_blank" rel="noopener"><button class="whatsapp">Chamar no WhatsApp</button></a><button data-request-for="${p.id}">Solicitar orçamento pelo app</button></div><div class="review-box"><h4>Avaliar profissional</h4><div class="review-form"><input id="reviewName" placeholder="Seu nome" value="${currentUser?safeText(currentUser.name):''}"><select id="reviewRating"><option value="5">5 estrelas</option><option value="4">4 estrelas</option><option value="3">3 estrelas</option><option value="2">2 estrelas</option><option value="1">1 estrela</option></select><textarea id="reviewComment" rows="3" placeholder="Comentário sobre o atendimento"></textarea><button data-review="${p.id}">Enviar avaliação</button></div><h4>Avaliações recentes</h4><div>${reviews.length?reviews.map(reviewCard).join(''):'<p class="muted">Nenhuma avaliação ainda.</p>'}</div></div></article>`;
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
  if(authOnline){ const cred=await auth.createUserWithEmailAndPassword(email,password); await cred.user.updateProfile({displayName:name}); const user={id:cred.user.uid,name,email,role:type,type,createdAt:now()}; await db.collection('users').doc(cred.user.uid).set(user,{merge:true}); currentUser=user; updateSessionUI(); showToast('Conta criada com login seguro.'); showScreen(type==='prestador'?'cadastro':'painel'); return; }
  const users=localGet('users',[]); if(users.some(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error('E-mail já cadastrado.'); const user={id:newId(),name,email,password,role:type,type,createdAt:now()}; users.push(user); localSet('users',users); currentUser=user; updateSessionUI(); showToast('Conta local criada.'); showScreen(type==='prestador'?'cadastro':'painel');
}
async function logout(){ if(authOnline) await auth.signOut(); currentUser=null; updateSessionUI(); showToast('Você saiu da conta.'); showScreen('inicio'); }

async function saveProvider(event){
  event.preventDefault();
  if(!currentUser){ showToast('Entre na sua conta para cadastrar um serviço.'); showScreen('login'); return; }
  if(!(currentUser.role==='prestador'||currentUser.type==='prestador'||isAdmin())){ showToast('Crie uma conta de prestador para oferecer serviços.'); return; }
  const providers=await getProviders(); const editId=$('editingProviderId').value; const old=providers.find(p=>p.id===editId); const id=editId||newId();
  if(old && !isAdmin() && old.userId!==currentUser.id){ showToast('Você não tem permissão para editar este perfil.'); return; }
  showToast('Salvando perfil e fotos...');
  const imgs=await processProviderImages(id, old||{});
  const item={ id, userId:old?.userId||currentUser.id, name:$('name').value.trim(), category:$('category').value, city:$('city').value.trim(), neighborhood:$('neighborhood').value.trim(), whatsapp:$('whatsapp').value.trim(), price:$('price').value.trim(), description:$('description').value.trim(), photo:$('photo').value.trim(), ...imgs, status:old?.status || (isAdmin()?'aprovado':'pendente'), active:old?.active ?? true, plan:old?.plan || 'gratis', featured:old?.featured || false, rating:old?.rating || null, ratingCount:old?.ratingCount || 0, views:old?.views || 0, createdAt:old?.createdAt || now(), updatedAt:now() };
  await upsertDoc('providers', item); cancelProviderEdit(false); await refreshAll(); showToast(editId?'Perfil atualizado.':'Cadastro enviado para aprovação.'); showScreen('painel');
}
async function editProvider(id){ const p=(await getProviders()).find(x=>x.id===id); if(!p) return; if(!isAdmin() && p.userId!==currentUser?.id){ showToast('Você não tem permissão para editar este perfil.'); return; } $('editingProviderId').value=p.id; $('name').value=p.name||''; $('category').value=p.category||''; $('city').value=p.city||''; $('neighborhood').value=p.neighborhood||''; $('whatsapp').value=p.whatsapp||''; $('price').value=p.price||''; $('description').value=p.description||''; $('photo').value=p.photo||''; $('providerSubmitButton').textContent='Salvar alterações'; $('cancelEditProvider').classList.remove('hidden'); updateImagePreview(); showScreen('cadastro'); }
function cancelProviderEdit(toast=true){ $('providerForm').reset(); $('editingProviderId').value=''; $('providerSubmitButton').textContent='Cadastrar serviço'; $('cancelEditProvider').classList.add('hidden'); updateImagePreview(); if(toast) showToast('Edição cancelada.'); }
async function toggleProviderActive(id){ const p=(await getProviders()).find(x=>x.id===id); if(!p) return; if(!isAdmin() && p.userId!==currentUser?.id) return showToast('Sem permissão.'); await upsertDoc('providers',{...p,active:p.active===false}); await refreshAll(); showToast(p.active===false?'Perfil ativado.':'Perfil pausado.'); }
async function updateProviderStatus(id,status){ if(!isAdmin()) return showToast('Acesso negado.'); const p=(await getProviders()).find(x=>x.id===id); if(!p) return; await upsertDoc('providers',{...p,status}); await refreshAll(); showToast(`Prestador ${statusLabel(status).toLowerCase()}.`); }
async function updateProviderPlan(id,plan){ if(!isAdmin()) return showToast('Acesso negado.'); const p=(await getProviders()).find(x=>x.id===id); if(!p) return; await upsertDoc('providers',{...p,plan,featured:plan==='destaque'||plan==='premium'}); await refreshAll(); showToast('Plano atualizado.'); }
async function deleteProvider(id){ if(!isAdmin()) return showToast('Acesso negado.'); if(!confirm('Excluir este prestador?')) return; await deleteDoc('providers',id); await refreshAll(); showToast('Prestador excluído.'); }

async function renderRequestProviderOptions(){ const providers=await approvedProviders(); $('requestProvider').innerHTML='<option value="">Todos da categoria</option>'+providers.map(p=>`<option value="${p.id}">${safeText(p.name)} - ${safeText(p.city)}</option>`).join(''); }
function fillRequestClient(){ if(currentUser && !$('requestClientName').value) $('requestClientName').value=currentUser.name||''; }
async function saveRequest(event){ event.preventDefault(); const providerId=$('requestProvider').value; const provider=providerId?(await getProviders()).find(p=>p.id===providerId):null; const req={id:newId(), category:$('requestCategory').value, providerId:providerId||null, providerName:provider?.name||'', clientUserId:currentUser?.id||null, clientName:$('requestClientName').value.trim(), phone:$('requestPhone').value.trim(), location:$('requestLocation').value.trim(), desiredDate:$('requestDate').value, urgency:$('requestUrgency').value, description:$('requestDescription').value.trim(), status:'Aberto', createdAt:now()}; await upsertDoc('requests',req); $('requestForm').reset(); await renderRequests(); showToast('Solicitação enviada.'); }
async function renderRequests(){ const list=(await getRequests()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); $('requestList').innerHTML=list.length?list.slice(0,10).map(r=>requestCard(r)).join(''):'<p class="empty-card muted">Nenhuma solicitação cadastrada ainda.</p>'; }
function requestCard(r, actions=false){ const phone=String(r.phone||'').replace(/\D/g,''); const msg=encodeURIComponent(`Olá ${r.clientName}, vi sua solicitação no ServiFácil sobre ${categoryName(r.category)}. Posso te passar um orçamento.`); return `<article class="request-card"><strong>${categoryName(r.category)}</strong><div class="request-meta"><span>${safeText(r.location)}</span><span>${safeText(r.status)}</span>${r.urgency?`<span>${safeText(r.urgency)}</span>`:''}${r.desiredDate?`<span>Data: ${new Date(r.desiredDate+'T00:00:00').toLocaleDateString('pt-BR')}</span>`:''}${r.providerName?`<span>Para: ${safeText(r.providerName)}</span>`:'<span>Para todos da categoria</span>'}</div><p>${safeText(r.description)}</p><p class="muted">Cliente: ${safeText(r.clientName)} • ${new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>${actions?`<div class="row-actions"><a href="https://wa.me/${phone}?text=${msg}" target="_blank"><button class="whatsapp">Responder no WhatsApp</button></a><button data-done-request="${r.id}">Marcar atendido</button></div>`:''}</article>`; }
async function markRequestDone(id){ const r=(await getRequests()).find(x=>x.id===id); if(!r) return; await upsertDoc('requests',{...r,status:'Atendido'}); await renderDashboard(); await renderRequests(); showToast('Solicitação marcada como atendida.'); }
function startRequestForProvider(id){ $('requestProvider').value=id; showScreen('solicitacoes'); setTimeout(()=>$('requestProvider').value=id,100); }

async function renderDashboard(){
  if(!currentUser){ $('dashboardBox').innerHTML='<div class="empty-card"><p>Entre ou crie uma conta para acessar seu painel.</p><button data-go="login">Entrar agora</button></div>'; return; }
  if(isAdmin()){ $('dashboardBox').innerHTML='<div class="empty-card"><p>Você está como administrador.</p><button data-go="admin">Abrir painel administrativo</button></div>'; return; }
  const requests=await getRequests(), providers=await getProviders();
  if(currentUser.role==='cliente'||currentUser.type==='cliente'){ const mine=requests.filter(r=>r.clientUserId===currentUser.id || String(r.clientName).toLowerCase()===String(currentUser.name).toLowerCase()); $('dashboardBox').innerHTML=`<div class="empty-card"><h4>Minhas solicitações</h4>${mine.length?mine.map(r=>requestCard(r)).join(''):'<p class="muted">Você ainda não fez solicitações.</p>'}<button data-go="solicitacoes">Nova solicitação</button></div>`; return; }
  const myProviders=providers.filter(p=>p.userId===currentUser.id); const myIds=myProviders.map(p=>p.id), myCats=myProviders.map(p=>p.category); const myReq=requests.filter(r=>myIds.includes(r.providerId)||(!r.providerId&&myCats.includes(r.category)));
  $('dashboardBox').innerHTML=myProviders.length?`<div class="stats"><div><strong>${myProviders.length}</strong><span>Perfis</span></div><div><strong>${myReq.length}</strong><span>Pedidos recebidos</span></div><div><strong>${myProviders.filter(p=>p.status==='aprovado').length}</strong><span>Aprovados</span></div><div><strong>${myProviders.reduce((s,p)=>s+Number(p.views||0),0)}</strong><span>Visualizações</span></div></div><h4>Meus perfis</h4><div class="cards">${myProviders.map(p=>providerCard(p,false,true)).join('')}</div><h4>Pedidos para mim</h4><div class="cards">${myReq.length?myReq.map(r=>requestCard(r,true)).join(''):'<p class="empty-card muted">Nenhum pedido recebido ainda.</p>'}</div>`:'<div class="empty-card"><p>Você ainda não cadastrou seu perfil profissional.</p><button data-go="cadastro">Cadastrar serviço</button></div>';
}
async function renderAdmin(){ const providers=await getProviders(), requests=await getRequests(); $('totalProviders').textContent=providers.length; $('pendingProviders').textContent=providers.filter(p=>p.status==='pendente').length; $('totalRequests').textContent=requests.length; $('totalFeatured').textContent=providers.filter(p=>p.featured||p.plan==='destaque'||p.plan==='premium').length; if(!isAdmin()){ $('adminList').innerHTML='<p class="empty-card muted">Acesse com a conta admin para gerenciar o app.</p>'; return; } $('adminList').innerHTML=providers.length?providers.sort((a,b)=>(a.status==='pendente'?-1:1)).map(p=>providerCard(p,true)).join(''):'<p class="empty-card muted">Nenhum prestador cadastrado.</p>'; }

function exportJson(filename,data){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
async function refreshAll(){ await renderCategories(); await renderFeatured(); if($('buscar').classList.contains('active-screen')) await renderProfessionals(); if($('admin').classList.contains('active-screen')) await renderAdmin(); if($('painel').classList.contains('active-screen')) await renderDashboard(); }
function updateImagePreview(){ const total=($('profileImage')?.files?.length||0)+($('workImages')?.files?.length||0); $('imagePreview').textContent=total?`${total} nova(s) foto(s) selecionada(s).`:'Nenhuma nova foto selecionada.'; }
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
  $('profileImage').addEventListener('change', updateImagePreview); $('workImages').addEventListener('change', updateImagePreview);
  $('exportProviders').addEventListener('click', async()=>exportJson('prestadores-servifacil.json', await getProviders()));
  $('exportRequests').addEventListener('click', async()=>exportJson('solicitacoes-servifacil.json', await getRequests()));
  $('exportReviews').addEventListener('click', async()=>exportJson('avaliacoes-servifacil.json', await getReviews()));
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredInstallPrompt=e; $('btnInstall').classList.remove('hidden'); });
  $('btnInstall').addEventListener('click', async()=>{ if(!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; $('btnInstall').classList.add('hidden'); });
}
function authError(err){ const code=err?.code||''; if(code.includes('email-already-in-use')) return 'Este e-mail já está cadastrado.'; if(code.includes('weak-password')) return 'Use uma senha com pelo menos 6 caracteres.'; if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found')) return 'E-mail ou senha inválidos.'; if(code.includes('operation-not-allowed')) return 'Ative Email/Senha no Firebase Authentication.'; return err?.message || 'Erro ao executar ação.'; }

async function init(){ bindEvents(); renderCategories(); await initFirebase(); await refreshAll(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js').catch(()=>{}); } }
init();
