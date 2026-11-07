const $ = s => document.querySelector(s);
const money = n => '৳' + Number(n || 0).toLocaleString('bn-BD', {maximumFractionDigits:0});
const bn = n => Number(n || 0).toLocaleString('bn-BD');
const isLanding = document.body.dataset.page === 'landing';
const state = {products:[], settings:{}, selected:null, size:'', color:'', quantity:1, startedAt:Date.now()};
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(url, opts={}) {
  const response = await fetch(url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});
  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    let msg=data.detail;
    if(Array.isArray(msg)) msg='অনুগ্রহ করে নাম, মোবাইল নম্বর ও ঠিকানা সঠিকভাবে লিখুন।';
    throw new Error(msg || 'দুঃখিত, অর্ডারটি সম্পন্ন হয়নি।');
  }
  return data;
}
function effectivePrice(product){
  const sale = Number(product.sale_price);
  return product.sale_price !== null && product.sale_price !== undefined && Number.isFinite(sale) && sale < Number(product.price) ? sale : Number(product.price || 0);
}
function isFree(product){return !!product?.free_delivery && ['ফুল সেট','full set','full-set'].includes(String(product.category||'').trim().toLowerCase());}
function normalizeDigits(v){return String(v||'').replace(/[০-৯٠-٩]/g,ch=>{const code=ch.charCodeAt(0);return String(code>=0x09e6&&code<=0x09ef?code-0x09e6:code-0x0660);});}
function normalizePhone(v){
  let d=normalizeDigits(v).replace(/\D/g,'');
  if(d.startsWith('880')&&d.length===13)d='0'+d.slice(3);
  else if(d.length===10&&d.startsWith('1'))d='0'+d;
  return d;
}
function selectedArea(){return $('input[name="delivery_area"]:checked')?.value || 'outside';}
function feeFor(product, area){if(isFree(product)) return 0;return area==='dhaka'?Number(state.settings.dhaka_delivery_fee??50):Number(state.settings.outside_delivery_fee??100);}
const _tracked={};
function trackOnce(name,data){ if(_tracked[name])return; _tracked[name]=1; if(window.rihamTrack) window.rihamTrack(name,data||trackData()); }
function trackData(){
  const p=state.selected; if(!p) return {};
  return {content_type:'product',content_ids:[Number(p.id)],content_name:p.name,contents:[{id:String(p.id),quantity:state.quantity,item_price:effectivePrice(p)}],currency:'BDT',value:effectivePrice(p)*state.quantity};
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500);}
function whatsappUrl(message){
  let number=normalizeDigits(state.settings.whatsapp_number||state.settings.support_phone||'').replace(/\D/g,'');
  if(number.startsWith('0')&&number.length===11) number='88'+number;
  else if(number.length===10&&number.startsWith('1')) number='880'+number;
  return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:'#';
}
function updateWhatsapp(){
  const p=isLanding?state.selected:null;
  const msg=p
    ? `আসসালামু আলাইকুম, ${p.name} সম্পর্কে জানতে চাই। দাম: ${money(effectivePrice(p))}। পেজ: ${location.href}`
    : `আসসালামু আলাইকুম, ${state.settings.store_name||'RIHAM STORE'}-এর কালেকশন সম্পর্কে জানতে চাই।`;
  ['#contactWhatsapp','#floatingWhatsapp','#sizeHelpWhatsapp','#landingSizeWhatsapp','#footerWhatsapp'].forEach(sel=>{const el=$(sel);if(el){el.href=whatsappUrl(msg);if(sel==='#footerWhatsapp'){const display=state.settings.whatsapp_number||state.settings.support_phone||'';el.textContent=display?`WhatsApp নম্বর: ${display}`:'WhatsApp-এ যোগাযোগ করুন';}el.onclick=e=>{if(el.href.endsWith('#')){e.preventDefault();toast('যোগাযোগের নম্বর এখনো সেট করা হয়নি।');}};}});
}
function renderLookbook(){
  const root=$('#lookbook');
  if(isLanding){renderLandingGallery();return;}
  const products=[...state.products].filter(p=>p.active!==false).sort((a,b)=>Number(b.featured)-Number(a.featured)||Number(b.id)-Number(a.id));
  if(!products.length){root.innerHTML='<div class="lookbook-loading">এখনো কোনো পণ্য যোগ করা হয়নি।</div>';return;}
  root.innerHTML=products.map((product,index)=>{
    const src=(product.images||[]).find(Boolean)||'';
    const inStock=Number(product.stock||0)>0;
    const slug=encodeURIComponent(product.slug||'');
    const image=src
      ? `<img src="${esc(src)}" alt="${esc(product.name||'RIHAM পণ্য')}" ${index===0?'fetchpriority="high"':''} loading="${index===0?'eager':'lazy'}" decoding="async">`
      : '<div class="home-product-no-image"><span>✦</span><b>পণ্যের ছবি যোগ করা হয়নি</b><small>ছবি দেখতে Admin Panel থেকে আপলোড করুন</small></div>';
    return `<article class="home-product-card" data-reveal>
      <a class="home-product-photo" href="/${slug}" aria-label="${esc(product.name)} — বিস্তারিত দেখুন">${image}<span class="home-photo-index">${bn(index+1)} / ${bn(products.length)}</span></a>
      <div class="home-product-info">
        <div class="home-product-copy"><span class="home-product-kicker">রিহাম স্টোর কালেকশন</span><h2>${esc(product.name||'নতুন পণ্য')}</h2><div class="home-product-price">${priceMarkup(product)}</div></div>
        <a class="home-product-cta" href="/${slug}">${inStock?'অর্ডার করুন':'বিস্তারিত দেখুন'} <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
  }).join('');
  root.querySelectorAll('.home-product-photo img').forEach(img=>img.addEventListener('error',()=>{
    img.remove();const holder=img.closest('.home-product-photo');holder.classList.add('image-unavailable');
    holder.insertAdjacentHTML('afterbegin','<div class="home-product-no-image"><span>✦</span><b>ছবিটি লোড করা যায়নি</b><small>বিস্তারিত দেখতে পণ্যের পেজ খুলুন</small></div>');
  },{once:true}));
  // Reveal each product card only as it enters the viewport; reduced-motion users get a static page.
  const cards=root.querySelectorAll('[data-reveal]');
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){cards.forEach(card=>card.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  cards.forEach(card=>observer.observe(card));
}

function priceMarkup(product){
  const sale=product.sale_price!==null&&product.sale_price!==undefined&&Number(product.sale_price)<Number(product.price);
  return sale?`<strong>${money(product.sale_price)}</strong><del>${money(product.price)}</del><span>${bn(product.discount_percent||Math.round((Number(product.price)-Number(product.sale_price))/Number(product.price)*100))}% ছাড়</span>`:`<strong>${money(product.price)}</strong>`;
}
function renderLandingDetails(){
  const p=state.selected, root=$('#landingProductDetails'); if(!p||!root)return;
  const stock=Number(p.stock||0);
  root.innerHTML=`<div class="landing-details-inner"><p class="eyebrow">পণ্যের বিস্তারিত</p><h1>${esc(p.name)}</h1><div class="landing-price">${priceMarkup(p)}</div><p class="landing-description">${esc(p.description||'পণ্যের বিস্তারিত জানতে WhatsApp-এ যোগাযোগ করুন।')}</p>${p.size_guide?`<div class="landing-size-guide"><b>সাইজ গাইড</b><p>${esc(p.size_guide)}</p></div>`:''}<p class="landing-stock ${stock>0?'in-stock':'out-stock'}">${stock>0?`স্টকে আছে · ${bn(stock)}টি`:'স্টক শেষ'}</p><a id="landingSizeWhatsapp" class="landing-size-help" href="#" target="_blank" rel="noopener">সাইজ নিশ্চিত না হলে WhatsApp-এ জিজ্ঞেস করুন →</a></div>`;
  const button=$('#confirmOrderBtn'), header=$('.header-order');
  if(button){button.disabled=stock<=0;button.textContent=stock>0?'🛒 অর্ডার কনফার্ম করুন':'স্টক শেষ';}
  if(header){header.classList.toggle('stock-unavailable',stock<=0);header.setAttribute('aria-disabled',stock<=0?'true':'false');header.href=stock>0?'#order':'#landingProductDetails';}
  updateWhatsapp();
}
function renderLandingGallery(){
  const root=$('#lookbook'), p=state.selected; if(!root||!p)return;
  const photos=(p.images||[]).filter(Boolean).slice(0,6);
  if(!photos.length){root.innerHTML='<div class="lookbook-loading">এই পণ্যের ছবি এখনো যোগ করা হয়নি।</div>';return;}
  const stock=Number(p.stock||0)>0;
  root.innerHTML=`<div class="landing-gallery-shell">
    <div class="landing-gallery-viewport" role="region" aria-roledescription="carousel" aria-label="${esc(p.name)}-এর ছবি">
      <div class="landing-gallery-track">${photos.map((src,index)=>`<figure class="landing-gallery-slide" aria-label="${bn(index+1)} / ${bn(photos.length)}">
        <img src="${esc(src)}" alt="${esc(p.name)} — ${bn(index+1)} নম্বর ছবি" ${index===0?'fetchpriority="high"':''} loading="${index===0?'eager':'lazy'}" decoding="async">
        <figcaption class="landing-gallery-caption"><div><small>RIHAM STORE · ${bn(index+1)} / ${bn(photos.length)}</small><h2>${esc(p.name)}</h2><div class="landing-caption-price">${priceMarkup(p)}</div></div>${stock?'<a class="lookbook-order" href="#order">অর্ডার করুন ↗</a>':'<span class="lookbook-order is-disabled">স্টক শেষ</span>'}</figcaption>
      </figure>`).join('')}</div>
      ${photos.length>1?'<button class="gallery-arrow gallery-prev" type="button" aria-label="আগের ছবি">‹</button><button class="gallery-arrow gallery-next" type="button" aria-label="পরের ছবি">›</button>':''}
    </div>
    ${photos.length>1?`<div class="landing-gallery-controls" aria-label="ছবি নির্বাচন">${photos.map((_,i)=>`<button type="button" data-gallery-dot="${i}" aria-label="${bn(i+1)} নম্বর ছবি" class="${i===0?'active':''}"></button>`).join('')}</div>`:''}
  </div>`;
  root.querySelectorAll('.landing-gallery-slide img').forEach(img=>img.addEventListener('error',()=>{
    img.style.visibility='hidden';img.closest('.landing-gallery-slide').classList.add('image-unavailable');
    img.insertAdjacentHTML('afterend','<div class="image-error-note">ছবিটি লোড করা যায়নি</div>');
  },{once:true}));
  if(photos.length>1) startLandingCarousel(root,photos.length);
}
function startLandingCarousel(root,count){
  const track=root.querySelector('.landing-gallery-track'),dots=[...root.querySelectorAll('[data-gallery-dot]')];
  if(!track||count<2)return;
  let index=0,timer=null,visible=true,touchStartX=null;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint=next=>{
    index=(next+count)%count;
    track.style.transform=`translate3d(-${index*100}%,0,0)`;
    dots.forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-current',i===index?'true':'false');});
  };
  const stop=()=>{if(timer){clearInterval(timer);timer=null;}};
  const start=()=>{stop();if(!reduced&&visible&&!document.hidden)timer=setInterval(()=>paint(index+1),2800);};
  root.querySelector('.gallery-prev')?.addEventListener('click',()=>{paint(index-1);start();});
  root.querySelector('.gallery-next')?.addEventListener('click',()=>{paint(index+1);start();});
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>{paint(i);start();}));
  root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',start);
  root.addEventListener('focusin',stop);root.addEventListener('focusout',start);
  root.addEventListener('touchstart',event=>{touchStartX=event.changedTouches[0]?.clientX??null;stop();},{passive:true});
  root.addEventListener('touchend',event=>{
    const end=event.changedTouches[0]?.clientX;
    if(touchStartX!==null&&Number.isFinite(end)&&Math.abs(end-touchStartX)>45)paint(index+(end<touchStartX?1:-1));
    touchStartX=null;start();
  },{passive:true});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;visible?start():stop();},{threshold:.12});observer.observe(root);}
  start();
}

function orderableProducts(){
  // Every published product that is in stock can be ordered (new products added from Admin appear here automatically).
  return state.products.filter(p=>p.active!==false && Number(p.stock)>0).sort((a,b)=>Number(a.id)-Number(b.id));
}
function renderProductChoices(){
  const target=$('#orderProductChoices');
  if(!target)return;
  const items=orderableProducts();
  if(!items.length){target.innerHTML='<p class="form-loading">এই মুহূর্তে কোনো পণ্য স্টকে নেই। বিস্তারিত জানতে WhatsApp-এ যোগাযোগ করুন।</p>';$('#confirmOrderBtn').disabled=true;return;}
  $('#confirmOrderBtn').disabled=false;
  if(!state.selected || !items.some(p=>p.id===state.selected.id)) state.selected=items[0];
  target.innerHTML=items.map((p,index)=>{
    const current=state.selected?.id===p.id;
    return `<label class="order-choice ${current?'selected':''}">
      ${p.featured?'<span class="popular-tag">জনপ্রিয়</span>':''}
      <input type="radio" name="order_product" value="${p.id}" ${current?'checked':''}>
      <span><b class="choice-label">${esc(p.name)}</b><small class="choice-description">${esc(p.category||'')}${p.description?' · '+esc(p.description):''}</small></span>
      <strong class="choice-price">${money(effectivePrice(p))}</strong><i class="choice-check">✓</i>
    </label>`;
  }).join('');
  target.querySelectorAll('input[name="order_product"]').forEach(input=>input.addEventListener('change',()=>{
    state.selected=items.find(p=>String(p.id)===input.value)||items[0];state.size='';state.color='';state.quantity=1;renderOrderForm();
  }));
}
function renderSizeChoices(){
  const sizes=state.selected?.sizes||[], colors=state.selected?.colors||[];
  const step=$('#orderSizeStep'); if(step) step.hidden=!sizes.length&&colors.length<2;
  const heading=step?.querySelector('h4');if(heading)heading.hidden=!sizes.length;
  const unitLabel=heading?.querySelector('small');if(unitLabel)unitLabel.hidden=sizes.length>0&&sizes.every(size=>String(size).includes('ফ্রি'));
  $('#orderSizeChoices').hidden=!sizes.length;
  const sizeHelp=step?.querySelector('.size-help');if(sizeHelp)sizeHelp.hidden=!sizes.length;
  if(state.size && !sizes.includes(state.size))state.size='';
  $('#orderSizeChoices').innerHTML=sizes.map(s=>`<button type="button" class="size-choice ${state.size===s?'selected':''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  $('#orderSizeChoices').querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{state.size=button.dataset.size;renderSizeChoices();updateSummary();}));
  // One colour -> used automatically. Several colours -> customer must be able to choose.
  if(!colors.includes(state.color)) state.color=colors[0]||'';
  $('#orderColorWrap').hidden=colors.length<2;
  $('#orderColor').innerHTML=colors.map(c=>`<option value="${esc(c)}" ${c===state.color?'selected':''}>${esc(c)}</option>`).join('');
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
  $('#qtyPlus').addEventListener('click',()=>{const max=Math.min(20,Number(state.selected?.stock??20));if(max>0)state.quantity=Math.min(max,state.quantity+1);updateSummary();});
  document.querySelectorAll('input[name="delivery_area"]').forEach(input=>input.addEventListener('change',updateSummary));
  $('#orderColor').addEventListener('change',e=>{state.color=e.target.value;});
  $('#inlineOrderForm').addEventListener('submit',submitOrder);
  $('#inlineOrderForm').addEventListener('focusin',()=>trackOnce('InitiateCheckout'));
  renderOrderForm();
}
async function submitOrder(event){
  event.preventDefault();
  const form=event.currentTarget, data=new FormData(form), button=$('#confirmOrderBtn'), product=state.selected;
  if(!product){toast('প্রথমে পণ্য নির্বাচন করুন।');return;}
  if(Number(product.stock)<=0){toast('দুঃখিত, এই পণ্যটির স্টক শেষ।');return;}
  if(product.sizes?.length && !state.size){toast('একটি সাইজ নির্বাচন করুন।');$('#orderSizeChoices').scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(state.quantity<1 || state.quantity>Number(product.stock||20)){toast('সঠিক পরিমাণ নির্বাচন করুন।');return;}
  const name=String(data.get('customer_name')||'').trim(),phone=normalizePhone(data.get('phone')),address=String(data.get('address')||'').trim();
  if(name.length<2){toast('আপনার পুরো নাম লিখুন।');form.elements.customer_name.focus();return;}
  if(!/^01[3-9]\d{8}$/.test(phone)){toast('১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন।');form.elements.phone.focus();return;}
  if(address.length<8){toast('সম্পূর্ণ ঠিকানা লিখুন।');form.elements.address.focus();return;}
  const payload={customer_name:name,phone,address,note:String(data.get('note')||'').trim(),delivery_area:selectedArea(),website:String(data.get('website')||''),form_started_at:state.startedAt,
    items:[{product_id:product.id,quantity:state.quantity,size:state.size||'',color:state.color||''}]};
  button.disabled=true;button.textContent='অর্ডার পাঠানো হচ্ছে…';
  try{
    const result=await api('/api/orders',{method:'POST',body:JSON.stringify(payload)});
    const order=result.order;
    if(window.rihamTrack) window.rihamTrack('GenerateLead',{...trackData(),value:Number(order.total||0),currency:'BDT',transaction_id:order.invoice,order_id:order.id,order_invoice:order.invoice});
    if(isLanding){product.stock=Math.max(0,Number(product.stock||0)-state.quantity);renderLandingDetails();}
    $('#orderSuccess').hidden=false;
    $('#orderSuccess').innerHTML=`<strong>অর্ডার সফলভাবে গ্রহণ করা হয়েছে!</strong><br>অর্ডার নম্বর: <b>${esc(order.invoice)}</b><br>সর্বমোট: <b>${money(order.total)}</b><br>আমরা ফোনে যোগাযোগ করে অর্ডার নিশ্চিত করব।`;
    $('#orderSuccess').scrollIntoView({behavior:'smooth',block:'center'});
    toast('আপনার অর্ডার গ্রহণ করা হয়েছে।');
    form.reset();state.quantity=1;state.size='';state.color='';state.startedAt=Date.now();
    if(!isLanding){const first=orderableProducts()[0];if(first)state.selected=first;}
    renderOrderForm();
  }catch(error){toast(error.message||'অর্ডার পাঠানো যায়নি। আবার চেষ্টা করুন।');}
  finally{const soldOut=isLanding&&Number(state.selected?.stock||0)<=0;button.disabled=soldOut;button.textContent=soldOut?'স্টক শেষ':'🛒 অর্ডার কনফার্ম করুন';}
}
function renderReviews(){
  const wrap=$('#reviewsSection'); if(!wrap) return;
  const imgs=(state.settings.review_images||[]).filter(Boolean);
  if(!imgs.length){wrap.hidden=true;return;}
  wrap.hidden=false;
  const track=$('#reviewTrack'), dots=$('#reviewDots');
  track.innerHTML=imgs.map((src,i)=>`<figure class="review-slide"><img src="${esc(src)}" alt="গ্রাহকের রিভিউ ${i+1}" loading="lazy"></figure>`).join('');
  track.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.closest('.review-slide')?.remove(),{once:true}));
  const slides=()=>[...track.children];
  dots.innerHTML=imgs.map((_,i)=>`<button type="button" aria-label="রিভিউ ${i+1}" data-dot="${i}"></button>`).join('');
  const current=()=>{const s=slides();if(!s.length)return 0;const mid=track.scrollLeft+track.clientWidth/2;let best=0,d=1e9;s.forEach((el,i)=>{const c=el.offsetLeft+el.clientWidth/2,x=Math.abs(c-mid);if(x<d){d=x;best=i;}});return best;};
  const go=i=>{const s=slides();if(!s.length)return;i=(i+s.length)%s.length;track.scrollTo({left:s[i].offsetLeft-(track.clientWidth-s[i].clientWidth)/2,behavior:'smooth'});};
  const mark=()=>{const c=current();dots.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',i===c));};
  let timer=null;
  const restart=()=>{clearInterval(timer);if(matchMedia('(prefers-reduced-motion: reduce)').matches||slides().length<2)return;timer=setInterval(()=>{if(!document.hidden)go(current()+1);},4500);};
  track.addEventListener('scroll',()=>{clearTimeout(mark.t);mark.t=setTimeout(mark,60);},{passive:true});
  $('#reviewPrev').onclick=()=>{go(current()-1);restart();};
  $('#reviewNext').onclick=()=>{go(current()+1);restart();};
  dots.onclick=e=>{const b=e.target.closest('[data-dot]');if(b){go(Number(b.dataset.dot));restart();}};
  ['touchstart','mouseenter','focusin'].forEach(ev=>track.addEventListener(ev,()=>clearInterval(timer),{passive:true}));
  ['touchend','mouseleave','focusout'].forEach(ev=>track.addEventListener(ev,restart,{passive:true}));
  mark();restart();
}
async function boot(){
  $('#year').textContent=new Date().getFullYear();
  try{
    const settingsPromise=api('/api/settings');
    const productPromise=isLanding
      ? api('/api/products/by-slug/'+encodeURIComponent(location.pathname.slice(1)))
      : api('/api/products');
    const [productResult,settingsResult]=await Promise.allSettled([productPromise,settingsPromise]);
    if(productResult.status!=='fulfilled') throw productResult.reason;
    const productsOrProduct=productResult.value;
    const settings=settingsResult.status==='fulfilled'?settingsResult.value:{};
    state.products=isLanding?[productsOrProduct]:productsOrProduct;
    state.selected=isLanding?productsOrProduct:null;
    state.settings=settings;
    if(window.rihamConfigureAnalytics)window.rihamConfigureAnalytics(settings);
    document.documentElement.style.setProperty('--riham-green',settings.accent_color||'#176b39');
    document.documentElement.style.setProperty('--riham-green-dark',settings.accent_color||'#13592f');
    if(!isLanding)document.title=settings.seo_title||`${settings.store_name||'RIHAM STORE'} — শালীন পোশাকের কালেকশন`;
    const brandName=settings.store_name||'RIHAM STORE';
    document.querySelectorAll('.brand-words b,.footer-brand-line b').forEach(el=>el.textContent=brandName);
    document.querySelectorAll('.brand-words small').forEach(el=>el.textContent=settings.tagline||'শালীন পোশাকের বিশ্বস্ত ঠিকানা');
    const title=settings.hero_title||'শালীনতায় থাকুক নিজস্ব সৌন্দর্য';
    if($('#introTitle')) $('#introTitle').textContent=title.replace(/<[^>]*>/g,'');
    if($('#introText')) $('#introText').textContent=settings.hero_subtitle||'আমাদের বোরকা কালেকশনের প্রতিটি ডিজাইন ভালোভাবে দেখে পছন্দ করুন।';
    const wanted=Number(new URLSearchParams(location.search).get('product'));
    if(!isLanding&&wanted){const w=state.products.find(p=>p.id===wanted&&p.stock>0);if(w)state.selected=w;}
    updateWhatsapp();renderLookbook();renderLandingDetails();renderReviews();if(isLanding)startOrderForm();
    if(window.rihamTrack){
      if(isLanding)window.rihamTrack('ViewContent',{content_type:'product',content_ids:[Number(state.selected.id)],content_name:state.selected.name,value:effectivePrice(state.selected),currency:'BDT'});
      else window.rihamTrack('ViewContent',{content_type:'product_group',currency:'BDT'});
    }
  }catch(error){
    $('#lookbook').innerHTML='<div class="lookbook-loading">পেজটি লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।</div>';
    const choice=$('#orderProductChoices');if(choice)choice.innerHTML=`<p class="form-loading">${esc(error.message)}</p>`;
    if($('#confirmOrderBtn'))$('#confirmOrderBtn').disabled=true;
  }
}
boot();
