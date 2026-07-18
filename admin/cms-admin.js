(function () {
  'use strict';

  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  let booted = false;
  let dirty = false;
  let activeUser = null;
  const listState = {};

  const singletonModules = [
    {
      key: 'company',
      title: 'Company',
      subtitle: 'Core brand and business information used across the website.',
      collection: 'cms',
      docId: 'company',
      fields: [
        f('companyName', 'Company Name', 'text', true),
        f('companyDescription', 'Company Description', 'textarea'),
        f('logo', 'Logo URL', 'url'),
        f('email', 'Email', 'email'),
        f('phone', 'Phone', 'text'),
        f('address', 'Address', 'textarea'),
        f('businessHours', 'Business Hours', 'textarea'),
        f('googleMaps', 'Google Maps URL / Embed', 'url'),
        f('legalName', 'Legal Name', 'text'),
        f('founded', 'Founded', 'text')
      ]
    },
    {
      key: 'homepage',
      title: 'Homepage',
      subtitle: 'Hero, calls to action, statistics, features, and highlights.',
      collection: 'cms',
      docId: 'homepage',
      fields: [
        f('heroTitle', 'Hero Title', 'text'),
        f('heroSubtitle', 'Hero Subtitle', 'text'),
        f('heroDescription', 'Hero Description', 'textarea'),
        f('heroPrimaryLabel', 'Primary Button Label', 'text'),
        f('heroPrimaryUrl', 'Primary Button URL', 'text'),
        f('heroSecondaryLabel', 'Secondary Button Label', 'text'),
        f('heroSecondaryUrl', 'Secondary Button URL', 'text'),
        f('heroImage', 'Hero Image URL', 'url'),
        f('statistics', 'Statistics', 'textarea', false, 'One stat per line: value | label'),
        f('features', 'Features', 'textarea', false, 'One feature per line: icon | title | description'),
        f('highlights', 'Highlights', 'textarea', false, 'One highlight per line')
      ]
    },
    {
      key: 'contact',
      title: 'Contact',
      subtitle: 'Contact details, support email, map links, and contact cards.',
      collection: 'cms',
      docId: 'contact',
      fields: [
        f('email', 'Email', 'email'),
        f('supportEmail', 'Support Email', 'email'),
        f('phone', 'Phone', 'text'),
        f('address', 'Address', 'textarea'),
        f('googleMaps', 'Google Maps URL', 'url'),
        f('introTitle', 'Contact Heading', 'text'),
        f('introText', 'Contact Text', 'textarea'),
        f('contactCards', 'Contact Cards', 'textarea', false, 'One card per line: title | value | url')
      ]
    },
    {
      key: 'social',
      title: 'Social',
      subtitle: 'Social profile URLs and visibility.',
      collection: 'cms',
      docId: 'social',
      fields: [
        f('visible', 'Show Social Links', 'checkbox'),
        f('github', 'GitHub', 'url'),
        f('linkedin', 'LinkedIn', 'url'),
        f('instagram', 'Instagram', 'url'),
        f('x', 'X / Twitter', 'url'),
        f('youtube', 'YouTube', 'url'),
        f('facebook', 'Facebook', 'url'),
        f('discord', 'Discord', 'url'),
        f('website', 'Website', 'url')
      ]
    },
    {
      key: 'footer',
      title: 'Footer',
      subtitle: 'Footer text, quick links, copyright, description, and social labels.',
      collection: 'cms',
      docId: 'footer',
      fields: [
        f('footerText', 'Footer Text', 'text'),
        f('companyDescription', 'Company Description', 'textarea'),
        f('copyright', 'Copyright', 'text'),
        f('quickLinks', 'Quick Links', 'textarea', false, 'One link per line: label | url'),
        f('socialLinks', 'Footer Social Links', 'textarea', false, 'One link per line: label | url')
      ]
    },
    {
      key: 'settings',
      title: 'Settings',
      subtitle: 'Global CMS settings and third-party integrations.',
      collection: 'cms',
      docId: 'settings',
      fields: [
        f('siteStatus', 'Site Status', 'select', false, '', ['Live', 'Maintenance', 'Draft']),
        f('maintenanceMessage', 'Maintenance Message', 'textarea'),
        f('defaultAuthor', 'Default Author', 'text'),
        f('googleAnalytics', 'Google Analytics ID', 'text'),
        f('googleTagManager', 'Google Tag Manager ID', 'text'),
        f('microsoftClarity', 'Microsoft Clarity ID', 'text'),
        f('facebookPixel', 'Facebook Pixel ID', 'text')
      ]
    }
  ];

  const seoFields = [
    f('title', 'Page Title', 'text'),
    f('description', 'Meta Description', 'textarea'),
    f('keywords', 'Meta Keywords', 'textarea'),
    f('canonical', 'Canonical URL', 'url'),
    f('robots', 'Robots', 'select', false, '', ['index, follow', 'noindex, follow', 'noindex, nofollow']),
    f('themeColor', 'Theme Color', 'text'),
    f('author', 'Author', 'text'),
    f('ogTitle', 'Open Graph Title', 'text'),
    f('ogDescription', 'Open Graph Description', 'textarea'),
    f('ogImage', 'Open Graph Image', 'url'),
    f('twitterTitle', 'Twitter Title', 'text'),
    f('twitterDescription', 'Twitter Description', 'textarea'),
    f('twitterImage', 'Twitter Image', 'url'),
    f('schema', 'Schema.org JSON-LD', 'textarea'),
    f('googleVerification', 'Google Verification', 'text'),
    f('bingVerification', 'Bing Verification', 'text')
  ];

  const listModules = [
    {
      key: 'services',
      title: 'Services',
      subtitle: 'Full CRUD for services with ordering, status, featured flags, icons, and images.',
      collection: 'services',
      search: ['title', 'description', 'status'],
      fields: [
        f('title', 'Service Title', 'text', true),
        f('slug', 'Slug', 'text'),
        f('description', 'Description', 'textarea', true),
        f('icon', 'Icon', 'text'),
        f('image', 'Image URL', 'url'),
        f('features', 'Features', 'textarea', false, 'One feature per line'),
        f('technologies', 'Technologies', 'textarea', false, 'One technology per line'),
        f('benefit', 'Benefit', 'text'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('featured', 'Featured', 'checkbox'),
        f('order', 'Order', 'number')
      ]
    },
    {
      key: 'projects',
      title: 'Projects',
      subtitle: 'Portfolio projects with gallery, technologies, GitHub, live demo, and ordering.',
      collection: 'projects',
      search: ['title', 'description', 'technologies'],
      fields: [
        f('title', 'Project Title', 'text', true),
        f('slug', 'Slug', 'text'),
        f('description', 'Description', 'textarea', true),
        f('image', 'Cover Image URL', 'url'),
        f('gallery', 'Gallery URLs', 'textarea', false, 'One image URL per line'),
        f('technologies', 'Technologies', 'textarea', false, 'One technology per line'),
        f('github', 'GitHub URL', 'url'),
        f('liveDemo', 'Live Demo URL', 'url'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('featured', 'Featured', 'checkbox'),
        f('order', 'Order', 'number')
      ]
    },
    {
      key: 'blogs',
      title: 'Blogs',
      subtitle: 'Professional blog CMS with rich content, SEO, categories, tags, draft and publish workflow.',
      collection: 'blogs',
      search: ['title', 'excerpt', 'category', 'tags'],
      rich: true,
      fields: [
        f('title', 'Post Title', 'text', true),
        f('slug', 'Slug', 'text', true),
        f('excerpt', 'Excerpt', 'textarea'),
        f('content', 'Rich Text Content', 'rich'),
        f('category', 'Category', 'text'),
        f('tags', 'Tags', 'textarea', false, 'One tag per line'),
        f('featuredImage', 'Featured Image URL', 'url'),
        f('author', 'Author', 'text'),
        f('readTime', 'Read Time', 'text'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('featured', 'Featured', 'checkbox'),
        f('publishedAt', 'Published Date', 'text'),
        f('seoTitle', 'SEO Title', 'text'),
        f('seoDescription', 'SEO Description', 'textarea'),
        f('seoKeywords', 'SEO Keywords', 'textarea'),
        f('order', 'Order', 'number')
      ]
    },
    {
      key: 'faq',
      title: 'FAQ',
      subtitle: 'Frequently asked questions with ordering and publish status.',
      collection: 'faq',
      search: ['question', 'answer'],
      fields: [
        f('question', 'Question', 'text', true),
        f('answer', 'Answer', 'textarea', true),
        f('category', 'Category', 'text'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('order', 'Order', 'number')
      ]
    },
    {
      key: 'testimonials',
      title: 'Testimonials',
      subtitle: 'Client testimonials with rating, image, company, featured flag, and ordering.',
      collection: 'testimonials',
      search: ['client', 'company', 'quote'],
      fields: [
        f('client', 'Client', 'text', true),
        f('company', 'Company', 'text'),
        f('quote', 'Testimonial', 'textarea', true),
        f('rating', 'Rating', 'number'),
        f('image', 'Image URL', 'url'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('featured', 'Featured', 'checkbox'),
        f('order', 'Order', 'number')
      ]
    },
    {
      key: 'media',
      title: 'Media Library',
      subtitle: 'Upload-ready media manager with preview, folders, search, copy URL, and delete.',
      collection: 'media',
      search: ['fileName', 'alt', 'folder', 'url'],
      media: true,
      fields: [
        f('fileName', 'File Name', 'text', true),
        f('url', 'Image URL / Data URL', 'url', true),
        f('alt', 'Alt Text', 'text'),
        f('folder', 'Folder', 'text'),
        f('caption', 'Caption', 'textarea'),
        f('status', 'Status', 'select', false, '', ['Published', 'Draft', 'Archived']),
        f('order', 'Order', 'number')
      ]
    }
  ];

  function f(name, label, type, required, help, options) {
    return { name, label, type, required: !!required, help: help || '', options: options || [] };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function valueToText(value) {
    if (Array.isArray(value)) return value.join('\n');
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return value == null ? '' : String(value);
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseLines(value) {
    return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  }

  function parseField(field, raw, checked) {
    if (field.type === 'checkbox') return !!checked;
    if (field.type === 'number') return raw === '' ? 0 : Number(raw);
    if (['features', 'technologies', 'tags', 'gallery'].includes(field.name)) return parseLines(raw);
    return raw.trim ? raw.trim() : raw;
  }

  function toast(message, type) {
    let stack = byId('cmsToastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'cmsToastStack';
      stack.className = 'cms-toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = 'cms-toast ' + (type || 'success');
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3600);
  }

  function setDirty(value) {
    dirty = value;
  }

  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal-box">
          <h3>Confirm Action</h3>
          <div class="cms-confirm-text">${esc(message)}</div>
          <div class="modal-actions">
            <button class="btn-sm danger" data-yes="1">Confirm</button>
            <button class="modal-close" data-no="1">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('[data-yes]').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('[data-no]').onclick = () => { overlay.remove(); resolve(false); };
      overlay.onclick = (event) => {
        if (event.target === overlay) { overlay.remove(); resolve(false); }
      };
    });
  }

  function renderAll() {
    renderCmsOverview();
    singletonModules.forEach(renderSingleton);
    renderSeo();
    listModules.forEach(renderListModule);
    renderProfile();
  }

  function renderCmsOverview() {
    const root = byId('cmsOverviewRoot');
    if (!root) return;
    const modules = [
      'Company', 'Homepage', 'Contact', 'Social', 'Footer', 'SEO',
      'Services', 'Projects', 'Blogs', 'FAQ', 'Testimonials', 'Media'
    ];
    root.innerHTML = `
      <div class="cms-toolbar">
        <div>
          <h2>CMS</h2>
          <div class="pane-sub">Production content control for Ovesh Malpura Cyber Labs</div>
        </div>
        <button class="cms-secondary" type="button" id="cmsRefreshBtn">Refresh CMS</button>
      </div>
      <div class="cms-grid">
        ${modules.map((name) => `
          <div class="cms-card">
            <h3>${esc(name)}</h3>
            <p>Load, edit, validate, and save ${esc(name.toLowerCase())} content from Firestore without changing existing routes or design.</p>
            <div class="cms-pill-row"><span class="cms-pill">Firestore</span><span class="cms-pill">SEO safe</span><span class="cms-pill">Fallback ready</span></div>
          </div>`).join('')}
      </div>`;
    byId('cmsRefreshBtn').onclick = () => {
      renderAll();
      toast('CMS refreshed.');
    };
  }

  function renderSingleton(module) {
    const root = byId('cmsSingletonRoot-' + module.key);
    if (!root) return;
    root.innerHTML = shell(module.title, module.subtitle, `
      <form class="cms-form-grid" id="form-${module.key}">
        ${module.fields.map((field) => fieldHtml(field, module.key)).join('')}
        <div class="full cms-actions">
          <button class="cms-primary" type="submit">Save ${esc(module.title)}</button>
          <button class="cms-secondary" type="button" data-reload="${module.key}">Reload</button>
        </div>
      </form>`);
    const form = byId('form-' + module.key);
    form.addEventListener('input', () => setDirty(true));
    form.addEventListener('submit', (event) => saveSingleton(event, module));
    form.querySelector('[data-reload]').onclick = () => loadSingleton(module);
    loadSingleton(module);
  }

  async function loadSingleton(module) {
    const form = byId('form-' + module.key);
    if (!form) return;
    setFormDisabled(form, true);
    try {
      const doc = await db.collection(module.collection).doc(module.docId).get();
      const data = doc.exists ? doc.data() : {};
      module.fields.forEach((field) => {
        const input = form.elements[field.name];
        if (!input) return;
        if (field.type === 'checkbox') input.checked = !!data[field.name];
        else input.value = valueToText(data[field.name]);
      });
      setDirty(false);
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      setFormDisabled(form, false);
    }
  }

  async function saveSingleton(event, module) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateForm(form, module.fields)) return;
    setFormDisabled(form, true);
    const payload = {};
    module.fields.forEach((field) => {
      const input = form.elements[field.name];
      payload[field.name] = parseField(field, input.value || '', input.checked);
    });
    payload.updatedAt = now();
    payload.updatedBy = activeUser ? activeUser.uid : '';
    try {
      await db.collection(module.collection).doc(module.docId).set(payload, { merge: true });
      setDirty(false);
      toast(module.title + ' saved.');
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      setFormDisabled(form, false);
    }
  }

  function renderSeo() {
    const root = byId('cmsSeoRoot');
    if (!root) return;
    root.innerHTML = shell('SEO', 'SEO defaults are preserved in HTML. Firestore values apply only when an admin saves non-empty fields.', `
      <div class="cms-toolbar">
        <div class="cms-field" style="min-width:220px;">
          <label for="seoPage">Page</label>
          <select id="seoPage"><option value="home">Home</option><option value="services">Services</option><option value="blog">Blog</option></select>
        </div>
        <div class="cms-actions">
          <button class="cms-secondary" type="button" id="seoReloadBtn">Reload</button>
        </div>
      </div>
      <form class="cms-form-grid" id="form-seo">
        ${seoFields.map((field) => fieldHtml(field, 'seo')).join('')}
        <div class="full cms-preview" id="seoPreview"></div>
        <div class="full cms-actions">
          <button class="cms-primary" type="submit">Save SEO</button>
        </div>
      </form>`);
    const form = byId('form-seo');
    form.addEventListener('input', () => { setDirty(true); updateSeoPreview(); });
    form.addEventListener('submit', saveSeo);
    byId('seoPage').addEventListener('change', loadSeo);
    byId('seoReloadBtn').onclick = loadSeo;
    loadSeo();
  }

  async function loadSeo() {
    const page = byId('seoPage').value;
    const form = byId('form-seo');
    setFormDisabled(form, true);
    try {
      const doc = await db.collection('cms').doc('seo').get();
      const data = (doc.exists && doc.data()[page]) ? doc.data()[page] : {};
      seoFields.forEach((field) => {
        const input = form.elements[field.name];
        if (input) input.value = valueToText(data[field.name]);
      });
      updateSeoPreview();
      setDirty(false);
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      setFormDisabled(form, false);
    }
  }

  async function saveSeo(event) {
    event.preventDefault();
    const page = byId('seoPage').value;
    const form = byId('form-seo');
    if (!validateForm(form, seoFields)) return;
    setFormDisabled(form, true);
    const payload = {};
    seoFields.forEach((field) => {
      const input = form.elements[field.name];
      payload[field.name] = parseField(field, input.value || '', false);
    });
    payload.updatedAt = now();
    payload.updatedBy = activeUser ? activeUser.uid : '';
    try {
      await db.collection('cms').doc('seo').set({ [page]: payload }, { merge: true });
      setDirty(false);
      toast('SEO saved for ' + page + '.');
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      setFormDisabled(form, false);
    }
  }

  function updateSeoPreview() {
    const form = byId('form-seo');
    const preview = byId('seoPreview');
    if (!form || !preview) return;
    const title = form.elements.title.value || 'Existing HTML title will remain';
    const url = form.elements.canonical.value || 'Existing canonical URL will remain';
    const desc = form.elements.description.value || 'Existing HTML meta description will remain until SEO is saved here.';
    preview.innerHTML = `
      <div class="cms-preview-title">${esc(title)}</div>
      <div class="cms-preview-url">${esc(url)}</div>
      <div class="cms-preview-desc">${esc(desc)}</div>`;
  }

  function renderListModule(config) {
    const root = byId('cmsListRoot-' + config.key);
    if (!root) return;
    listState[config.key] = { docs: [], query: '', status: '' };
    root.innerHTML = shell(config.title, config.subtitle, `
      <div class="cms-toolbar">
        <div class="cms-actions">
          <input class="search-input" id="${config.key}Search" placeholder="Search ${esc(config.title.toLowerCase())}">
          <select class="filter-select" id="${config.key}Status">
            <option value="">All statuses</option>
            <option>Published</option>
            <option>Draft</option>
            <option>Archived</option>
          </select>
        </div>
        <div class="cms-actions">
          <button class="cms-secondary" type="button" id="${config.key}Reload">Reload</button>
          <button class="cms-primary" type="button" id="${config.key}Add">Add ${esc(config.title.replace(/s$/, ''))}</button>
        </div>
      </div>
      <div class="panel">
        <div class="cms-table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Featured</th><th>Order</th><th>Updated</th><th></th></tr></thead>
            <tbody id="${config.key}Body"><tr><td class="loading" colspan="6">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>`);
    byId(config.key + 'Search').addEventListener('input', (event) => {
      listState[config.key].query = event.target.value.toLowerCase();
      drawList(config);
    });
    byId(config.key + 'Status').addEventListener('change', (event) => {
      listState[config.key].status = event.target.value;
      drawList(config);
    });
    byId(config.key + 'Reload').onclick = () => loadList(config);
    byId(config.key + 'Add').onclick = () => openItemEditor(config);
    loadList(config);
  }

  async function loadList(config) {
    const state = listState[config.key];
    const body = byId(config.key + 'Body');
    if (body) body.innerHTML = '<tr><td class="loading" colspan="6">Loading...</td></tr>';
    try {
      let snap;
      try {
        snap = await db.collection(config.collection).orderBy('order', 'asc').get();
      } catch (orderError) {
        snap = await db.collection(config.collection).get();
      }
      state.docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      drawList(config);
    } catch (error) {
      if (body) body.innerHTML = '<tr><td class="empty" colspan="6">' + esc(friendlyError(error)) + '</td></tr>';
    }
  }

  function drawList(config) {
    const state = listState[config.key];
    const body = byId(config.key + 'Body');
    if (!body) return;
    const filtered = state.docs.filter((item) => {
      const statusOk = !state.status || (item.status || 'Published') === state.status;
      const haystack = config.search.map((key) => valueToText(item[key])).join(' ').toLowerCase();
      return statusOk && (!state.query || haystack.includes(state.query));
    });
    if (!filtered.length) {
      body.innerHTML = '<tr><td class="cms-empty" colspan="6">No records found.</td></tr>';
      return;
    }
    body.innerHTML = filtered.map((item) => {
      const title = item.title || item.question || item.client || item.fileName || item.name || item.id;
      return `
        <tr>
          <td>${esc(title)}</td>
          <td><span class="status-pill status-${esc((item.status || 'Published').replace(/\s/g, '-'))}">${esc(item.status || 'Published')}</span></td>
          <td>${item.featured ? 'Yes' : 'No'}</td>
          <td>${esc(item.order == null ? '' : item.order)}</td>
          <td>${fmtDate(item.updatedAt || item.createdAt)}</td>
          <td>
            <button class="btn-sm" data-edit="${esc(item.id)}">Edit</button>
            ${config.key === 'media' ? `<button class="btn-sm" data-copy="${esc(item.id)}">Copy URL</button>` : ''}
            <button class="btn-sm danger" data-delete="${esc(item.id)}">Delete</button>
          </td>
        </tr>`;
    }).join('');
    body.querySelectorAll('[data-edit]').forEach((button) => {
      button.onclick = () => openItemEditor(config, state.docs.find((item) => item.id === button.dataset.edit));
    });
    body.querySelectorAll('[data-delete]').forEach((button) => {
      button.onclick = () => deleteItem(config, button.dataset.delete);
    });
    body.querySelectorAll('[data-copy]').forEach((button) => {
      button.onclick = () => copyMediaUrl(config, button.dataset.copy);
    });
  }

  function openItemEditor(config, item) {
    const isEdit = !!item;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:760px;">
        <h3>${isEdit ? 'Edit' : 'Add'} ${esc(config.title.replace(/s$/, ''))}</h3>
        <form class="cms-form-grid" id="itemEditorForm">
          ${config.media ? '<div class="cms-field full"><label>Local Image Upload Preview</label><input type="file" id="mediaFileInput" accept="image/*"><div class="cms-help">Firebase Storage is not initialized yet. This picker previews an image and can store a data URL or pasted Storage URL in Firestore.</div><img id="mediaPreview" class="cms-upload-preview" alt=""></div>' : ''}
          ${config.fields.map((field) => fieldHtml(field, 'editor', item ? item[field.name] : '')).join('')}
          <div class="full modal-actions">
            <button class="cms-primary" type="submit">${isEdit ? 'Save Changes' : 'Create'}</button>
            <button class="modal-close" type="button" data-close="1">Cancel</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    hydrateForm(form, config.fields, item || {});
    form.addEventListener('input', () => setDirty(true));
    form.querySelector('[data-close]').onclick = () => overlay.remove();
    if (config.media) wireMediaPreview(form);
    const titleInput = form.elements.title;
    const slugInput = form.elements.slug;
    if (titleInput && slugInput && !slugInput.value) {
      titleInput.addEventListener('input', () => {
        if (!slugInput.dataset.touched) slugInput.value = slugify(titleInput.value);
      });
      slugInput.addEventListener('input', () => { slugInput.dataset.touched = '1'; });
    }
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!validateForm(form, config.fields)) return;
      setFormDisabled(form, true);
      const payload = {};
      config.fields.forEach((field) => {
        const input = form.elements[field.name];
        if (!input) return;
        if (field.type === 'rich') payload[field.name] = form.querySelector('[data-rich-name="' + field.name + '"]').innerHTML.trim();
        else payload[field.name] = parseField(field, input.value || '', input.checked);
      });
      if (!payload.slug && payload.title) payload.slug = slugify(payload.title);
      payload.updatedAt = now();
      payload.updatedBy = activeUser ? activeUser.uid : '';
      if (!isEdit) payload.createdAt = now();
      try {
        if (isEdit) await db.collection(config.collection).doc(item.id).set(payload, { merge: true });
        else await db.collection(config.collection).add(payload);
        setDirty(false);
        overlay.remove();
        toast(config.title + ' saved.');
        loadList(config);
      } catch (error) {
        toast(friendlyError(error), 'error');
        setFormDisabled(form, false);
      }
    };
  }

  function wireMediaPreview(form) {
    const picker = form.querySelector('#mediaFileInput');
    const urlInput = form.elements.url;
    const fileNameInput = form.elements.fileName;
    const preview = form.querySelector('#mediaPreview');
    picker.addEventListener('change', () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      if (fileNameInput && !fileNameInput.value) fileNameInput.value = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        urlInput.value = reader.result;
        preview.src = reader.result;
        preview.style.display = 'block';
        setDirty(true);
      };
      reader.readAsDataURL(file);
    });
    if (urlInput.value) {
      preview.src = urlInput.value;
      preview.style.display = 'block';
    }
  }

  async function deleteItem(config, id) {
    if (!(await confirmDialog('Delete this item from ' + config.title + '? This cannot be undone.'))) return;
    try {
      await db.collection(config.collection).doc(id).delete();
      toast('Deleted.');
      loadList(config);
    } catch (error) {
      toast(friendlyError(error), 'error');
    }
  }

  function copyMediaUrl(config, id) {
    const item = listState[config.key].docs.find((doc) => doc.id === id);
    if (!item || !item.url) return toast('No URL available.', 'error');
    navigator.clipboard.writeText(item.url)
      .then(() => toast('Media URL copied.'))
      .catch(() => toast('Copy failed. Select and copy the URL manually.', 'error'));
  }

  function fieldHtml(field, scope, value) {
    const id = scope + '-' + field.name;
    const req = field.required ? ' required' : '';
    const help = field.help ? `<div class="cms-help">${esc(field.help)}</div>` : '';
    const full = ['textarea', 'rich'].includes(field.type) ? ' full' : '';
    if (field.type === 'checkbox') {
      return `
        <div class="cms-field cms-check">
          <input id="${esc(id)}" name="${esc(field.name)}" type="checkbox">
          <label for="${esc(id)}">${esc(field.label)}</label>
        </div>`;
    }
    if (field.type === 'select') {
      return `
        <div class="cms-field${full}">
          <label for="${esc(id)}">${esc(field.label)}</label>
          <select id="${esc(id)}" name="${esc(field.name)}"${req}>
            <option value="">Select</option>
            ${field.options.map((option) => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}
          </select>${help}
        </div>`;
    }
    if (field.type === 'textarea') {
      return `
        <div class="cms-field full">
          <label for="${esc(id)}">${esc(field.label)}</label>
          <textarea id="${esc(id)}" name="${esc(field.name)}"${req}>${esc(valueToText(value))}</textarea>${help}
        </div>`;
    }
    if (field.type === 'rich') {
      return `
        <div class="cms-field full">
          <label>${esc(field.label)}</label>
          <div class="cms-editor-toolbar">
            <button type="button" data-cmd="bold">B</button>
            <button type="button" data-cmd="italic">I</button>
            <button type="button" data-cmd="insertUnorderedList">List</button>
            <button type="button" data-cmd="formatBlock" data-value="h3">H3</button>
            <button type="button" data-cmd="formatBlock" data-value="p">P</button>
          </div>
          <div class="cms-rich-editor" contenteditable="true" data-rich-name="${esc(field.name)}">${valueToText(value)}</div>
          <input type="hidden" name="${esc(field.name)}">
        </div>`;
    }
    return `
      <div class="cms-field${full}">
        <label for="${esc(id)}">${esc(field.label)}</label>
        <input id="${esc(id)}" name="${esc(field.name)}" type="${esc(field.type)}"${req} value="${esc(valueToText(value))}">${help}
      </div>`;
  }

  function hydrateForm(form, fields, data) {
    fields.forEach((field) => {
      const input = form.elements[field.name];
      if (!input) return;
      if (field.type === 'checkbox') input.checked = !!data[field.name];
      else if (field.type === 'rich') {
        const editor = form.querySelector('[data-rich-name="' + field.name + '"]');
        editor.innerHTML = data[field.name] || '';
      } else input.value = valueToText(data[field.name]);
    });
    form.querySelectorAll('[data-cmd]').forEach((button) => {
      button.onclick = () => document.execCommand(button.dataset.cmd, false, button.dataset.value || null);
    });
  }

  function validateForm(form, fields) {
    for (const field of fields) {
      if (!field.required) continue;
      const input = form.elements[field.name];
      const value = field.type === 'rich'
        ? form.querySelector('[data-rich-name="' + field.name + '"]').textContent.trim()
        : (input && input.value ? input.value.trim() : '');
      if (!value) {
        toast(field.label + ' is required.', 'error');
        if (input && input.focus) input.focus();
        return false;
      }
    }
    const badUrl = Array.from(form.querySelectorAll('input[type="url"]')).find((input) => input.value && !isValidUrl(input.value));
    if (badUrl) {
      toast('Enter a valid URL or leave it empty.', 'error');
      badUrl.focus();
      return false;
    }
    return true;
  }

  function isValidUrl(value) {
    if (String(value).startsWith('data:image/')) return true;
    try {
      new URL(value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function setFormDisabled(form, disabled) {
    form.querySelectorAll('input, textarea, select, button').forEach((control) => {
      control.disabled = disabled;
    });
  }

  function shell(title, subtitle, body) {
    return `
      <div class="cms-toolbar">
        <div>
          <h2>${esc(title)}</h2>
          <div class="pane-sub">${esc(subtitle)}</div>
        </div>
      </div>
      <div class="panel" style="padding:20px;">${body}</div>`;
  }

  function renderProfile() {
    const root = byId('cmsProfileRoot');
    if (!root || !activeUser) return;
    root.innerHTML = shell('Profile', 'Current admin session and account information.', `
      <div class="cms-grid">
        <div class="cms-card"><h3>Email</h3><p>${esc(activeUser.email || '')}</p></div>
        <div class="cms-card"><h3>UID</h3><p style="word-break:break-all;">${esc(activeUser.uid || '')}</p></div>
        <div class="cms-card"><h3>Verified</h3><p>${activeUser.emailVerified ? 'Yes' : 'No'}</p></div>
      </div>`);
  }

  function boot(user) {
    if (booted) return;
    booted = true;
    activeUser = user;
    renderAll();
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      if (adminDoc.exists) boot(user);
    } catch (error) {
      console.error('CMS boot failed:', error);
    }
  });
})();
