const nav = document.getElementById('nav');
const loader = document.getElementById('loader');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 30), { passive: true });
window.addEventListener('load', () => setTimeout(() => loader?.remove(), 3200));

const ingredients = [...document.querySelectorAll('.ingredient')];
const ingredientName = document.getElementById('ingredientName');
const ingredientCopy = document.getElementById('ingredientCopy');
const molecule = document.getElementById('molecule');
ingredients.forEach(card => card.addEventListener('click', () => {
  ingredients.forEach(x => x.classList.remove('active'));
  card.classList.add('active');
  ingredientName.textContent = card.dataset.name;
  ingredientCopy.textContent = card.dataset.copy;
  molecule.animate([{ transform: 'scale(.8) rotate(-25deg)', opacity: .35 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
}));

const comparison = document.getElementById('comparison');
const after = comparison?.querySelector('.after');
const line = document.getElementById('sliderLine');
let dragging = false;
function setSlider(clientX) {
  if (!comparison) return;
  const rect = comparison.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  after.style.width = `${pct}%`;
  line.style.left = `${pct}%`;
}
comparison?.addEventListener('pointerdown', e => { dragging = true; comparison.setPointerCapture(e.pointerId); setSlider(e.clientX); });
comparison?.addEventListener('pointermove', e => { if (dragging) setSlider(e.clientX); });
comparison?.addEventListener('pointerup', () => dragging = false);
comparison?.addEventListener('pointercancel', () => dragging = false);

const reveals = document.querySelectorAll('.manifesto-grid,.feature-row,.formula-heading,.ingredient-grid,.ingredient-detail,.science-title,.science-flow article,.antioxidant-copy,.molecule-field,.texture-head,.serum-pond,.journey-head,.comparison,.routine-head,.routine-list>div,.details-grid,.creator-grid,.pillars>div');
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
}), { threshold: .12 });
reveals.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(24px)'; el.style.transition = 'opacity .9s ease, transform .9s cubic-bezier(.2,.8,.2,1)'; observer.observe(el); });
const style = document.createElement('style');
style.textContent = '.in-view{opacity:1!important;transform:none!important}';
document.head.appendChild(style);

const product = document.querySelector('.hero-product');
window.addEventListener('pointermove', e => {
  if (!product || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const x = (e.clientX / window.innerWidth - .5) * 2;
  const y = (e.clientY / window.innerHeight - .5) * 2;
  product.style.transform = `translate3d(${x * 8}px,${y * 6}px,0)`;
}, { passive: true });