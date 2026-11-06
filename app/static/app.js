const $ = s => document.querySelector(s);
const money = n => '৳' + Number(n || 0).toLocaleString('bn-BD', {maximumFractionDigits:0});
const bn = n => Number(n || 0).toLocaleString('bn-BD');
const state = {products:[], settings:{}, selected:null, size:'', color:'', quantity:1, startedAt:Date.now()};
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(url, opts={}) {
  const response = await fetch(url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.detail || 'দুঃখিত, অর্ডারটি সম্পন্ন হয়নি।');
  return data;
}
function effectivePrice(product){
  const sale = Number(product.sale_price);
  return product.sale_price !== null && product.sale_price !== undefined && Number.isFinite(sale) && sale < Number(product.price) ? sale : Number(product.price || 0);
}
function isFree(product){return !!product?.free_delivery && ['ফুল সেট','full set','full-set'].includes(String(product.category||'').trim().toLowerCase());}
function selectedArea(){return $('input[name="delivery_area"]:checked')?.value || 'dhaka';}
function feeFor(product, area){if(isFree(product)) return 0;return area==='dhaka'?Number(state.settings.dhaka_delivery_fee??50):Number(state.settings.outside_delivery_fee??100);}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500);}
function whatsappUrl(message){const number=String(state.settings.whatsapp_number||state.settings.support_phone||'').replace(/\D/g,'');return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:'#';}
function updateWhatsapp(){
  const msg='আসসালামু আলাইকুম, RIHAM-এর বোরকা কালেকশন সম্পর্কে জানতে চাই।';
  ['#contactWhatsapp','#floatingWhatsapp','#sizeHelpWhatsapp'].forEach(sel=>{const el=$(sel);if(el){el.href=whatsappUrl(msg);el.addEventListener('click',e=>{if(el.href.endsWith('#')){e.preventDefault();toast('WhatsApp নম্বর Admin Panel থেকে সেট করতে হবে।');}});}});
}
function getLookbookImages(){
  const result=[],seen=new Set();
  const products=[...state.products].sort((a,b)=>Number(a.id)-Number(b.id));
  products.forEach(product=>{
    (product.images||[]).forEach((src,index)=>{
      const url=String(src||'').trim();
      if(!url||seen.has(url))return;
      seen.add(url);
      result.push({src:url,product,view:index+1});
    });
  });
  return result;
}
function renderLookbook(){
  const root=$('#lookbook');
  const photos=getLookbookImages();
  if(!photos.length){root.innerHTML='<div class="lookbook-loading">Admin Panel থেকে product image যোগ করুন।</div>';return;}
  root.innerHTML=photos.map((item,index)=>{
    const viewNames=['প্রথম ভিউ','আরেকটি ভিউ','পেছনের ভিউ','ডিটেইল ভিউ','কালেকশনের ভিউ'];
    const productName=item.product.name||'RIHAM Collection';
    return `<figure class="lookbook-frame">
      <img src="${esc(item.src)}" alt="${esc(productName)} — ${esc(viewNames[(item.view-1)%viewNames.length])}" ${index>1?'loading="lazy"':'fetchpriority="high"'}>
      <figcaption class="lookbook-caption"><div><small>RIHAM COLLECTION · ${String(index+1).padStart(2,'0')} / ${photos.length}</small><h2>${esc(productName)}</h2><p>${esc(viewNames[(item.view-1)%viewNames.length])}</p></div><a class="lookbook-order" href="#order" data-order-product="${item.product.id}">অর্ডার করুন ↗</a></figcaption>
    </figure>`;
  }).join('');
  root.querySelectorAll('[data-order-product]').forEach(link=>link.addEventListener('click',()=>{
    const product=state.products.find(p=>String(p.id)===link.dataset.orderProduct);
    if(product && orderableProducts().some(p=>p.id===product.id)){state.selected=product;state.size='';state.quantity=1;renderOrderForm();}
  }));
  root.querySelectorAll('.lookbook-frame img').forEach(img=>img.addEventListener('error',()=>{
    img.style.opacity='0';img.parentElement.classList.add('image-unavailable');
    img.parentElement.insertAdjacentHTML('beforeend','<div class="image-error-note">ছবিটি source website থেকে লোড হয়নি</div>');
  },{once:true}));
}
function orderableProducts(){
  const list=state.products.filter(p=>p.active!==false && p.stock>0).sort((a,b)=>Number(a.id)-Number(b.id));
  const full=list.filter(p=>['ফুল সেট','full set','full-set'].includes(String(p.category||'').trim().toLowerCase()));
  const combo=list.filter(p=>/হিজাব/.test(p.category||'') && /নিকাব/.test(p.category||''));
  return [...full.slice(0,1),...combo.slice(0,1)];
}
function renderProductChoices(){
  const target=$('#orderProductChoices'),items=orderableProducts();
  if(!items.length){target.innerHTML='<p class="form-loading">Admin Panel থেকে একটি active ফুল সেট এবং একটি হিজাব + নিকাব পণ্য যোগ করুন।</p>';$('#confirmOrderBtn').disabled=true;return;}
  $('#confirmOrderBtn').disabled=false;
  if(!state.selected || !items.some(p=>p.id===state.selected.id)) state.selected=items[0];
  target.innerHTML=items.map((p,index)=>{
    const current=state.selected?.id===p.id;
    return `<label class="order-choice ${current?'selected':''}">
      ${index===0?'<span class="popular-tag">জনপ্রিয়</span>':''}
      <input type="radio" name="order_product" value="${p.id}" ${current?'checked':''}>
      <span><b class="choice-label">${esc(p.name)}</b><small class="choice-description">${esc(p.description||'প্রিমিয়াম বোরকা, হিজাব ও নিকাব সেট')}</small></span>
      <strong class="choice-price">${money(effectivePrice(p))}</strong><i class="choice-check">✓</i>
    </label>`;
  }).join('');
  target.querySelectorAll('input[name="order_product"]').forEach(input=>input.addEventListener('change',()=>{
    state.selected=items.find(p=>String(p.id)===input.value)||items[0];state.size='';state.color='';state.quantity=1;renderOrderForm();
  }));
}
function renderSizeChoices(){
  const sizes=state.selected?.sizes?.length?state.selected.sizes:['৪৮','৫০','৫২','৫৪','৫৬','৫৮'];
  if(state.size && !sizes.includes(state.size))state.size='';
  $('#orderSizeChoices').innerHTML=sizes.map(s=>`<button type="button" class="size-choice ${state.size===s?'selected':''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  $('#orderSizeChoices').querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{state.size=button.dataset.size;renderSizeChoices();updateSummary();}));
  const colors=state.selected?.colors||[];
  // The reference order form does not ask customers to choose a color; use the first Admin-configured color.
  $('#orderColorWrap').hidden=true;
  state.color=state.color||colors[0]||'';
}
function updateDeliverySelection(){
  document.querySelectorAll('[data-area-card]').forEach(card=>card.classList.toggle('selected',card.dataset.areaCard===selectedArea()));
}
function updateSummary(){
  const product=state.selected;if(!product)return;
  const subtotal=effectivePrice(product)*state.quantity, fee=feeFor(product,selectedArea());
  $('#qtyValue').textContent=bn(state.quantity);
  $('#productSubtotal').textContent=money(subtotal);
  $('#dhakaFeeLabel').textContent=isFree(product)?'ডেলিভারি চার্জ: ফ্রি':`ডেলিভারি চার্জ: ${money(state.settings.dhaka_delivery_fee??50)}`;
  $('#outsideFeeLabel').textContent=isFree(product)?'ডেলিভারি চার্জ: ফ্রি':`ডেলিভারি চার্জ: ${money(state.settings.outside_delivery_fee??100)}`;
  $('#orderSummary').innerHTML=`<h4>অর্ডার সারসংক্ষেপ</h4>
    <div class="summary-line"><span>${esc(product.name)} × ${bn(state.quantity)}${state.size?' · সাইজ '+esc(state.size):''}</span><strong>${money(subtotal)}</strong></div>
    <div class="summary-line"><span>ডেলিভারি চার্জ</span><strong>${fee===0?'ফ্রি':money(fee)}</strong></div>
    ${fee===0?'<p class="summary-note">সম্পূর্ণ ফুল সেটের জন্য ডেলিভারি চার্জ প্রযোজ্য নয়।</p>':''}
    <div class="summary-total"><b>সর্বমোট</b><strong>${money(subtotal+fee)}</strong></div>`;
  updateDeliverySelection();
}
function renderOrderForm(){renderProductChoices();renderSizeChoices();updateSummary();}
function startOrderForm(){
  $('#qtyMinus').addEventListener('click',()=>{state.quantity=Math.max(1,state.quantity-1);updateSummary();});
  $('#qtyPlus').addEventListener('click',()=>{const max=Number(state.selected?.stock||20);state.quantity=Math.min(max,20,state.quantity+1);updateSummary();});
  document.querySelectorAll('input[name="delivery_area"]').forEach(input=>input.addEventListener('change',updateSummary));
  $('#orderColor').addEventListener('change',e=>{state.color=e.target.value;});
  $('#inlineOrderForm').addEventListener('submit',submitOrder);
  renderOrderForm();
}
async function submitOrder(event){
  event.preventDefault();
  const form=event.currentTarget, data=new FormData(form), button=$('#confirmOrderBtn'), product=state.selected;
  if(!product){toast('প্রথমে পণ্য নির্বাচন করুন।');return;}
  if(product.sizes?.length && !state.size){toast('একটি সাইজ নির্বাচন করুন।');$('#orderSizeChoices').scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(state.quantity<1 || state.quantity>Number(product.stock||20)){toast('সঠিক পরিমাণ নির্বাচন করুন।');return;}
  const name=String(data.get('customer_name')||'').trim(),phone=String(data.get('phone')||'').replace(/[\s+-]/g,''),address=String(data.get('address')||'').trim();
  if(name.length<2){toast('আপনার পুরো নাম লিখুন।');form.elements.customer_name.focus();return;}
  if(!/^01\d{9}$/.test(phone)){toast('১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন।');form.elements.phone.focus();return;}
  if(address.length<8){toast('সম্পূর্ণ ঠিকানা লিখুন।');form.elements.address.focus();return;}
  const payload={customer_name:name,phone,address,note:'পেমেন্ট: ক্যাশ অন ডেলিভারি',delivery_area:selectedArea(),website:String(data.get('website')||''),form_started_at:state.startedAt,
    items:[{product_id:product.id,quantity:state.quantity,size:state.size||'',color:state.color||''}]};
  button.disabled=true;button.textContent='অর্ডার পাঠানো হচ্ছে…';
  try{
    const result=await api('/api/orders',{method:'POST',body:JSON.stringify(payload)});
    const order=result.order;
    $('#orderSuccess').hidden=false;
    $('#orderSuccess').innerHTML=`<strong>অর্ডার সফলভাবে গ্রহণ করা হয়েছে!</strong><br>অর্ডার নম্বর: <b>${esc(order.invoice)}</b><br>সর্বমোট: <b>${money(order.total)}</b><br>আমরা ফোনে যোগাযোগ করে অর্ডার নিশ্চিত করব।`;
    $('#orderSuccess').scrollIntoView({behavior:'smooth',block:'center'});
    toast('আপনার অর্ডার গ্রহণ করা হয়েছে।');
    form.reset();state.quantity=1;state.size='';state.color='';state.startedAt=Date.now();
    const first=orderableProducts()[0];if(first)state.selected=first;renderOrderForm();
  }catch(error){toast(error.message||'অর্ডার পাঠানো যায়নি। আবার চেষ্টা করুন।');}
  finally{button.disabled=false;button.textContent='🛒 অর্ডার কনফার্ম করুন';}
}
async function boot(){
  $('#year').textContent=new Date().getFullYear();
  try{
    const [products,settings]=await Promise.all([api('/api/products'),api('/api/settings')]);
    state.products=products;state.settings=settings;
    document.documentElement.style.setProperty('--riham-green',settings.accent_color||'#176b39');
    document.documentElement.style.setProperty('--riham-green-dark',settings.accent_color||'#13592f');
    document.title=`${settings.store_name||'RIHAM'} — বোরকা কালেকশন`;
    document.querySelectorAll('.brand-words b,.footer-brand-line b').forEach(el=>el.textContent=settings.store_name||'RIHAM');
    const title=settings.hero_title||'শালীনতায় থাকুক নিজস্ব সৌন্দর্য';
    if($('#introTitle')) $('#introTitle').textContent=title.replace(/<[^>]*>/g,'');
    if($('#introText')) $('#introText').textContent=settings.hero_subtitle||'আমাদের বোরকা কালেকশনের প্রতিটি ডিজাইন ভালোভাবে দেখে পছন্দ করুন।';
    updateWhatsapp();renderLookbook();startOrderForm();
  }catch(error){
    $('#lookbook').innerHTML='<div class="lookbook-loading">কালেকশন লোড করা যায়নি। অনুগ্রহ করে পেজ রিফ্রেশ করুন।</div>';
    $('#orderProductChoices').innerHTML=`<p class="form-loading">${esc(error.message)}</p>`;
    $('#confirmOrderBtn').disabled=true;
  }
}
boot();
