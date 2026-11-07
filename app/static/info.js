const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digitMap=String.raw`০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩`;
const asciiDigits=String.raw`01234567890123456789`;
function normalizeDigits(value){return String(value||'').replace(/[০-৯٠-٩]/g,ch=>asciiDigits[digitMap.indexOf(ch)]??ch);}
function normalizeWhatsApp(value){
  let number=normalizeDigits(value).replace(/\D/g,'');
  if(number.startsWith('0')&&number.length===11)number='88'+number;
  else if(number.length===10&&number.startsWith('1'))number='880'+number;
  return number;
}
async function load(){
  const response=await fetch('/api/settings');
  if(!response.ok)throw new Error('তথ্য লোড করা যায়নি।');
  const settings=await response.json();
  if(window.rihamConfigureAnalytics)window.rihamConfigureAnalytics(settings);
  const storeName=settings.store_name||'RIHAM STORE';
  const path=location.pathname;
  const pages={
    about:['আমাদের সম্পর্কে','আমাদের সম্পর্কে',settings.about_text||'RIHAM-এ বোরকা, হিজাব ও নিকাবের নির্বাচিত কালেকশন এক জায়গায় পাবেন।'],
    contact:['যোগাযোগ','যোগাযোগ',settings.contact_text||'সাইজ, কালার বা অর্ডার সম্পর্কে জানতে আমাদের সঙ্গে যোগাযোগ করুন।'],
    delivery:['ডেলিভারি নীতি','ডেলিভারি নীতি',settings.delivery_policy],
    return:['রিটার্ন / এক্সচেঞ্জ নীতি','রিটার্ন ও এক্সচেঞ্জ',settings.return_policy],
    privacy:['প্রাইভেসি নীতি','গোপনীয়তা নীতি',settings.privacy_policy]
  };
  const key=path.startsWith('/policy/')?path.split('/').pop():(path==='/contact'?'contact':'about');
  const [title,eyebrow,body]=pages[key]||pages.about;
  document.title=title+' · '+storeName;
  $('#infoTitle').textContent=title;
  $('#infoBreadcrumb').textContent=title;
  $('#infoEyebrow').textContent=eyebrow;
  $('#infoContent').textContent=body||'এই তথ্য এখনো যোগ করা হয়নি। বিস্তারিত জানতে WhatsApp-এ যোগাযোগ করুন।';
  document.querySelectorAll('.brand-words b,.footer-brand-line b').forEach(el=>el.textContent=storeName);
  document.querySelectorAll('.brand-words small').forEach(el=>el.textContent=settings.tagline||'শালীন পোশাকের বিশ্বস্ত ঠিকানা');
  const displayNumber=settings.whatsapp_number||settings.support_phone||'';
  const number=normalizeWhatsApp(displayNumber);
  const message='আসসালামু আলাইকুম, আমি '+storeName+' সম্পর্কে জানতে চাই।';
  const href=number?'https://wa.me/'+number+'?text='+encodeURIComponent(message):'#';
  ['#infoWhatsapp','#footerWhatsapp','#floatingWhatsapp'].forEach(selector=>{
    const el=$(selector);
    if(!el)return;
    el.href=href;
    el.onclick=event=>{if(href==='#'){event.preventDefault();$('#infoContent').textContent='যোগাযোগের নম্বর এখনো সেট করা হয়নি।';}};
    if(selector==='#footerWhatsapp')el.textContent=displayNumber?'WhatsApp নম্বর: '+displayNumber:'WhatsApp-এ যোগাযোগ করুন';
  });
  const info=$('#infoContactDetails');
  if(key==='contact'){
    const parts=[];
    if(settings.support_phone)parts.push('<p><b>ফোন:</b> <a href="tel:'+esc(settings.support_phone)+'">'+esc(settings.support_phone)+'</a></p>');
    if(settings.support_email)parts.push('<p><b>ইমেইল:</b> <a href="mailto:'+encodeURIComponent(settings.support_email).replace(/%40/gi,'@')+'">'+esc(settings.support_email)+'</a></p>');
    if(settings.shop_address)parts.push('<p><b>ঠিকানা:</b> '+esc(settings.shop_address)+'</p>');
    if(settings.facebook_url)parts.push('<p><a href="'+esc(settings.facebook_url)+'" target="_blank" rel="noopener">Facebook</a></p>');
    if(settings.instagram_url)parts.push('<p><a href="'+esc(settings.instagram_url)+'" target="_blank" rel="noopener">Instagram</a></p>');
    info.innerHTML=parts.join('');
  }else info.innerHTML='';
  document.documentElement.style.setProperty('--brown',settings.accent_color||'#3f5a3b');
  document.documentElement.style.setProperty('--white',settings.background_color||'#fff');
  document.documentElement.style.setProperty('--ink',settings.text_color||'#2b2926');
  document.body.dataset.theme=settings.theme||'white';
  $('#year').textContent=new Date().getFullYear();
}
load().catch(error=>{$('#infoContent').textContent=error.message;});
