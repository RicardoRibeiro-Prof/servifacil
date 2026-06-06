const categories = [
  { id: 'construcao', name: 'Casa e construção', icon: '🏠' },
  { id: 'beleza', name: 'Beleza e estética', icon: '💇' },
  { id: 'tecnologia', name: 'Tecnologia', icon: '💻' },
  { id: 'aulas', name: 'Aulas e consultorias', icon: '📚' },
  { id: 'servicos-gerais', name: 'Serviços gerais', icon: '🧰' },
  { id: 'entregas', name: 'Entregas e transporte', icon: '🛵' }
];

const sampleUsers = [
  { id: 'admin-1', name: 'Administrador', email: 'admin@servifacil.com', password: '123456', type: 'admin', createdAt: new Date().toISOString() }
];

const sampleProviders = [
  {
    id: 'sample-provider-1', userId: null, name: 'João Silva', category: 'construcao', city: 'São Raimundo Nonato - PI', neighborhood: 'Centro',
    whatsapp: '5589999999999', price: 'A partir de R$ 50,00',
    description: 'Eletricista residencial. Faço instalação de tomadas, troca de chuveiro, manutenção em disjuntores e instalação de iluminação.',
    rating: 4.8, featured: true, status: 'aprovado', createdAt: new Date().toISOString()
  },
  {
    id: 'sample-provider-2', userId: null, name: 'Maria Designer', category: 'tecnologia', city: 'São Raimundo Nonato - PI', neighborhood: 'Centro',
    whatsapp: '5589999999999', price: 'Artes a partir de R$ 30,00',
    description: 'Criação de artes para Instagram, cartões digitais, logotipos simples e materiais para divulgação.',
    rating: 4.9, featured: true, status: 'aprovado', createdAt: new Date().toISOString()
  }
];

const $ = id => document.getElementById(id);
let db = null;
let firebaseOnline = false;

function newId() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function hasFirebaseConfig() {
  const cfg = window.SERVIFACIL_FIREBASE_CONFIG;
  return cfg && cfg.projectId && cfg.projectId !== 'SEU_PROJECT_ID' && window.firebase;
}

async function initDataLayer() {
  if (!hasFirebaseConfig()) {
    firebaseOnline = false;
    updateDataModeBadge();
    return;
  }
  try {
    firebase.initializeApp(window.SERVIFACIL_FIREBASE_CONFIG);
    db = firebase.firestore();
    firebaseOnline = true;
    updateDataModeBadge();
    await seedFirebaseIfEmpty();
  } catch (error) {
    console.warn('Firebase indisponível. Usando modo local.', error);
    firebaseOnline = false;
    updateDataModeBadge();
    showToast('Firebase não conectou. App em modo local.');
  }
}

function updateDataModeBadge() {
  const badge = $('dataModeBadge');
  if (!badge) return;
  badge.textContent = firebaseOnline ? 'Online Firebase' : 'Local';
  badge.title = firebaseOnline ? 'Dados salvos no Firestore' : 'Dados salvos neste aparelho';
}

function getStorage(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try { return JSON.parse(saved); } catch { return fallback; }
}
function setStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

async function getCollection(name, fallback = []) {
  if (!firebaseOnline) return getStorage(name, fallback);
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function saveCollection(name, data) {
  if (!firebaseOnline) { setStorage(name, data); return; }
  const batch = db.batch();
  const oldSnap = await db.collection(name).get();
  oldSnap.docs.forEach(doc => batch.delete(doc.ref));
  data.forEach(item => batch.set(db.collection(name).doc(item.id), item));
  await batch.commit();
}
async function upsertDoc(name, item) {
  if (!firebaseOnline) {
    const list = await getCollection(name, []);
    const idx = list.findIndex(x => x.id === item.id);
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    setStorage(name, list);
    return;
  }
  await db.collection(name).doc(item.id).set(item, { merge: true });
}
async function deleteDoc(name, id) {
  if (!firebaseOnline) {
    setStorage(name, (await getCollection(name, [])).filter(item => item.id !== id));
    return;
  }
  await db.collection(name).doc(id).delete();
}

async function seedFirebaseIfEmpty() {
  const usersSnap = await db.collection('users').limit(1).get();
  if (usersSnap.empty) {
    for (const user of sampleUsers) await db.collection('users').doc(user.id).set(user);
  }
  const providersSnap = await db.collection('providers').limit(1).get();
  if (providersSnap.empty) {
    for (const provider of sampleProviders) await db.collection('providers').doc(provider.id).set(provider);
  }
}

async function getUsers() { return getCollection('users', sampleUsers); }
async function saveUsers(users) { return saveCollection('users', users); }
async function getProviders() { return (await getCollection('providers', sampleProviders)).map(p => ({ status: 'aprovado', ...p })); }
async function saveProviders(providers) { return saveCollection('providers', providers); }
async function getRequests() { return getCollection('requests', []); }
async function saveRequests(requests) { return saveCollection('requests', requests); }
function getSession() { return JSON.parse(localStorage.getItem('session') || 'null'); }
function setSession(user) { localStorage.setItem('session', JSON.stringify(user)); updateSessionUI(); }
function clearSession() { localStorage.removeItem('session'); updateSessionUI(); }

function categoryName(id) { return categories.find(c => c.id === id)?.name || 'Categoria'; }
function statusLabel(status) { return status === 'aprovado' ? 'Aprovado' : status === 'bloqueado' ? 'Bloqueado' : 'Pendente'; }
function statusClass(status) { return status === 'aprovado' ? 'approved' : status === 'bloqueado' ? 'blocked' : 'pending'; }
async function approvedProviders() { return (await getProviders()).filter(p => p.status === 'aprovado'); }

function updateSessionUI() {
  const user = getSession();
  const badge = $('userBadge');
  const logoutButton = $('btnLogout');
  if (user) {
    badge.textContent = `${user.name} • ${user.type}`;
    badge.classList.remove('hidden');
    logoutButton.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    logoutButton.classList.add('hidden');
  }
}

function logout() {
  clearSession();
  showToast('Você saiu da conta.');
  showScreen('inicio');
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active-screen'));
  $(screenId).classList.add('active-screen');
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === screenId));
  if (screenId === 'buscar') renderProfessionals();
  if (screenId === 'admin') renderAdmin();
  if (screenId === 'painel') renderDashboard();
  if (screenId === 'solicitacoes') { renderRequestProviderOptions(); renderRequests(); fillRequestClient(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCategories() {
  $('categoryGrid').innerHTML = categories.map(cat => `
    <div class="category-card" onclick="filterByCategory('${cat.id}')">
      <span>${cat.icon}</span><strong>${cat.name}</strong>
    </div>
  `).join('');

  const options = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  $('category').innerHTML = '<option value="">Selecione uma categoria</option>' + options;
  $('categoryFilter').innerHTML = '<option value="">Todas as categorias</option>' + options;
  $('requestCategory').innerHTML = '<option value="">Selecione uma categoria</option>' + options;
}

function filterByCategory(categoryId) {
  $('categoryFilter').value = categoryId;
  showScreen('buscar');
}

function providerCard(provider, admin = false) {
  const status = provider.status || 'aprovado';
  return `
    <article class="pro-card">
      <div class="pro-header">
        <div>
          <strong>${provider.name}</strong>
          <p class="muted">${categoryName(provider.category)} • ${provider.city}${provider.neighborhood ? ' • ' + provider.neighborhood : ''}</p>
        </div>
        <div class="badges">
          ${provider.featured ? '<span class="badge">Destaque</span>' : ''}
          ${admin ? `<span class="badge ${statusClass(status)}">${statusLabel(status)}</span>` : ''}
        </div>
      </div>
      <p>${provider.description}</p>
      <p><span class="rating">⭐ ${provider.rating || 'Novo'}</span>${provider.price ? ' • ' + provider.price : ''}</p>
      <div class="profile-actions">
        <button onclick="openProfile('${provider.id}')">Ver perfil</button>
        ${admin ? adminProviderButtons(provider) : ''}
      </div>
    </article>
  `;
}

function adminProviderButtons(provider) {
  return `
    ${provider.status !== 'aprovado' ? `<button class="success" onclick="updateProviderStatus('${provider.id}', 'aprovado')">Aprovar</button>` : ''}
    ${provider.status !== 'bloqueado' ? `<button class="danger" onclick="updateProviderStatus('${provider.id}', 'bloqueado')">Bloquear</button>` : ''}
    <button class="secondary" onclick="toggleFeatured('${provider.id}')">${provider.featured ? 'Remover destaque' : 'Destacar'}</button>
    <button class="danger" onclick="deleteProvider('${provider.id}')">Excluir</button>
  `;
}

async function renderFeatured() {
  const providers = (await approvedProviders()).filter(p => p.featured);
  $('featuredList').innerHTML = providers.length ? providers.map(p => providerCard(p)).join('') : '<p class="empty-card muted">Nenhum profissional em destaque ainda.</p>';
}

async function renderProfessionals() {
  const text = $('searchText').value.toLowerCase().trim();
  const category = $('categoryFilter').value;
  const sort = $('sortFilter').value;
  let providers = (await approvedProviders()).filter(provider => {
    const haystack = [provider.name, provider.city, provider.neighborhood, provider.description, categoryName(provider.category)].join(' ').toLowerCase();
    return (!text || haystack.includes(text)) && (!category || provider.category === category);
  });

  providers.sort((a, b) => {
    if (sort === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
    if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    return Number(b.featured) - Number(a.featured) || Number(b.rating || 0) - Number(a.rating || 0);
  });

  $('professionalList').innerHTML = providers.length ? providers.map(p => providerCard(p)).join('') : '<p class="empty-card muted">Nenhum profissional encontrado com esses filtros.</p>';
}

async function openProfile(id) {
  const provider = (await getProviders()).find(p => p.id === id);
  if (!provider) return;
  const cleanPhone = provider.whatsapp.replace(/\D/g, '');
  const message = encodeURIComponent(`Olá, vi seu perfil no ServiFácil e gostaria de solicitar um orçamento para: ${categoryName(provider.category)}.`);
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${message}`;

  $('profileBox').innerHTML = `
    <article class="profile-card">
      <h2>${provider.name}</h2>
      <p><span class="badge">${categoryName(provider.category)}</span> ${provider.featured ? '<span class="badge">Destaque</span>' : ''}</p>
      <p class="muted">📍 ${provider.city}${provider.neighborhood ? ' • ' + provider.neighborhood : ''}</p>
      <p class="rating">⭐ ${provider.rating || 'Profissional novo'}</p>
      <h4>Descrição</h4><p>${provider.description}</p>
      ${provider.price ? `<h4>Preço inicial</h4><p>${provider.price}</p>` : ''}
      ${provider.photo ? `<h4>Portfólio</h4><p><a href="${provider.photo}" target="_blank">Abrir link informado</a></p>` : ''}
      <div class="profile-actions">
        <a href="${whatsappLink}" target="_blank"><button class="whatsapp">Chamar no WhatsApp</button></a>
        <button onclick="startRequestForProvider('${provider.id}')">Solicitar orçamento pelo app</button>
      </div>
    </article>
  `;
  showScreen('perfil');
}

async function startRequestForProvider(providerId) {
  const provider = (await getProviders()).find(p => p.id === providerId);
  if (!provider) return;
  showScreen('solicitacoes');
  $('requestCategory').value = provider.category;
  await renderRequestProviderOptions();
  $('requestProvider').value = provider.id;
}

async function renderRequestProviderOptions() {
  const category = $('requestCategory').value;
  const list = (await approvedProviders()).filter(p => !category || p.category === category);
  $('requestProvider').innerHTML = '<option value="">Enviar para todos da categoria</option>' + list.map(p => `<option value="${p.id}">${p.name} - ${p.city}</option>`).join('');
}

function fillRequestClient() {
  const user = getSession();
  if (user && !$('requestClientName').value) $('requestClientName').value = user.name;
}

async function renderRequests() {
  const requests = (await getRequests()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $('requestList').innerHTML = requests.length ? requests.slice(0, 8).map(requestCard).join('') : '<p class="empty-card muted">Nenhuma solicitação cadastrada ainda.</p>';
}

function requestCard(req, showActions = false) {
  const phone = req.phone.replace(/\D/g, '');
  const msg = encodeURIComponent(`Olá ${req.clientName}, vi sua solicitação no ServiFácil sobre ${categoryName(req.category)}. Posso te passar um orçamento.`);
  return `
    <article class="request-card">
      <strong>${categoryName(req.category)}</strong>
      <div class="request-meta">
        <span>${req.location}</span><span>${req.status}</span>${req.providerName ? `<span>Para: ${req.providerName}</span>` : '<span>Para todos da categoria</span>'}
      </div>
      <p>${req.description}</p>
      <p class="muted">Cliente: ${req.clientName} • ${new Date(req.createdAt).toLocaleDateString('pt-BR')}</p>
      ${showActions ? `<div class="row-actions"><a href="https://wa.me/${phone}?text=${msg}" target="_blank"><button class="whatsapp">Responder no WhatsApp</button></a><button onclick="markRequestDone('${req.id}')">Marcar atendido</button></div>` : ''}
    </article>`;
}

async function renderDashboard() {
  const user = getSession();
  if (!user) {
    $('dashboardBox').innerHTML = '<div class="empty-card"><p>Entre ou crie uma conta para acessar seu painel.</p><button onclick="showScreen(\'login\')">Entrar agora</button></div>';
    return;
  }

  if (user.type === 'admin') {
    $('dashboardBox').innerHTML = '<div class="empty-card"><p>Você está como administrador.</p><button onclick="showScreen(\'admin\')">Abrir painel administrativo</button></div>';
    return;
  }

  const requests = await getRequests();
  const providersAll = await getProviders();
  if (user.type === 'cliente') {
    const myRequests = requests.filter(r => r.clientUserId === user.id || r.clientName.toLowerCase() === user.name.toLowerCase());
    $('dashboardBox').innerHTML = `<div class="empty-card"><h4>Minhas solicitações</h4>${myRequests.length ? myRequests.map(r => requestCard(r)).join('') : '<p class="muted">Você ainda não fez solicitações.</p>'}<button onclick="showScreen('solicitacoes')">Nova solicitação</button></div>`;
    return;
  }

  const providers = providersAll.filter(p => p.userId === user.id || p.name.toLowerCase() === user.name.toLowerCase());
  if (!providers.length) {
    $('dashboardBox').innerHTML = '<div class="empty-card"><p>Você ainda não cadastrou seu perfil profissional.</p><button onclick="showScreen(\'cadastro\')">Cadastrar serviço</button></div>';
    return;
  }

  const myCategories = providers.map(p => p.category);
  const myIds = providers.map(p => p.id);
  const myRequests = requests.filter(r => myIds.includes(r.providerId) || (!r.providerId && myCategories.includes(r.category)));
  $('dashboardBox').innerHTML = `
    <div class="stats">
      <div><strong>${providers.length}</strong><span>Perfis</span></div>
      <div><strong>${myRequests.length}</strong><span>Pedidos recebidos</span></div>
      <div><strong>${providers.filter(p => p.status === 'aprovado').length}</strong><span>Aprovados</span></div>
      <div><strong>${providers.filter(p => p.featured).length}</strong><span>Destaques</span></div>
    </div>
    <h4>Meus perfis</h4>
    <div class="cards">${providers.map(p => providerCard(p)).join('')}</div>
    <h4>Pedidos para mim</h4>
    <div class="cards">${myRequests.length ? myRequests.map(r => requestCard(r, true)).join('') : '<p class="empty-card muted">Nenhum pedido recebido ainda.</p>'}</div>`;
}

async function renderAdmin() {
  const user = getSession();
  const providers = await getProviders();
  const requests = await getRequests();
  $('totalProviders').textContent = providers.length;
  $('pendingProviders').textContent = providers.filter(p => p.status === 'pendente').length;
  $('totalRequests').textContent = requests.length;
  $('totalFeatured').textContent = providers.filter(p => p.featured).length;

  if (!user || user.type !== 'admin') {
    $('adminList').innerHTML = '<p class="empty-card muted">Acesse com a conta admin para gerenciar o app. Use admin@servifacil.com / 123456.</p>';
    return;
  }

  $('adminList').innerHTML = providers.length ? providers.map(p => providerCard(p, true)).join('') : '<p class="empty-card muted">Nenhum prestador cadastrado.</p>';
}

async function toggleFeatured(id) {
  const providers = await getProviders();
  const provider = providers.find(p => p.id === id);
  if (!provider) return;
  await upsertDoc('providers', { ...provider, featured: !provider.featured });
  await refreshAll();
  showToast('Destaque atualizado.');
}

async function updateProviderStatus(id, status) {
  const providers = await getProviders();
  const provider = providers.find(p => p.id === id);
  if (!provider) return;
  await upsertDoc('providers', { ...provider, status });
  await refreshAll();
  showToast(`Prestador ${statusLabel(status).toLowerCase()}.`);
}

async function deleteProvider(id) {
  if (!confirm('Deseja excluir este prestador?')) return;
  await deleteDoc('providers', id);
  await refreshAll();
  showToast('Prestador excluído.');
}

async function markRequestDone(id) {
  const requests = await getRequests();
  const req = requests.find(r => r.id === id);
  if (!req) return;
  await upsertDoc('requests', { ...req, status: 'Atendido' });
  await renderDashboard();
  await renderRequests();
  showToast('Solicitação marcada como atendida.');
}

async function clearAllData() {
  if (!confirm(firebaseOnline ? 'Isso vai apagar dados do Firestore usados pelo app. Continuar?' : 'Isso vai apagar dados salvos neste aparelho. Continuar?')) return;
  if (firebaseOnline) {
    await saveCollection('providers', []);
    await saveCollection('requests', []);
    await saveCollection('users', sampleUsers);
  } else {
    localStorage.removeItem('providers');
    localStorage.removeItem('requests');
    localStorage.removeItem('users');
  }
  localStorage.removeItem('session');
  await refreshAll();
  updateSessionUI();
  showToast('Dados reiniciados.');
}

function exportJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
async function exportData() { exportJson('prestadores-servifacil.json', await getProviders()); }
async function exportRequests() { exportJson('solicitacoes-servifacil.json', await getRequests()); }

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

async function refreshAll() {
  await renderFeatured();
  await renderProfessionals();
  await renderAdmin();
  await renderDashboard();
  await renderRequests();
}

$('providerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const user = getSession();
  const provider = {
    id: newId(),
    userId: user?.id || null,
    name: $('name').value.trim(), category: $('category').value, city: $('city').value.trim(), neighborhood: $('neighborhood').value.trim(),
    whatsapp: $('whatsapp').value.trim(), price: $('price').value.trim(), description: $('description').value.trim(), photo: $('photo').value.trim(),
    rating: 'Novo', featured: false, status: 'pendente', createdAt: new Date().toISOString()
  };
  await upsertDoc('providers', provider);
  event.target.reset(); await refreshAll(); showToast('Cadastro enviado! Aguarde aprovação do administrador.'); showScreen('painel');
});

$('accountForm').addEventListener('submit', async event => {
  event.preventDefault();
  const users = await getUsers();
  const email = $('accountEmail').value.trim().toLowerCase();
  if (users.some(u => u.email === email)) { showToast('Este e-mail já está cadastrado.'); return; }
  const user = { id: newId(), name: $('accountName').value.trim(), email, password: $('accountPassword').value, type: $('accountType').value, createdAt: new Date().toISOString() };
  await upsertDoc('users', user);
  setSession({ id: user.id, name: user.name, email: user.email, type: user.type });
  event.target.reset(); showToast('Conta criada com sucesso!'); showScreen(user.type === 'prestador' ? 'cadastro' : 'buscar');
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('loginEmail').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  const user = (await getUsers()).find(u => u.email === email && u.password === password);
  if (!user) { showToast('E-mail ou senha incorretos.'); return; }
  setSession({ id: user.id, name: user.name, email: user.email, type: user.type });
  event.target.reset(); showToast('Login realizado com sucesso!'); showScreen(user.type === 'admin' ? 'admin' : 'painel');
});

$('requestForm').addEventListener('submit', async event => {
  event.preventDefault();
  const user = getSession();
  const providers = await getProviders();
  const provider = providers.find(p => p.id === $('requestProvider').value);
  const request = {
    id: newId(), clientUserId: user?.id || null, category: $('requestCategory').value, providerId: $('requestProvider').value,
    providerName: provider?.name || '', clientName: $('requestClientName').value.trim(), phone: $('requestPhone').value.trim(), location: $('requestLocation').value.trim(),
    description: $('requestDescription').value.trim(), status: 'Aberto', createdAt: new Date().toISOString()
  };
  await upsertDoc('requests', request);
  event.target.reset(); fillRequestClient(); await renderRequests(); await renderDashboard(); showToast('Solicitação enviada com sucesso!');
});

$('requestCategory').addEventListener('change', renderRequestProviderOptions);

let deferredPrompt;
const installButton = $('btnInstall');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); deferredPrompt = event; installButton.classList.remove('hidden');
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installButton.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

async function boot() {
  renderCategories();
  updateSessionUI();
  await initDataLayer();
  await renderFeatured();
  await renderProfessionals();
  await renderRequestProviderOptions();
  await renderRequests();
  await renderAdmin();
}
boot();
