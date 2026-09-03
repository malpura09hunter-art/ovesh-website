(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = document.getElementById('loader');
  const nav = document.getElementById('nav');
  const menuButton = document.getElementById('menuButton');
  const mobileMenu = document.getElementById('mobileMenu');

  window.addEventListener('load', () => {
    setTimeout(() => loader?.classList.add('done'), reduceMotion ? 0 : 850);
    document.querySelectorAll('.reveal-on-load').forEach((el, i) => setTimeout(() => el.classList.add('revealed'), reduceMotion ? 0 : 180 + i * 120));
  });

  window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 20), { passive: true });

  function closeMenu() {
    mobileMenu?.classList.remove('open');
    mobileMenu?.setAttribute('aria-hidden', 'true');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  menuButton?.addEventListener('click', () => {
    const open = !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    });
  }, { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  reveals.forEach(el => observer.observe(el));

  const ingredients = [...document.querySelectorAll('.ingredient')];
  const name = document.getElementById('ingredientName');
  const category = document.getElementById('ingredientCategory');
  const copy = document.getElementById('ingredientCopy');
  const code = document.getElementById('formulaCode');
  const molecule = document.getElementById('molecule');
  function selectIngredient(card) {
    ingredients.forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); });
    card.classList.add('active'); card.setAttribute('aria-selected', 'true');
    name.textContent = card.dataset.name;
    category.textContent = card.dataset.category;
    copy.textContent = card.dataset.copy;
    code.textContent = card.dataset.formula;
    if (!reduceMotion) molecule?.animate([{ opacity: .2, transform: 'scale(.82) rotate(-18deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  ingredients.forEach(card => card.addEventListener('click', () => selectIngredient(card)));

  const product = document.getElementById('bottle');
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  const desktop = window.matchMedia('(pointer:fine)').matches;
  if (desktop && !reduceMotion) {
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if (cursor) { cursor.style.opacity = '1'; cursor.style.transform = `translate(${mx - 3}px,${my - 3}px)`; } }, { passive: true });
    const animateCursor = () => { rx += (mx - rx) * .14; ry += (my - ry) * .14; if (ring) { ring.style.opacity = '1'; ring.style.transform = `translate(${rx - 15}px,${ry - 15}px)`; } requestAnimationFrame(animateCursor); };
    animateCursor();
    document.querySelectorAll('a,button,.bottle-wrap').forEach(el => {
      el.addEventListener('mouseenter', () => { if (ring) { ring.style.width = '46px'; ring.style.height = '46px'; ring.style.borderColor = '#e96b24aa'; } });
      el.addEventListener('mouseleave', () => { if (ring) { ring.style.width = '30px'; ring.style.height = '30px'; ring.style.borderColor = '#17171588'; } });
    });
    const heroProduct = document.querySelector('.hero-product');
    heroProduct?.addEventListener('pointermove', e => { const r = heroProduct.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; product.style.transform = `rotate(${3 + x * 2}deg) translate(${x * 7}px,${y * 7}px)`; });
    heroProduct?.addEventListener('pointerleave', () => { product.style.transform = ''; });
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...document.querySelectorAll('.nav-links a')];
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) links.forEach(link => link.style.opacity = link.getAttribute('href') === `#${entry.target.id}` ? '1' : '');
  }), { rootMargin: '-35% 0px -55% 0px' });
  sections.forEach(section => sectionObserver.observe(section));

  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
  }));
})();