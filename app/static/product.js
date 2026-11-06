const $ = s => document.querySelector(s);
document.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.fallbackHandled) return;
  img.dataset.fallbackHandled = '1';
  const parent = img.parentElement;
  if (parent?.classList.contains('detail-main-image')) {
    img.remove();
    const fallback = document.createElement('div'); fallback.className = 'photo-placeholder';
    fallback.innerHTML = '<span class="placeholder-mark">R.</span><small>ছবি পাওয়া যায়নি</small>';
    parent.appendChild(fallback);
  } else if (parent?.classList.contains('detail-thumb')) {
    parent.hidden = true;
  } else img.style.visibility = 'hidden';
}, true);
const money = n => '৳' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits:0});
let waNumber='', product=null, settings={}, selectedSize='', selectedColor='', qty=1, buyStartedAt=0, currentImage=0;
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(url,opts={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'কাজটি সম্পন্ন হয়নি।');return d;}
function toast(msg){const el=$('#productToast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000);}
function waLink(text){return 'https://wa.me/'+waNumber+'?text='+encodeURIComponent(text);}
function wireWhatsapp(el,textFn){if(!el)return;el.href=waNumber?waLink(textFn()):'#';el.addEventListener('click',e=>{if(!waNumber){e.preventDefault();toast('WhatsApp নম্বর এখনো সেট করা হয়নি।');return;}el.href=waLink(textFn());});}
function price(p){return p.sale_price!==null&&p.sale_price!==undefined&&p.sale_price<p.price?p.sale_price:p.price;}
function chosenArea(form){return form.querySelector('input[name="delivery_area"]:checked')?.value||'dhaka';}
function isFullSetFree(p=product){return !!p?.free_delivery && ['ফুল সেট','full set','full-set'].includes(String(p?.category||'').trim().toLowerCase());}
function calcFee(area){if(isFullSetFree())return 0;return area==='dhaka'?Number(settings.dhaka_delivery_fee??50):Number(settings.outside_delivery_fee??100);}
function updateBuySummary(){
  const form=$('#buyNowForm'); if(!form)return;
  const area=chosenArea(form),sub=price(product)*qty,fee=calcFee(area),free=isFullSetFree();
  const d=form.querySelector('[data-delivery-label="dhaka"]'), o=form.querySelector('[data-delivery-label="outside"]');
  if(d)d.textContent=free?'এই পণ্যে ফ্রি':money(Number(settings.dhaka_delivery_fee??50))+' ডেলিভারি';
  if(o)o.textContent=free?'এই পণ্যে ফ্রি':money(Number(settings.outside_delivery_fee??100))+' ডেলিভারি';
  $('#buySummary').innerHTML=`<div>${esc(product.name)} × ${qty}<span>${money(sub)}</span></div><div class="summary-line">ডেলিভারি <span>${fee===0?'ফ্রি':money(fee)}</span></div>${fee===0?'<p class="free-shipping-note">এই ফুল সেটের সঙ্গে ডেলিভারি চার্জ লাগবে না।</p>':''}<strong class="summary-line">সর্বমোট: <span>${money(sub+fee)}</span></strong>`;
}
function showImage(src){const im=$('#detailMainImage img');if(!im)return;im.style.opacity='0.25';const next=new Image();next.onload=()=>{im.src=src;im.style.opacity='1';};next.onerror=()=>{im.src=src;im.style.opacity='1';};next.src=src;const idx=(product.images||[]).indexOf(src);if(idx>=0){currentImage=idx;document.querySelectorAll('#productPageContent [data-image]').forEach((x,k)=>x.classList.toggle('active',k===idx));const c=$('#imgCounter');if(c)c.textContent=(idx+1)+' / '+product.images.length;}}
function setupGallery(imgs){if(!imgs||imgs.length<2)return;const m=$('#detailMainImage');m.classList.add('multi');m.insertAdjacentHTML('beforeend','<button type="button" class="g-arrow g-prev" aria-label="আগের ছবি">‹</button><button type="button" class="g-arrow g-next" aria-label="পরের ছবি">›</button><span class="g-count" id="imgCounter">1 / '+imgs.length+'</span>');const go=d=>showImage(imgs[(currentImage+d+imgs.length)%imgs.length]);m.querySelector('.g-prev').addEventListener('click',()=>go(-1));m.querySelector('.g-next').addEventListener('click',()=>go(1));let x0=null;m.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});m.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40)go(dx<0?1:-1);},{passive:true});}
function optionButtons(vals,type){if(!vals?.length)return '';const current=type==='size'?selectedSize:selectedColor;return `<div class="option-group"><label class="option-label">${type==='size'?'সাইজ নির্বাচন করুন':'রং নির্বাচন করুন'}</label><div class="option-list">${vals.map(v=>`<button type="button" class="option-btn ${current===v?'selected':''}" data-option="${type}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`;}
function validateOptions(){if(product.sizes?.length&&!selectedSize){toast('একটি সাইজ নির্বাচন করুন।');return false;}if(product.colors?.length&&!selectedColor){toast('একটি রং নির্বাচন করুন।');return false;}if(product.stock<qty){toast('পর্যাপ্ত স্টক নেই।');return false;}return true;}
function openBuy(){if(!validateOptions())return;$('#buyNowForm').reset();qty=Math.max(1,qty);buyStartedAt=Date.now();updateBuySummary();$('#buyNowOverlay').classList.add('open');document.body.style.overflow='hidden';}
function closeBuy(){ $('#buyNowOverlay').classList.remove('open');document.body.style.overflow=''; }
function render(){
  const p=product,sale=p.sale_price!==null&&p.sale_price!==undefined&&p.sale_price<p.price,imgs=p.images||[];
  selectedSize=p.sizes?.[0]||'';selectedColor=p.colors?.[0]||'';
  $('#crumbCategory').textContent=p.category;$('#crumbName').textContent=p.name;document.title=p.name+' · '+(settings.store_name||'RIHAM');
  $('#productPageContent').innerHTML=`<div class="product-detail-layout"><div class="detail-gallery"><div class="detail-main-image" id="detailMainImage">${imgs.length?`<img src="${esc(imgs[0])}" alt="${esc(p.name)}">`:'<div class="photo-placeholder"><span class="placeholder-mark">R.</span><small>PRODUCT IMAGE</small></div>'}</div>${imgs.length>1?`<div class="detail-thumbs">${imgs.map((im,i)=>`<button type="button" class="detail-thumb ${i===0?'active':''}" data-image="${esc(im)}"><img src="${esc(im)}" alt="পণ্যের ছবি ${i+1}"></button>`).join('')}</div>`:''}</div><div class="detail-copy"><span class="product-category">${esc(p.category)}</span><h1>${esc(p.name)}</h1><div class="detail-price">${money(price(p))}${sale?`<del>${money(p.price)}</del>`:''}</div>${sale?`<div class="discount-text">${p.discount_percent}% ছাড় · আপনি সাশ্রয় করছেন ${money(p.price-p.sale_price)}</div>`:''}<p class="detail-description">${esc(p.description)}</p>${p.sizes?.length?`<details class="size-guide-box"><summary>সাইজ কীভাবে বেছে নেব?</summary><p>${esc(p.size_guide||'আপনার পরিচিত মাপের সঙ্গে সাইজ মিলিয়ে নিন। সঠিক মাপ নিয়ে নিশ্চিত না হলে অর্ডারের আগে WhatsApp-এ আমাদের জিজ্ঞেস করুন।')}</p></details>`:''}${optionButtons(p.sizes,'size')}${optionButtons(p.colors,'color')}<div class="option-label">পরিমাণ নির্বাচন করুন</div><div class="qty-control"><button type="button" data-qty="-">−</button><span id="qtyValue">1</span><button type="button" data-qty="+">+</button></div><div class="detail-add"><button id="addCart" class="primary-btn">কার্টে যোগ করুন</button><button id="buyNow" class="outline-btn">এখনই অর্ডার করুন</button></div><a id="waOrder" class="wa-btn wa-block" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#waIcon"/></svg>WhatsApp-এ অর্ডার করুন</a><div class="stock-note">${p.stock>0?'স্টকে আছে · '+p.stock+' টি':'স্টক শেষ'}</div><p class="small-muted">ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।</p><p class="small-muted">${isFullSetFree(p)?'এই সম্পূর্ণ ফুল সেটে ডেলিভারি ফ্রি।':'ঢাকার ভিতরে ৳'+Number(settings.dhaka_delivery_fee??50)+' · ঢাকার বাইরে ৳'+Number(settings.outside_delivery_fee??100)}</p></div></div>`;
  $('#productPageContent').querySelectorAll('[data-option]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.option;if(t==='size')selectedSize=b.dataset.value;else selectedColor=b.dataset.value;$('#productPageContent').querySelectorAll(`[data-option="${t}"]`).forEach(x=>x.classList.toggle('selected',x===b));}));
  $('#productPageContent').querySelectorAll('[data-image]').forEach(b=>b.addEventListener('click',()=>showImage(b.dataset.image)));
  setupGallery(imgs);
  $('#productPageContent').querySelectorAll('[data-qty]').forEach(b=>b.addEventListener('click',()=>{qty=Math.max(1,Math.min(p.stock||1,qty+(b.dataset.qty==='+'?1:-1)));$('#qtyValue').textContent=qty;}));
  $('#addCart').addEventListener('click',()=>{if(!validateOptions())return;const cart=JSON.parse(localStorage.getItem('riham_cart')||'[]');const key=[p.id,selectedSize,selectedColor].join('|'),old=cart.find(x=>x.key===key);if(old)old.quantity=Math.min(old.quantity+qty,20);else cart.push({key,product_id:p.id,quantity:qty,size:selectedSize,color:selectedColor});localStorage.setItem('riham_cart',JSON.stringify(cart));location.href='/?cart=open';});
  $('#buyNow').addEventListener('click',openBuy);
  wireWhatsapp($('#waOrder'),()=>['আসসালামু আলাইকুম, আমি এই পণ্যটি অর্ডার করতে চাই।','পণ্য: '+p.name,selectedSize?'সাইজ: '+selectedSize:'',selectedColor?'রং: '+selectedColor:'','পরিমাণ: '+qty,'দাম: '+money(price(p)*qty),isFullSetFree(p)?'ডেলিভারি: ফুল সেটে ফ্রি':'ডেলিভারি: ঢাকার ভিতরে '+money(settings.dhaka_delivery_fee??50)+' / ঢাকার বাইরে '+money(settings.outside_delivery_fee??100),location.href].filter(Boolean).join('\n'));
}
$('#buyNowForm').addEventListener('change',e=>{if(e.target.name==='delivery_area')updateBuySummary();});
$('#buyNowForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!validateOptions())return;const f=new FormData(e.currentTarget),form=e.currentTarget,btn=form.querySelector('button[type="submit"]');
  const payload={customer_name:f.get('customer_name'),phone:f.get('phone'),address:f.get('address'),note:f.get('note'),delivery_area:chosenArea(form),website:f.get('website')||'',form_started_at:buyStartedAt,items:[{product_id:product.id,quantity:qty,size:selectedSize,color:selectedColor}]};
  btn.disabled=true;btn.textContent='অর্ডার পাঠানো হচ্ছে…';
  try{const d=await api('/api/orders',{method:'POST',body:JSON.stringify(payload)});closeBuy();toast('অর্ডার সফল! '+d.order.invoice);setTimeout(()=>alert(`ধন্যবাদ! আপনার অর্ডার গ্রহণ করা হয়েছে।\nOrder ID: ${d.order.invoice}\nসর্বমোট: ${money(d.order.total)}\nআমরা ফোনে যোগাযোগ করে অর্ডার নিশ্চিত করব।`),100);}
  catch(err){toast(err.message);}finally{btn.disabled=false;btn.innerHTML='অর্ডার কনফার্ম করুন <span>→</span>';}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)closeBuy();});
$('#buyNowOverlay').addEventListener('click',e=>{if(e.target.id==='buyNowOverlay')closeBuy();});
$('#year').textContent=new Date().getFullYear();
(async()=>{try{
  const id=Number(location.pathname.split('/').filter(Boolean).pop());[product,settings]=await Promise.all([api('/api/products/'+id),api('/api/settings')]);
  document.documentElement.style.setProperty('--brown',settings.accent_color||'#3f5a3b');document.documentElement.style.setProperty('--white',settings.background_color||'#ffffff');document.documentElement.style.setProperty('--ink',settings.text_color||'#2b2926');
  $('#announcement').textContent=settings.announcement||'ফুল সেটে ডেলিভারি ফ্রি · সারা দেশে ক্যাশ অন ডেলিভারি';document.querySelectorAll('.brand').forEach(b=>{if(b.childNodes[0])b.childNodes[0].textContent=settings.store_name||'RIHAM';});document.body.dataset.theme=settings.theme||'white';
  $('#productFooterText').textContent=settings.footer_text||'বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন।';
  document.documentElement.style.setProperty('--brown',settings.accent_color||'#3f5a3b');document.documentElement.style.setProperty('--white',settings.background_color||'#ffffff');document.documentElement.style.setProperty('--ink',settings.text_color||'#2b2926');
  waNumber=(settings.whatsapp_number||'').replace(/\D/g,'');wireWhatsapp($('#productWhatsapp'),()=>'আসসালামু আলাইকুম, আমি '+product.name+' অর্ডার করতে চাই।');wireWhatsapp($('#productFloatingWhatsapp'),()=>'আসসালামু আলাইকুম, আমি '+product.name+' অর্ডার করতে চাই।');
  const desc=settings.seo_description||'বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন।';let md=document.querySelector('meta[name="description"]');if(md)md.content=desc;
  let og=document.querySelector('meta[property="og:title"]');if(!og){og=document.createElement('meta');og.setAttribute('property','og:title');document.head.appendChild(og);}og.content=product.name+' · '+(settings.store_name||'RIHAM');
  const ld={"@context":"https://schema.org","@type":"Product","name":product.name,"description":product.description,"image":product.images||[],"offers":{"@type":"Offer","priceCurrency":"BDT","price":price(product),"availability":product.stock>0?"https://schema.org/InStock":"https://schema.org/OutOfStock","url":location.href}};let l=document.createElement('script');l.type='application/ld+json';l.textContent=JSON.stringify(ld).replace(/</g,'\\u003c');document.head.appendChild(l);
  const cart=JSON.parse(localStorage.getItem('riham_cart')||'[]');$('#cartCount').textContent=cart.reduce((a,x)=>a+x.quantity,0);render();
}catch(e){$('#productPageContent').innerHTML=`<div class="empty-state">${esc(e.message)} <br><a class="outline-btn" href="/">স্টোরে ফিরে যান</a></div>`;}})();
