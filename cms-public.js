(function () {
  'use strict';

  if (!window.firebase || !window.db) return;

  const page = getPageKey();

  function getPageKey() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/services')) return 'services';
    if (path.includes('/blog')) return 'blog';
    return 'home';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function has(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  function setText(selector, value) {
    if (!has(value)) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setHtml(selector, value) {
    if (!has(value)) return;
    const el = document.querySelector(selector);
    if (el) el.innerHTML = esc(value).replace(/\n/g, '<br>');
  }

  function setAttr(selector, attr, value) {
    if (!has(value)) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  async function doc(collection, id) {
    try {
      const snap = await db.collection(collection).doc(id).get();
      return snap.exists ? snap.data() : {};
    } catch (error) {
      console.warn('CMS read failed:', collection, id, error.message);
      return {};
    }
  }

  async function list(collection, limit) {
    try {
      let snap;
      try {
        snap = await db.collection(collection).where('status', '==', 'Published').orderBy('order', 'asc').limit(limit || 50).get();
      } catch (_) {
        snap = await db.collection(collection).orderBy('order', 'asc').limit(limit || 50).get();
      }
      return snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => (item.status || 'Published') === 'Published');
    } catch (error) {
      console.warn('CMS list failed:', collection, error.message);
      return [];
    }
  }

  function applySeo(seo) {
    if (!seo || !Object.keys(seo).length) return;
    if (has(seo.title)) document.title = seo.title;
    setMeta('name', 'description', seo.description);
    setMeta('name', 'keywords', seo.keywords);
    setMeta('name', 'author', seo.author);
    setMeta('name', 'robots', seo.robots);
    setMeta('name', 'theme-color', seo.themeColor);
    setMeta('property', 'og:title', seo.ogTitle || seo.title);
    setMeta('property', 'og:description', seo.ogDescription || seo.description);
    setMeta('property', 'og:image', seo.ogImage);
    setMeta('name', 'twitter:title', seo.twitterTitle || seo.ogTitle || seo.title);
    setMeta('name', 'twitter:description', seo.twitterDescription || seo.ogDescription || seo.description);
    setMeta('name', 'twitter:image', seo.twitterImage || seo.ogImage);
    setMeta('name', 'google-site-verification', seo.googleVerification);
    setMeta('name', 'msvalidate.01', seo.bingVerification);
    if (has(seo.canonical)) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = seo.canonical;
    }
    if (has(seo.schema)) {
      try {
        JSON.parse(seo.schema);
        const existing = document.querySelector('script[type="application/ld+json"]');
        const script = existing || document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = seo.schema;
        if (!existing) document.head.appendChild(script);
      } catch (error) {
        console.warn('Invalid CMS schema JSON-LD ignored:', error.message);
      }
    }
  }

  function setMeta(attr, key, value) {
    if (!has(value)) return;
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', value);
  }

  function applyCompany(company) {
    if (!company) return;
    setText('.nav-logo', company.shortName || company.companyName);
    setAttr('.hero-image img', 'src', company.logo);
  }

  function applyHome(home) {
    if (page !== 'home' || !home) return;
    setHtml('.hero-text h1', home.heroTitle);
    setText('.hero-text .tagline', home.heroSubtitle);
    setText('.hero-badge', home.heroDescription);
    setText('.hero-btns .btn-primary', home.heroPrimaryLabel);
    setAttr('.hero-btns .btn-primary', 'href', home.heroPrimaryUrl);
    setText('.hero-btns .btn-outline', home.heroSecondaryLabel);
    setAttr('.hero-btns .btn-outline', 'href', home.heroSecondaryUrl);
    setAttr('.hero-image img', 'src', home.heroImage);
    renderStats(home.statistics);
    renderFeatures(home.features);
  }

  function renderStats(stats) {
    const rows = normalizeLines(stats).map((line) => line.split('|').map((part) => part.trim()));
    if (!rows.length) return;
    const wrap = document.querySelector('.stat-row');
    if (!wrap) return;
    wrap.innerHTML = rows.map((row) => `
      <div class="stat-box"><span class="stat-num">${esc(row[0] || '')}</span><span class="stat-label">${esc(row[1] || '')}</span></div>
    `).join('');
  }

  function renderFeatures(features) {
    const rows = normalizeLines(features).map((line) => line.split('|').map((part) => part.trim()));
    if (!rows.length) return;
    const wrap = document.querySelector('.skills-grid');
    if (!wrap) return;
    wrap.innerHTML = rows.map((row) => `
      <div class="skill-card">
        <div class="skill-icon">${esc(row[0] || '*')}</div>
        <div class="skill-name">${esc(row[1] || '')}</div>
        <div class="skill-desc">${esc(row[2] || '')}</div>
        <div class="skill-bar-wrap"><div class="skill-bar" data-width="80%"></div></div>
      </div>
    `).join('');
  }

  function applyContact(contact, social) {
    if (page !== 'home') return;
    setText('#contact .contact-info h3', contact.introTitle);
    setText('#contact .contact-info p', contact.introText);
    renderSocial(social, contact.email);
  }

  function renderSocial(social, email) {
    const wrap = document.querySelector('#contact .social-links');
    if (!wrap) return;
    if (social && social.visible === false) {
      wrap.style.display = 'none';
      return;
    }
    const entries = [
      ['X', social.x],
      ['Instagram', social.instagram],
      ['GitHub', social.github],
      ['LinkedIn', social.linkedin],
      ['YouTube', social.youtube],
      ['Facebook', social.facebook],
      ['Discord', social.discord],
      ['Website', social.website],
      ['Email', email ? 'mailto:' + email : '']
    ].filter((entry) => has(entry[1]));
    if (!entries.length) return;
    wrap.innerHTML = entries.map(([label, url]) => `<a href="${esc(url)}" target="${url.startsWith('mailto:') ? '_self' : '_blank'}" class="social-btn">${esc(label)}</a>`).join('');
  }

  function applyFooter(footer) {
    if (!footer) return;
    const footerEl = document.querySelector('footer');
    if (!footerEl) return;
    const lines = [footer.copyright, footer.footerText, footer.companyDescription].filter(has);
    if (!lines.length) return;
    footerEl.innerHTML = lines.map((line) => `<div>${esc(line)}</div>`).join('');
  }

  function normalizeLines(value) {
    if (Array.isArray(value)) return value.map(String).filter(has);
    return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  }

  function renderServices(services) {
    if (!services.length) return;
    if (page === 'services') {
      const grid = document.querySelector('.services-grid-full');
      if (!grid) return;
      grid.innerHTML = services.map((service) => `
        <div class="service-card-full reveal-up is-visible">
          <div class="service-icon-full">${esc(service.icon || '*')}</div>
          <h3>${esc(service.title)}</h3>
          <p class="service-desc">${esc(service.description || '')}</p>
          ${Array.isArray(service.features) && service.features.length ? `<ul class="service-features">${service.features.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
          ${Array.isArray(service.technologies) && service.technologies.length ? `<div class="service-tech-row">${service.technologies.map((item) => `<span class="tag">${esc(item)}</span>`).join('')}</div>` : ''}
          ${has(service.benefit) ? `<div class="service-benefit">${esc(service.benefit)}</div>` : ''}
          <a href="../index.html#contact" class="btn-outline">Enquire About This</a>
        </div>`).join('');
    } else if (page === 'home') {
      const grid = document.querySelector('#services-preview .preview-grid');
      if (!grid) return;
      grid.innerHTML = services.slice(0, 4).map((service) => `
        <div class="preview-card">
          <div class="preview-icon">${esc(service.icon || '*')}</div>
          <h3>${esc(service.title)}</h3>
          <p>${esc(service.description || '')}</p>
        </div>`).join('');
    }
  }

  function renderFaq(items) {
    if (!items.length || page !== 'services') return;
    const wrap = document.querySelector('.faq-list');
    if (!wrap) return;
    wrap.innerHTML = items.map((item) => `
      <div class="faq-item">
        <div class="faq-question" onclick="toggleFaq(this)">${esc(item.question)}</div>
        <div class="faq-answer"><p>${esc(item.answer || '')}</p></div>
      </div>`).join('');
  }

  function renderBlogs(posts) {
    if (!posts.length) return;
    if (page === 'blog') {
      const featured = posts.find((post) => post.featured) || posts[0];
      const featuredBox = document.querySelector('.featured-post');
      if (featuredBox) {
        featuredBox.innerHTML = `
          <div class="featured-visual">${has(featured.featuredImage) ? `<img src="${esc(featured.featuredImage)}" alt="${esc(featured.title)}" style="width:100%;height:100%;object-fit:cover;">` : '<div class="big-icon">*</div>'}</div>
          <div class="featured-content">
            <div class="blog-cat">${esc(featured.category || 'Article')}</div>
            <h2>${esc(featured.title)}</h2>
            <div class="post-byline"><span>${esc(featured.author || 'Ovesh Malpura')}</span><span>${esc(featured.publishedAt || '')}</span><span>${esc(featured.readTime || '')}</span></div>
            <p>${esc(featured.excerpt || '')}</p>
            <a href="#" class="btn-primary" style="align-self:flex-start;">Read Featured Article</a>
          </div>`;
      }
      const grid = document.querySelector('#blogGrid');
      if (grid) grid.innerHTML = posts.filter((post) => post.id !== featured.id).map(blogCard).join('');
    } else if (page === 'home') {
      const grid = document.querySelector('#blog .blog-grid');
      if (grid) grid.innerHTML = posts.slice(0, 6).map(blogCard).join('');
    }
  }

  function blogCard(post, index) {
    return `
      <div class="blog-card reveal-up is-visible" data-cat="${esc(post.category || '')}">
        <div class="blog-meta"><div class="blog-num">${String((index || 0) + 1).padStart(2, '0')}</div><div><div class="blog-date">${esc(post.publishedAt || '')}</div><div class="blog-cat">${esc(post.category || 'Article')}</div></div></div>
        <div class="post-byline"><span>${esc(post.author || 'Ovesh Malpura')}</span><span>${esc(post.readTime || '')}</span></div>
        <div class="blog-body">
          <h3>${esc(post.title)}</h3>
          <p>${esc(post.excerpt || '')}</p>
          <a href="#" class="read-more">READ MORE</a>
        </div>
      </div>`;
  }

  function renderProjects(projects) {
    if (!projects.length || page !== 'home') return;
    const anchor = document.querySelector('#cta-section');
    if (!anchor || document.querySelector('#cms-projects')) return;
    const section = document.createElement('section');
    section.id = 'cms-projects';
    section.innerHTML = `
      <div class="section-label">PROJECTS</div>
      <h2>Featured Projects</h2>
      <div class="tools-showcase-grid">${projects.slice(0, 6).map((project) => `
        <div class="showcase-card">
          <div class="tool-logo">${esc((project.title || 'Project').slice(0, 10))}</div>
          <h3>${esc(project.title)}</h3>
          <p>${esc(project.description || '')}</p>
          ${Array.isArray(project.technologies) ? `<div class="tag-row">${project.technologies.map((tech) => `<span class="tag">${esc(tech)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}</div>`;
    anchor.parentNode.insertBefore(section, anchor);
  }

  function renderTestimonials(items) {
    if (!items.length || page !== 'home') return;
    const anchor = document.querySelector('#contact');
    if (!anchor || document.querySelector('#cms-testimonials')) return;
    const section = document.createElement('section');
    section.id = 'cms-testimonials';
    section.innerHTML = `
      <div class="section-label">TESTIMONIALS</div>
      <h2>Client Feedback</h2>
      <div class="preview-grid">${items.slice(0, 4).map((item) => `
        <div class="preview-card">
          <h3>${esc(item.client || '')}</h3>
          <p>${esc(item.quote || '')}</p>
          <div class="tag-row"><span class="tag">${esc(item.company || '')}</span><span class="tag">${esc(item.rating || '')}/5</span></div>
        </div>`).join('')}</div>`;
    anchor.parentNode.insertBefore(section, anchor);
  }

  function injectTracking(settings) {
    if (has(settings.googleTagManager) && !document.querySelector('[data-cms-gtm]')) {
      const script = document.createElement('script');
      script.dataset.cmsGtm = '1';
      script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${String(settings.googleTagManager).replace(/[^A-Z0-9-]/gi, '')}');`;
      document.head.appendChild(script);
    }
    if (has(settings.googleAnalytics) && !document.querySelector('[data-cms-ga]')) {
      const id = String(settings.googleAnalytics).replace(/[^A-Z0-9-]/gi, '');
      const loader = document.createElement('script');
      loader.async = true;
      loader.dataset.cmsGa = '1';
      loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      document.head.appendChild(loader);
      const script = document.createElement('script');
      script.dataset.cmsGaInline = '1';
      script.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
      document.head.appendChild(script);
    }
  }

  async function boot() {
    const [company, home, contact, social, footer, seoDoc, settings, services, faq, blogs, projects, testimonials] = await Promise.all([
      doc('cms', 'company'),
      doc('cms', 'homepage'),
      doc('cms', 'contact'),
      doc('cms', 'social'),
      doc('cms', 'footer'),
      doc('cms', 'seo'),
      doc('cms', 'settings'),
      list('services', page === 'services' ? 100 : 4),
      list('faq', 50),
      list('blogs', page === 'blog' ? 30 : 6),
      list('projects', 12),
      list('testimonials', 12)
    ]);
    applySeo(seoDoc ? seoDoc[page] : null);
    applyCompany(company);
    applyHome(home);
    applyContact(contact, social);
    applyFooter(footer);
    renderServices(services);
    renderFaq(faq);
    renderBlogs(blogs);
    renderProjects(projects);
    renderTestimonials(testimonials);
    injectTracking(settings);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
