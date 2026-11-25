/* THE ROWAN HOUSE — fictional portfolio concept.
   Set enquiryEndpoint after deploying the Supabase Edge Function.
   Never place Resend or Supabase secret keys in this browser file. */
const CONFIG = {
  name: "The Rowan House",
  enquiryEndpoint: "https://ivlgnrhkubxjlbwvhzpm.supabase.co/functions/v1/send-enquiry"
};
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
$$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());

const menu = $(".menu-toggle"), nav = $(".nav");
if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    nav.classList.toggle("open", open); document.body.classList.toggle("menu-open", open);
  });
  $$("a", nav).forEach(a => a.addEventListener("click", () => {
    menu.setAttribute("aria-expanded","false"); nav.classList.remove("open"); document.body.classList.remove("menu-open");
  }));
}
const current = location.pathname.split("/").pop() || "index.html";
$$("[data-page]").forEach(a => { if (a.dataset.page === current) a.classList.add("active"); });

function setDatePair(a,b) {
  if(!a || !b) return;
  const now = new Date(); const today = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  a.min = today; b.min = today;
  a.addEventListener("change", () => {
    if(!a.value) return;
    const d = new Date(a.value+"T12:00:00"); d.setDate(d.getDate()+1);
    const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    b.min = next; if(!b.value || b.value <= a.value) b.value = next;
  });
}
setDatePair($("#quick-in"),$("#quick-out")); setDatePair($("#full-in"),$("#full-out"));

function showToast(message) {
  const t = $(".toast"); if(!t) return;
  t.textContent = message; t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>t.classList.remove("show"),5200);
}

$$('[data-enquiry-form]').forEach(form => form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const checkin = String(data.get('checkin') || '');
  const checkout = String(data.get('checkout') || '');
  if (!checkin || !checkout || checkout <= checkin) {
    showToast('Please choose a check-out date after check-in.');
    return;
  }
  if (!CONFIG.enquiryEndpoint || CONFIG.enquiryEndpoint.includes('YOUR_PROJECT_REF')) {
    showToast('The enquiry service is not configured yet. Complete the setup in the project README.');
    return;
  }

  const button = $('button[type="submit"]', form);
  const originalLabel = button ? button.textContent : '';
  if (button) { button.disabled = true; button.textContent = 'Sending…'; }
  showToast('Sending your enquiry securely…');

  const payload = {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    checkin,
    checkout,
    guests: String(data.get('guests') || '2 guests'),
    room: String(data.get('room') || 'Not specified'),
    message: String(data.get('message') || '').trim(),
    website: String(data.get('website') || ''),
    source_page: location.pathname
  };

  try {
    const response = await fetch(CONFIG.enquiryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      if (response.status === 429) throw new Error('Too many attempts. Please wait a few minutes and try again.');
      throw new Error(result.error || 'The enquiry could not be sent. Please try again.');
    }
    form.reset();
    showToast('Enquiry sent. Thank you — this is not a booking confirmation.');
  } catch (error) {
    showToast(error.message || 'Network error. Please try again.');
  } finally {
    if (button) { button.disabled = false; button.textContent = originalLabel; }
  }
}));

const lightbox = $(".lightbox");
if(lightbox) {
  const img = $("img",lightbox), close = $("button",lightbox);
  $$("[data-lightbox]").forEach(el => el.addEventListener("click", () => {
    img.src = el.getAttribute("src"); img.alt = $("img",el)?.alt || "Gallery image";
    lightbox.classList.add("open"); document.body.style.overflow="hidden"; close.focus();
  }));
  function closeBox(){lightbox.classList.remove("open");document.body.style.overflow="";}
  close.addEventListener("click",closeBox);
  lightbox.addEventListener("click",e=>{if(e.target===lightbox)closeBox()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeBox()});
}
const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(entry => {
  if(entry.isIntersecting){entry.target.classList.add("visible");revealObserver.unobserve(entry.target);}
}),{threshold:.12}) : null;
if(revealObserver) $$(".reveal").forEach(el=>revealObserver.observe(el)); else $$(".reveal").forEach(el=>el.classList.add("visible"));
