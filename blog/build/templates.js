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

function head({ title, description }) {
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
  <link rel="stylesheet" href="/blog.css">`;
}

function shell({ title, description, activeNav, bodyContent }) {
  return `<!doctype html>
<html lang="en">
<head>
  ${head({ title, description })}
</head>
<body data-page="${activeNav}">
  <header class="site-header"><nav class="nav container"><a class="brand" href="/">Gourab Choudhury</a><button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span></button><div class="nav-links">${navLinksHtml()}<button class="command-button" type="button" data-command-open>ctrl k</button></div></nav></header>
  <main class="container page narrow">
${bodyContent}
  </main>
  <footer class="footer container"><span>blog</span><a href="${PORTFOLIO_URL}/projects/index.html">projects</a></footer>
  <div class="command-menu" data-command-menu hidden><div class="command-panel"><input type="search" placeholder="Jump to a page..." data-command-input><div class="command-list">${commandListHtml()}</div></div></div>
  <script src="/script.js"></script>
</body>
</html>
`;
}

function tagsHtml(post, linked) {
  if (!post.tags.length) return "";
  const chips = post.tags
    .map((t) =>
      linked
        ? `<a class="note-tag" href="/tags/${slugifyTag(t)}/">${escapeHtml(t)}</a>`
        : `<span class="note-tag">${escapeHtml(t)}</span>`
    )
    .join("");
  return `<div class="note-tags">${chips}</div>`;
}

function postCard(post, formatDate) {
  return `      <article>
        <p class="post-meta"><a class="category-badge" href="/${post.category}/">${escapeHtml(post.categoryLabel)}</a> &middot; <time datetime="${post.date}">${formatDate(post.date)}</time></p>
        <h2><a href="${post.url}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.description)}</p>
        ${tagsHtml(post, false)}
      </article>`;
}

function listTemplate({ pageTitle, heading, intro, posts, formatDate }) {
  const body = `    <header class="page-head">
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(intro)}</p>
    </header>
    <div class="article-list">
${posts.length ? posts.map((p) => postCard(p, formatDate)).join("\n") : "      <p>No posts here yet.</p>"}
    </div>`;
  return shell({
    title: `${pageTitle} | Gourab Choudhury`,
    description: intro,
    activeNav: "blog",
    bodyContent: body,
  });
}

function postTemplate({ post, formatDate }) {
  const body = `    <article class="post-body">
      <header class="page-head">
        <p class="post-meta"><a class="category-badge" href="/${post.category}/">${escapeHtml(post.categoryLabel)}</a> &middot; <time datetime="${post.date}">${formatDate(post.date)}</time></p>
        <h1>${escapeHtml(post.title)}</h1>
      </header>
      ${post.html}
      ${tagsHtml(post, true)}
    </article>`;
  return shell({
    title: `${post.title} | Gourab Choudhury`,
    description: post.description || post.title,
    activeNav: "blog",
    bodyContent: body,
  });
}

function categoriesTemplate({ categories }) {
  const items = categories
    .map(
      (c) =>
        `      <li><a href="/${c.slug}/">${escapeHtml(c.label)}</a><span class="cat-count">${c.count} post${c.count === 1 ? "" : "s"}</span></li>`
    )
    .join("\n");
  const body = `    <header class="page-head">
      <h1>Categories</h1>
      <p>Browse posts by category.</p>
    </header>
    <ul class="category-list">
${items || "      <li>No categories yet.</li>"}
    </ul>`;
  return shell({
    title: "Categories | Gourab Choudhury",
    description: "Browse blog posts by category.",
    activeNav: "blog",
    bodyContent: body,
  });
}

module.exports = { listTemplate, postTemplate, categoriesTemplate, slugifyTag };
