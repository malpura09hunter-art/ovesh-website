# Ovesh Malpura — Official Image Gallery

**Target URL:** https://oveshmalpura.tech/images  
**Person:** Ovesh Malpura  
**Organization:** Ovesh Malpura Cyber Labs  

This package is a complete, ready-to-integrate premium photograph gallery optimized for Google Images, technical SEO, structured data, and AI discoverability.

## Contents

```
gallery/
├── index.html                 # Main gallery page (premium design + full SEO)
├── image-manifest.json        # Machine-readable inventory of all images
├── image-sitemap.xml          # Google Image Sitemap (ready for submission)
├── ovesh-malpura-*.webp       # Optimized WebP images (full + responsive)
├── ovesh-malpura-*.jpg        # JPEG fallbacks
├── optimized/                 # Working optimized set
├── reports/                   # Audit, privacy, implementation notes
└── README.md                  # This file
```

## Integration Instructions (Static Site)

1. **Upload the gallery folder contents** so that the page is served at:
   - `https://oveshmalpura.tech/images`  (or `/images/index.html`)

2. **Recommended structure on the server / hosting:**
   ```
   /images/
     index.html
     image-sitemap.xml
     image-manifest.json
     ovesh-malpura-professional-blazer-portrait.webp
     ovesh-malpura-professional-blazer-portrait.jpg
     ... (all other ovesh-malpura-* files)
   ```

3. **Update existing sitemap.xml**
   - Add a reference to the new image sitemap, or merge the `<url>` entry from `image-sitemap.xml` into the main sitemap (the existing site already uses the image namespace).
   - Example addition to sitemap index or main sitemap:
     ```xml
     <url>
       <loc>https://oveshmalpura.tech/images</loc>
       <lastmod>2026-11-17</lastmod>
       <!-- image:image entries from image-sitemap.xml -->
     </url>
     ```

4. **Navigation**
   - Add a link to `/images` from the site header, About page, and optionally the footer.
   - The gallery already links back to Home and About.

5. **robots.txt** (already allows everything)
   - No change required. Confirm no accidental Disallow for `/images`.

6. **Google Search Console / Bing**
   - Submit or resubmit the sitemap.
   - Use URL Inspection on `https://oveshmalpura.tech/images`.
   - Request indexing after the page is live.

## Design & Technical Features

- Apple-inspired minimal dark editorial design
- Responsive CSS grid gallery
- Full-screen lightbox with keyboard (← → Esc) and touch support
- Semantic HTML + crawlable images (not JS-only)
- WebP primary + JPEG fallbacks
- Responsive `srcset` / `sizes`
- Explicit width/height (prevents CLS)
- Lazy-loading for below-fold images; high priority for featured
- Clean JSON-LD graph: Person, Organization, CollectionPage, ImageObject, BreadcrumbList
- Consistent entity references to Ovesh Malpura and Ovesh Malpura Cyber Labs
- No sensitive EXIF remaining on public images

## Featured Image
`ovesh-malpura-professional-blazer-portrait` — selected as the strongest professional portrait.

## Before Production
- Review the gallery visually on mobile and desktop.
- Confirm all image URLs resolve after upload.
- Update any internal links on the existing site.
- Do **not** deploy until you explicitly approve.

## Contact / Next Steps
After you review this package, provide feedback or approval for any adjustments before production deployment.
