"use strict";

const PORTFOLIO_URL = "https://gourabchoudhury.dev";

const NAV = [
  { key: "about", label: "about", href: `${PORTFOLIO_URL}/index.html` },
  { key: "work", label: "work", href: `${PORTFOLIO_URL}/work/index.html` },
  { key: "projects", label: "projects", href: `${PORTFOLIO_URL}/projects/index.html` },
  { key: "notes", label: "notes", href: `${PORTFOLIO_URL}/notes/index.html` },
  { key: "blog", label: "blog", href: "/" },
  { key: "resume", label: "resume", href: `${PORTFOLIO_URL}/resume/index.html` },
  { key: "contact", label: "contact", href: `${PORTFOLIO_URL}/contact/index.html` },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugifyTag(tag) {
  return String(tag)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function navLinksHtml() {
  return NAV.map((item) => `<a data-nav="${item.key}" href="${item.href}">${item.label}</a>`).join("");
}

function commandListHtml() {
  return NAV.map((item) => `<a href="${item.href}">${item.label}</a>`).join("");
}

function head({ title, description, extraStyles }) {
  const extraStyleTags = (extraStyles || []).map((href) => `\n  <link rel="stylesheet" href="${href}">`).join("");
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="author" content="Gourab Choudhury">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="/assets/gourab-logo.png">
  <link rel="alternate" type="application/rss+xml" title="Gourab Choudhury -- Blog" href="/feed.xml">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/blog.css">${extraStyleTags}`;
}

function sidebarHtml(categories, activeCategory) {
  if (!categories || !categories.length) return "";
  const allActive = activeCategory == null;
  const items = categories
    .map((c) => {
      const isActive = c.slug === activeCategory;
      return `        <li><a href="/${c.slug}/"${isActive ? ' class="active"' : ""}>${escapeHtml(c.label)}<span class="sidebar-count">${c.count}</span></a></li>`;
    })
    .join("\n");
  return `    <aside class="blog-sidebar">
      <h2>Categories</h2>
      <ul>
        <li><a href="/"${allActive ? ' class="active"' : ""}>All posts</a></li>
${items}
      </ul>
    </aside>`;
}

function tocHtml(headings) {
  if (!headings || !headings.length) return "";
  const items = headings
    .map(
      (h) =>
        `        <li class="toc-level-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`
    )
    .join("\n");
  return `    <aside class="blog-toc">
      <h2>On this page</h2>
      <ul>
${items}
      </ul>
    </aside>`;
}

function shell({ title, description, activeNav, bodyContent, categories, activeCategory, headings, extraScripts, extraStyles }) {
  const sidebar = sidebarHtml(categories, activeCategory);
  const toc = tocHtml(headings);
  const layoutClasses = ["blog-layout"];
  if (toc) layoutClasses.push("has-toc");
  const layoutOpen = sidebar ? `<div class="${layoutClasses.join(" ")}">` : "";
  const layoutClose = sidebar ? "</div>" : "";
  const mainInner = sidebar
    ? `${sidebar}\n    <div class="blog-main">\n${bodyContent}\n    </div>${toc ? `\n${toc}` : ""}`
    : bodyContent;
  const extraScriptTags = (extraScripts || [])
    .map((s) => (typeof s === "string" ? `\n  <script src="${s}"></script>` : `\n  <script>${s.inline}</script>`))
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  ${head({ title, description, extraStyles })}
</head>
<body data-page="${activeNav}">
  <header class="site-header"><nav class="nav container"><a class="brand" href="/">Gourab Choudhury</a><button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span></button><div class="nav-links">${navLinksHtml()}<button class="command-button" type="button" data-command-open>ctrl k</button></div></nav></header>
  <main class="container page">
    ${layoutOpen}
${mainInner}
    ${layoutClose}
  </main>
  <footer class="footer container"><span>blog</span><a href="${PORTFOLIO_URL}/projects/index.html">projects</a></footer>
  <div class="command-menu" data-command-menu hidden><div class="command-panel"><input type="search" placeholder="Jump to a page..." data-command-input><div class="command-list">${commandListHtml()}</div></div></div>
  <script src="/script.js"></script>${extraScriptTags}
</body>
</html>
`;
}

function tagsHtml(post, linked) {
  if (!post.tags.length) return "";
  const chips = post.tags
    .map((t) =>
      linked
        ? `<a class="note-tag" href="/tags/${slugifyTag(t)}/">#${escapeHtml(t)}</a>`
        : `<span class="note-tag">#${escapeHtml(t)}</span>`
    )
    .join("");
  return `<div class="note-tags">${chips}</div>`;
}

function readMeta(post, formatDate) {
  return `<a class="category-badge" href="/${post.category}/">${escapeHtml(post.categoryLabel)}</a> &middot; <time datetime="${post.date}">${formatDate(post.date)}</time> &middot; ${post.readMinutes} min read`;
}

function postCard(post, formatDate) {
  return `        <article>
          <div class="post-row-head">
            <h2><a href="${post.url}">${escapeHtml(post.title)}</a></h2>
            <p class="post-row-meta">${readMeta(post, formatDate)}</p>
          </div>
          <p>${escapeHtml(post.description)}</p>
          ${tagsHtml(post, false)}
        </article>`;
}

function listTemplate({ kicker, pageTitle, heading, intro, posts, formatDate, categories, activeCategory }) {
  const count = `${posts.length} post${posts.length === 1 ? "" : "s"}`;
  const body = `      <header class="page-head">
        <p class="kicker">${escapeHtml(kicker)}</p>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(intro)}</p>
      </header>
      <div class="list-bar"><span class="list-count">${count}</span></div>
      <div class="article-list">
${posts.length ? posts.map((p) => postCard(p, formatDate)).join("\n") : "        <p>No posts here yet.</p>"}
      </div>`;
  return shell({
    title: `${pageTitle} | Gourab Choudhury`,
    description: intro,
    activeNav: "blog",
    bodyContent: body,
    categories,
    activeCategory,
  });
}

const MERMAID_CDN_SRC = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
const MERMAID_INIT = `mermaid.initialize({startOnLoad:true,theme:"base",themeVariables:{primaryColor:"#eef8f4",primaryTextColor:"#181a1f",primaryBorderColor:"#165a4a",lineColor:"#626973",secondaryColor:"#efefea",tertiaryColor:"#ffffff",background:"#ffffff",fontFamily:"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", sans-serif"}});`;

function statHtml(label, value) {
  return `<div class="post-stat"><span class="post-stat-label">${escapeHtml(label)}</span><span class="post-stat-value">${value}</span></div>`;
}

function postTemplate({ post, formatDate, categories, activeCategory }) {
  const body = `      <article class="post-body">
        <header class="page-head">
          <p class="kicker"><a class="category-badge" href="/${post.category}/">${escapeHtml(post.categoryLabel)}</a></p>
          <h1>${escapeHtml(post.title)}</h1>
          ${post.descriptionIsExplicit ? `<p>${escapeHtml(post.description)}</p>` : ""}
          <div class="post-stats">
            ${statHtml("Published", `<time datetime="${post.date}">${formatDate(post.date)}</time>`)}
            ${statHtml("Read", `${post.readMinutes} min`)}
          </div>
          ${tagsHtml(post, true)}
        </header>
        ${post.html}
      </article>`;
  return shell({
    title: `${post.title} | Gourab Choudhury`,
    description: post.description || post.title,
    activeNav: "blog",
    bodyContent: body,
    categories,
    activeCategory,
    headings: post.headings,
    extraStyles: post.hasMath ? ["/katex/katex.min.css"] : [],
    extraScripts: [
      ...(post.headings && post.headings.length ? ["/toc.js"] : []),
      ...(post.hasMermaid ? [MERMAID_CDN_SRC, { inline: MERMAID_INIT }] : []),
    ],
  });
}

module.exports = { listTemplate, postTemplate, slugifyTag };
