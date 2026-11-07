const $ = s => document.querySelector(s);
document.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.closest('.admin-product-thumb, .cat-thumb, .image-slot, .review-admin-item')) img.style.visibility = 'hidden';
}, true);
const money = n => '৳' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: {'Content-Type':'application/json', ...(opts.headers || {})}, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    let msg = data.detail;
    if (Array.isArray(msg)) msg = msg.map(x => String(x.msg || '').replace(/^Value error, /, '')).filter(Boolean).join(' · ');
    throw new Error(msg || 'কাজটি সম্পন্ন হয়নি।');
  }
  return data;
}
function toast(msg) { const el = $('#adminToast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3000); }
let products = [], orders = [], categories = [], settings = {}, editingImages = [], editingReviewImages = [], pollTimer = null, lastNewOrderCount = 0, newCategoryImage = '';
let originalEditSlug = '', slugManuallyEdited = false, autoSlugEnabled = false;
const reservedSlugs = new Set(['admin','api','static','uploads','product','p','shop','collections','about','contact','policy','robots.txt','sitemap.xml','docs','redoc','openapi.json','health','favicon.ico','index','order','cart','login']);
function slugFromName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/g,''); }
function updateSlugPreview() {
  const input=$('#productSlug'), preview=$('#slugPreview'); if(!input||!preview)return;
  const slug=input.value.trim().toLowerCase(), valid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&!reservedSlugs.has(slug);
  if(!slug){preview.textContent='বাংলা নাম হলে ইংরেজি পেজ লিংক নিজে লিখুন, অথবা সংরক্ষণের পরে ID-ভিত্তিক লিংক তৈরি হবে।';preview.classList.remove('invalid');return;}
  preview.textContent=valid?`${location.origin}/${slug}`:'লিংকটি সঠিক নয়। ছোট ইংরেজি অক্ষর, সংখ্যা ও মাঝখানে হাইফেন ব্যবহার করুন।';
  preview.classList.toggle('invalid',!valid);
}
async function copyText(text) {
  if(navigator.clipboard&&window.isSecureContext){
    try{await navigator.clipboard.writeText(text);return;}catch{}
  }
  const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
  let copied=false;try{copied=document.execCommand('copy');}finally{field.remove();}
  if(!copied)throw new Error('লিংক কপি করা যায়নি।');
}
const statusLabels = {new:'নতুন অর্ডার', confirmed:'ফোনে নিশ্চিত', processing:'প্রসেসিং', shipped:'পাঠানো হয়েছে', delivered:'ডেলিভারড', cancelled:'বাতিল'};
const imageLabels = [['সামনের ছবি','Front view'],['পেছনের ছবি','Back view'],['এক পাশের ছবি','Side view'],['কাপড় / কাজের ডিটেইল','Fabric detail'],['রং / ক্লোজআপ','Close-up'],['অন্য ছবি','Other photo']];
const isFullSetCategory = value => ['ফুল সেট','full set','full-set'].includes(String(value || '').trim().toLowerCase());

function showDashboard() {
  $('#loginView').classList.add('hidden'); $('#dashboardView').classList.remove('hidden');
  loadAll().then(() => { if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(pollOrders, 25000); });
}
async function checkSession() {
  try { await api('/api/admin/me'); showDashboard(); }
  catch { $('#loginView').classList.remove('hidden'); $('#dashboardView').classList.add('hidden'); }
}
async function loadAll() {
  try {
    [products, orders, categories, settings] = await Promise.all([
      api('/api/admin/products'), api('/api/admin/orders'), api('/api/admin/categories'), api('/api/settings')
    ]);
    renderStats(); renderProducts(); renderOrders(); renderCategories(); fillSettings(); fillCategorySelect();
  } catch (e) { toast(e.message); }
}
function renderStats() {
  const newCount = orders.filter(o => o.status === 'new').length;
  const reviewCount = orders.filter(o => o.fraud_flag && o.status === 'new').length;
  lastNewOrderCount = newCount;
  $('#statsGrid').innerHTML = `
    <div class="stat-card"><span>মোট পণ্য</span><strong>${products.length}</strong></div>
    <div class="stat-card"><span>মোট অর্ডার</span><strong>${orders.length}</strong></div>
    <div class="stat-card"><span>নতুন অর্ডার</span><strong>${newCount}</strong></div>
    <div class="stat-card"><span>ফোনে যাচাই প্রয়োজন</span><strong>${reviewCount}</strong></div>`;
  $('#newOrderBadge').textContent = newCount || '';
}
function renderProducts() {
  const el = $('#adminProductList');
  if (!products.length) { el.innerHTML = '<div class="empty-state">এখনো কোনো পণ্য নেই। নতুন পণ্য যোগ করুন।</div>'; return; }
  el.innerHTML = products.map(p => {
    const pageUrl = `${location.origin}/${encodeURIComponent(p.slug || '')}`;
    return `<div class="admin-product-row">
      <div class="admin-product-thumb">${p.images?.length ? `<img src="${esc(p.images[0])}" alt="">` : 'R.'}</div>
      <div class="admin-product-info"><strong>${esc(p.name)}</strong><small>${esc(p.category)} · স্টক ${p.stock} · ${p.active ? 'প্রকাশিত' : 'লুকানো'}${p.free_delivery ? ' · ডেলিভারি ফ্রি' : ''}</small>
        <div class="admin-product-link ${p.active ? '' : 'inactive'}"><span>${esc(pageUrl)}</span>${p.active ? '' : '<small>লুকানো — লিংক কাজ করবে না</small>'}</div></div>
      <div class="row-price">${p.sale_price !== null && p.sale_price < p.price ? `<strong>${money(p.sale_price)}</strong><small><del>${money(p.price)}</del></small>` : money(p.price)}</div>
      <div class="row-actions"><button class="text-btn" data-copy-product-url="${esc(pageUrl)}">কপি</button>${p.active ? `<a class="text-btn" href="${esc(pageUrl)}" target="_blank" rel="noopener">পেজ দেখুন ↗</a>` : '<span class="text-btn inactive-link">পেজ লুকানো</span>'}<button class="text-btn" data-edit-product="${p.id}">এডিট</button><button class="text-btn danger" data-delete-product="${p.id}">মুছুন</button></div>
    </div>`;
  }).join('');
}
function renderOrders() {
  const el = $('#adminOrderList');
  if (!orders.length) { el.innerHTML = '<div class="empty-state">এখনো কোনো অর্ডার আসেনি। নতুন অর্ডার এলে এখানে দেখা যাবে।</div>'; return; }
  el.innerHTML = orders.map(o => {
    const area = o.delivery_area === 'dhaka' ? 'ঢাকার ভিতরে' : 'ঢাকার বাইরে';
    const fraud = o.fraud_flag ? `<div class="fraud-warning">⚠ ফোনে যাচাই করুন: ${esc(o.fraud_reason || 'এই নম্বর থেকে কাছাকাছি সময়ে একাধিক অর্ডার এসেছে।')}</div>` : '';
    return `<article class="order-card">
      <div class="order-card-head"><div><strong>#${esc(o.invoice)} · ${esc(o.customer_name)}</strong><small>${new Date(o.created_at).toLocaleString('bn-BD')} · ${esc(o.phone)}</small></div><span class="status-pill ${o.status}">${statusLabels[o.status] || o.status}</span></div>
      ${fraud}
      <div class="order-body"><div class="order-details">📞 ${esc(o.phone)}\n📍 ${esc(o.address)}\n🚚 ${area}${o.note ? '\nনোট: ' + esc(o.note) : ''}</div>
      <div class="order-items">${(o.items || []).map(i => `${esc(i.name)} × ${i.quantity}${i.size ? ' · সাইজ ' + esc(i.size) : ''}${i.color ? ' · ' + esc(i.color) : ''} — ${money(i.unit_price * i.quantity)}`).join('<br>')}<hr style="border:0;border-top:1px solid #e5ded4"><div class="summary-line">পণ্যের দাম <span>${money(o.subtotal)}</span></div><div class="summary-line">ডেলিভারি <span>${o.delivery_fee === 0 ? 'ফ্রি' : money(o.delivery_fee)}</span></div><strong>সর্বমোট: ${money(o.total)}</strong></div></div>
      <div class="order-actions"><label class="helper-text">স্ট্যাটাস</label><select data-order-status="${o.id}">${Object.entries(statusLabels).map(([k,v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button class="text-btn" data-send-courier="${o.id}" ${(o.courier_consignment_id || o.status !== 'confirmed') ? 'disabled' : ''}>${o.courier_consignment_id ? 'Steadfast পাঠানো হয়েছে' : (o.status === 'confirmed' ? 'Steadfast-এ পাঠান' : 'আগে ফোনে Confirm করুন')}</button>
      ${o.courier_tracking_code ? `<span class="helper-text">Tracking: ${esc(o.courier_tracking_code)}</span>` : ''}</div>
    </article>`;
  }).join('');
}
function renderCategories() {
  const el = $('#adminCategoryList');
  el.innerHTML = categories.map(c => `<div class="category-admin-row"><div class="cat-row-main">${c.image ? `<img class="cat-thumb" src="${esc(c.image)}" alt="">` : '<span class="cat-thumb cat-thumb-empty">ছবি নেই</span>'}<div><strong>${esc(c.name)}</strong><small>${esc(c.description || '')}${c.active ? '' : ' · লুকানো'}</small></div></div><details class="category-edit-details"><summary>নাম / বিবরণ এডিট</summary><form data-category-edit="${c.id}"><input name="name" required minlength="2" maxlength="80" value="${esc(c.name)}" aria-label="ক্যাটাগরির নাম"><input name="description" maxlength="180" value="${esc(c.description || '')}" aria-label="ক্যাটাগরির বিবরণ"><button class="text-btn" type="submit">সেভ</button></form></details><div class="cat-row-actions"><label class="upload-more-btn">${c.image ? 'ছবি বদলান' : 'ছবি দিন'}<input type="file" accept="image/*" hidden data-cat-image="${c.id}"></label><button class="text-btn danger" data-hide-category="${c.id}">লুকান</button></div></div>`).join('') || '<div class="empty-state">কোনো ক্যাটাগরি নেই।</div>';
}
function fillSettings() {
  const f = $('#settingsForm');
  if (!f || !settings) return;
  const textFields = ['store_name','announcement','hero_title','hero_subtitle','hero_button','hero_image','whatsapp_number','contact_text','footer_text','accent_color','theme','background_color','text_color','tagline','trust_customer_count','trust_rating_value','trust_review_count','new_arrival_title','new_arrival_subtitle','new_arrival_image',
    'feature_1_title','feature_1_text','feature_2_title','feature_2_text','feature_3_title','feature_3_text','feature_4_title','feature_4_text','about_text','support_phone','support_email','shop_address','facebook_url','instagram_url','delivery_policy','return_policy','privacy_policy','seo_title','seo_description','seo_keywords','ga4_measurement_id','meta_pixel_id'];
  for (const key of textFields) if (f.elements[key]) f.elements[key].value = settings[key] ?? '';
  f.elements.dhaka_delivery_fee.value = settings.dhaka_delivery_fee ?? 50;
  f.elements.outside_delivery_fee.value = settings.outside_delivery_fee ?? 100;
  f.elements.new_arrival_enabled.checked = !!settings.new_arrival_enabled;
  editingReviewImages = [...(settings.review_images || [])].slice(0,10);
  renderReviewImageSlots();
}
function renderReviewImageSlots() {
  const el = $('#reviewImageGrid'); if (!el) return;
  el.innerHTML = editingReviewImages.map((src,i)=>`<div class="review-admin-item"><img src="${esc(src)}" alt="রিভিউ ছবি ${i+1}"><button type="button" class="text-btn danger" data-remove-review="${i}">ছবি সরান</button></div>`).join('') || '<p class="helper-text">এখনো কোনো রিভিউ ছবি যোগ করা হয়নি।</p>';
}
function fillCategorySelect() {
  const sel = $('#productCategory');
  sel.innerHTML = categories.filter(c => c.active).map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if (!sel.options.length) sel.innerHTML = '<option value="বোরকা">বোরকা</option>';
}
function syncFreeDeliveryControl() {
  const f = $('#productForm');
  const eligible = isFullSetCategory(f.elements.category.value);
  f.elements.free_delivery.disabled = !eligible;
  if (!eligible) f.elements.free_delivery.checked = false;
}
function openEditor(product = null) {
  const f = $('#productForm'); f.reset();
  f.elements.id.value = product?.id || '';
  f.elements.name.value = product?.name || '';
  f.elements.slug.value = product?.slug || '';
  originalEditSlug = product?.slug || ''; slugManuallyEdited = false; autoSlugEnabled = !product;
  $('#siteOriginPrefix').textContent = `${location.origin}/`;
  f.elements.category.value = product?.category || categories.find(c => c.active)?.name || 'বোরকা';
  f.elements.stock.value = product?.stock ?? 0;
  f.elements.price.value = product?.price ?? '';
  f.elements.sale_price.value = product?.sale_price ?? '';
  f.elements.description.value = product?.description || '';
  f.elements.size_guide.value = product?.size_guide || '';
  f.elements.sizes.value = (product?.sizes || []).join(', ');
  f.elements.colors.value = (product?.colors || []).join(', ');
  f.elements.featured.checked = !!product?.featured;
  f.elements.free_delivery.checked = isFullSetCategory(f.elements.category.value) && (product ? !!product.free_delivery : true);
  syncFreeDeliveryControl();
  f.elements.active.checked = product ? !!product.active : true;
  editingImages = [...(product?.images || [])].slice(0, 6);
  $('#editorTitle').textContent = product ? 'পণ্য এডিট করুন' : 'নতুন পণ্য যোগ করুন';
  $('#productError').textContent = ''; renderImageSlots(); updateDiscountPreview(); updateSlugPreview(); $('#productImages').value = '';
  $('#productEditorOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeEditor() { $('#productEditorOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function renderImageSlots() {
  $('#imageGuideGrid').innerHTML = imageLabels.map((l, i) => `<div class="image-slot" data-slot="${i}">${editingImages[i] ? `<img src="${esc(editingImages[i])}" alt="${esc(l[0])}"><button type="button" class="remove-image" data-remove-image="${i}" aria-label="ছবি মুছুন">×</button><div class="image-actions"><button type="button" data-move-image="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="এক ধাপ আগে নিন">←</button><button type="button" data-move-image="${i}" data-direction="1" ${i===editingImages.length-1?'disabled':''} aria-label="এক ধাপ পরে নিন">→</button></div>` : `<strong>${l[0]}</strong><small>${l[1]}</small><small>ছবি ${i+1}</small>`}</div>`).join('');
}
function updateDiscountPreview() {
  const f = $('#productForm'); const p = Number(f.elements.price.value || 0); const s = f.elements.sale_price.value; const el = $('#discountPreview');
  if (s !== '' && Number(s) < p && p > 0) { const pct = Math.round((p - Number(s)) / p * 100); el.innerHTML = `কাস্টমার দেখবেন: <del>${money(p)}</del> &nbsp; <strong>${money(s)}</strong> &nbsp; <b>${pct}% ছাড়</b>`; }
  else if (s !== '' && p > 0 && Number(s) >= p) el.textContent = 'ডিসকাউন্টের দাম মূল দামের চেয়ে কম দিতে হবে।';
  else el.textContent = 'ডিসকাউন্ট না দিলে কাস্টমার শুধু মূল দাম দেখবেন।';
}
async function uploadFiles(files) {
  const fd = new FormData(); [...files].forEach(file => fd.append('files', file));
  const r = await fetch('/api/admin/uploads', {method:'POST', body:fd}); const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || 'ছবি আপলোড হয়নি।'); return d.urls || [];
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const f = new FormData(e.currentTarget); $('#loginError').textContent = '';
  const btn = e.currentTarget.querySelector('button'); btn.disabled = true;
  try { await api('/api/admin/login', {method:'POST', body:JSON.stringify({access_key:f.get('access_key')})}); showDashboard(); }
  catch (err) { $('#loginError').textContent = err.message; } finally { btn.disabled = false; }
});
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', {method:'POST'}); } finally { if (pollTimer) clearInterval(pollTimer); $('#dashboardView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#loginForm').reset(); }
});
document.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.admin-tab').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'orders') refreshOrders();
}));
$('#addProductBtn').addEventListener('click', () => openEditor());
$('#productForm').elements.name.addEventListener('input', e => { const slug=$('#productSlug'); if(autoSlugEnabled && !slugManuallyEdited) slug.value=slugFromName(e.target.value); updateSlugPreview(); });
$('#productForm').elements.slug.addEventListener('input', () => { slugManuallyEdited=true; updateSlugPreview(); });
$('#productForm').elements.price.addEventListener('input', updateDiscountPreview);
$('#productForm').elements.sale_price.addEventListener('input', updateDiscountPreview);
$('#productForm').elements.category.addEventListener('change', e => { $('#productForm').elements.free_delivery.checked = isFullSetCategory(e.target.value); syncFreeDeliveryControl(); });
$('#productImages').addEventListener('change', async e => {
  const input = e.currentTarget, files = [...input.files]; if (!files.length) return;
  if (editingImages.length + files.length > 6) { toast('সর্বোচ্চ ৬টি ছবি রাখা যাবে।'); input.value = ''; return; }
  try { editingImages.push(...await uploadFiles(files)); renderImageSlots(); toast('ছবি যোগ হয়েছে।'); }
  catch (err) { toast(err.message); } finally { input.value = ''; }
});
$('#imageGuideGrid').addEventListener('click', e => { const remove = e.target.closest('[data-remove-image]'); if (remove) { editingImages.splice(Number(remove.dataset.removeImage), 1); renderImageSlots(); return; } const move = e.target.closest('[data-move-image]'); if (move) { const from=Number(move.dataset.moveImage), to=from+Number(move.dataset.direction); if (to<0 || to>=editingImages.length) return; [editingImages[from],editingImages[to]]=[editingImages[to],editingImages[from]]; renderImageSlots(); } });
$('#productForm').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.currentTarget, id = f.elements.id.value, price = Number(f.elements.price.value);
  const sale = f.elements.sale_price.value === '' ? null : Number(f.elements.sale_price.value);
  if (sale !== null && sale >= price) { $('#productError').textContent = 'ডিসকাউন্টের দাম মূল দামের চেয়ে কম হতে হবে।'; return; }
  const slug=f.elements.slug.value.trim().toLowerCase();
  if(slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reservedSlugs.has(slug))){$('#productError').textContent='পেজ লিংকটি সঠিক নয়। ছোট ইংরেজি অক্ষর, সংখ্যা ও মাঝখানে হাইফেন ব্যবহার করুন।';return;}
  if(id && originalEditSlug && slug !== originalEditSlug && !confirm('এই লিংক বদলালে চলমান বিজ্ঞাপনের পুরোনো লিংক কাজ করবে না। নতুন লিংকটি বিজ্ঞাপনে আপডেট করতে হবে। আপনি কি পরিবর্তন করতে চান?'))return;
  const payload = {name:f.elements.name.value.trim(), slug, category:f.elements.category.value, description:f.elements.description.value.trim(), size_guide:f.elements.size_guide.value.trim(), price, sale_price:sale,
    sizes:f.elements.sizes.value.split(',').map(x=>x.trim()).filter(Boolean), colors:f.elements.colors.value.split(',').map(x=>x.trim()).filter(Boolean),
    images:editingImages, stock:Number(f.elements.stock.value), featured:f.elements.featured.checked, free_delivery:f.elements.free_delivery.checked, active:f.elements.active.checked};
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try { await api(id ? `/api/admin/products/${id}` : '/api/admin/products', {method:id?'PUT':'POST', body:JSON.stringify(payload)}); closeEditor(); await loadAll(); toast('পণ্যের তথ্য সংরক্ষণ হয়েছে।'); }
  catch (err) { $('#productError').textContent = err.message; } finally { btn.disabled = false; }
});
$('#adminProductList').addEventListener('click', async e => {
  const copy = e.target.closest('[data-copy-product-url]');
  const edit = e.target.closest('[data-edit-product]'), del = e.target.closest('[data-delete-product]');
  if(copy){try{await copyText(copy.dataset.copyProductUrl);toast('পণ্যের পেজ লিংক কপি হয়েছে।');}catch{toast('লিংক কপি করা যায়নি।');}return;}
  if (edit) { const p = products.find(x => x.id === Number(edit.dataset.editProduct)); fillCategorySelect(); openEditor(p); }
  if (del) { const p = products.find(x => x.id === Number(del.dataset.deleteProduct)); if (!confirm(`“${p?.name || 'এই পণ্য'}” মুছে ফেলবেন?`)) return;
    try { await api(`/api/admin/products/${del.dataset.deleteProduct}`, {method:'DELETE'}); await loadAll(); toast('পণ্য মুছে ফেলা হয়েছে।'); } catch (err) { toast(err.message); }
  }
});
$('#categoryForm').addEventListener('submit', async e => {
  e.preventDefault(); const formEl = e.currentTarget, f = new FormData(formEl);
  try { await api('/api/admin/categories', {method:'POST', body:JSON.stringify({name:f.get('name'), description:f.get('description'), image:newCategoryImage, active:true})}); formEl.reset(); newCategoryImage=''; $('#categoryImageHint').textContent='ক্যাটাগরির ছবি চাইলে এখানে আপলোড করুন।'; await loadAll(); toast('ক্যাটাগরি যোগ হয়েছে।'); }
  catch (err) { toast(err.message); }
});
$('#adminCategoryList').addEventListener('submit', async e => {
  const form = e.target.closest('[data-category-edit]'); if (!form) return;
  e.preventDefault();
  const payload = {name:form.elements.name.value.trim(), description:form.elements.description.value.trim(), image:categories.find(c=>c.id===Number(form.dataset.categoryEdit))?.image || '', active:true};
  try { await api(`/api/admin/categories/${form.dataset.categoryEdit}`, {method:'PUT', body:JSON.stringify(payload)}); await loadAll(); toast('ক্যাটাগরির তথ্য আপডেট হয়েছে।'); }
  catch (err) { toast(err.message); }
});
$('#adminCategoryList').addEventListener('click', async e => {
  const b = e.target.closest('[data-hide-category]'); if (!b) return;
  if (!confirm('এই ক্যাটাগরি ওয়েবসাইট থেকে লুকাবেন?')) return;
  try { await api(`/api/admin/categories/${b.dataset.hideCategory}`, {method:'DELETE'}); await loadAll(); toast('ক্যাটাগরি লুকানো হয়েছে।'); } catch (err) { toast(err.message); }
});
$('#categoryImageNew').addEventListener('change', async e => {
  const input=e.currentTarget, file=input.files?.[0]; if (!file) return;
  try { newCategoryImage=(await uploadFiles([file]))[0]; $('#categoryImageHint').textContent='ছবি আপলোড হয়েছে। এখন “যোগ করুন” চাপুন।'; }
  catch (err) { toast(err.message); } finally { input.value=''; }
});
$('#adminCategoryList').addEventListener('change', async e => {
  const input=e.target.closest('[data-cat-image]'); if (!input) return; const file=input.files?.[0]; if (!file) return;
  try { const url=(await uploadFiles([file]))[0]; await api(`/api/admin/categories/${input.dataset.catImage}/image`, {method:'PUT', body:JSON.stringify({image:url})}); await loadAll(); toast('ক্যাটাগরির ছবি সেভ হয়েছে।'); }
  catch (err) { toast(err.message); }
});
$('#heroImageFile').addEventListener('change', async e => {
  const input=e.currentTarget, file=input.files?.[0]; if (!file) return;
  try { const url=(await uploadFiles([file]))[0]; $('#settingsForm').elements.hero_image.value=url; toast('Hero ছবি আপলোড হয়েছে। এখন সেটিংস সংরক্ষণ করুন।'); }
  catch (err) { toast(err.message); } finally { input.value=''; }
});
$('#newArrivalImageFile').addEventListener('change', async e => {
  const input=e.currentTarget, file=input.files?.[0]; if (!file) return;
  try { const url=(await uploadFiles([file]))[0]; $('#settingsForm').elements.new_arrival_image.value=url; toast('New Arrival ছবি আপলোড হয়েছে। সেটিংস সংরক্ষণ করুন।'); }
  catch (err) { toast(err.message); } finally { input.value=''; }
});
$('#reviewImageFiles').addEventListener('change', async e => {
  const input=e.currentTarget, files=[...input.files||[]]; if (!files.length) return;
  if (editingReviewImages.length+files.length>10) { toast('সর্বোচ্চ ১০টি রিভিউ ছবি রাখা যাবে।'); input.value=''; return; }
  try { editingReviewImages.push(...await uploadFiles(files)); renderReviewImageSlots(); toast('রিভিউ ছবি আপলোড হয়েছে। সেটিংস সংরক্ষণ করুন।'); }
  catch (err) { toast(err.message); } finally { input.value=''; }
});
$('#reviewImageGrid').addEventListener('click', e => { const b=e.target.closest('[data-remove-review]'); if (!b) return; editingReviewImages.splice(Number(b.dataset.removeReview),1); renderReviewImageSlots(); });

$('#settingsForm').addEventListener('submit', async e => {
  e.preventDefault(); const f=e.currentTarget, payload={};
  const keys = ['store_name','hero_title','hero_subtitle','hero_button','hero_image','whatsapp_number','contact_text','announcement','footer_text','accent_color','theme','background_color','text_color','tagline','trust_customer_count','trust_rating_value','new_arrival_title','new_arrival_subtitle','new_arrival_image',
    'feature_1_title','feature_1_text','feature_2_title','feature_2_text','feature_3_title','feature_3_text','feature_4_title','feature_4_text','about_text','support_phone','support_email','shop_address','facebook_url','instagram_url','delivery_policy','return_policy','privacy_policy','seo_title','seo_description','seo_keywords','ga4_measurement_id','meta_pixel_id'];
  for (const key of keys) payload[key]=f.elements[key].value;
  payload.new_arrival_enabled=f.elements.new_arrival_enabled.checked;
  payload.trust_review_count=Number(f.elements.trust_review_count.value||0);
  payload.review_images=editingReviewImages;
  payload.dhaka_delivery_fee=Number(f.elements.dhaka_delivery_fee.value||0); payload.outside_delivery_fee=Number(f.elements.outside_delivery_fee.value||0);
  try { settings=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(payload)}); $('#settingsMessage').textContent='সেটিংস সংরক্ষণ হয়েছে।'; setTimeout(()=>$('#settingsMessage').textContent='',3500); toast('ওয়েবসাইটের সেটিংস আপডেট হয়েছে।'); }
  catch (err) { toast(err.message); }
});
async function refreshOrders() { try { orders=await api('/api/admin/orders'); renderOrders(); renderStats(); } catch (e) { toast(e.message); } }
async function pollOrders() { try { const latest=await api('/api/admin/orders'), count=latest.filter(o=>o.status==='new').length; if (count>lastNewOrderCount) toast('নতুন অর্ডার এসেছে। অর্ডার ট্যাবে দেখুন।'); orders=latest; renderStats(); if ($('#tab-orders').classList.contains('active')) renderOrders(); } catch { /* retry next poll */ } }
$('#refreshOrdersBtn').addEventListener('click', refreshOrders);
$('#adminOrderList').addEventListener('change', async e => {
  const sel=e.target.closest('[data-order-status]'); if (!sel) return;
  try { await api(`/api/admin/orders/${sel.dataset.orderStatus}/status`,{method:'PUT',body:JSON.stringify({status:sel.value})}); await refreshOrders(); toast('অর্ডারের স্ট্যাটাস আপডেট হয়েছে।'); }
  catch (err) { toast(err.message); }
});
$('#adminOrderList').addEventListener('click', async e => {
  const b=e.target.closest('[data-send-courier]'); if (!b) return;
  if (!confirm('কাস্টমারের সঙ্গে ফোনে কথা বলে অর্ডার নিশ্চিত করেছেন? নিশ্চিত হলে Steadfast-এ পাঠাবেন।')) return;
  b.disabled=true;
  try { await api(`/api/admin/orders/${b.dataset.sendCourier}/steadfast`,{method:'POST'}); await refreshOrders(); toast('Steadfast-এ অর্ডার পাঠানো হয়েছে।'); }
  catch (err) { toast(err.message); } finally { b.disabled=false; }
});
document.querySelectorAll('[data-close="productEditorOverlay"]').forEach(b=>b.addEventListener('click',closeEditor));
$('#productEditorOverlay').addEventListener('click',e=>{if(e.target.id==='productEditorOverlay')closeEditor();});
checkSession();
