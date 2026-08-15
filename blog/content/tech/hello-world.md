---
title: Hello, world
date: 2026-08-16
description: The first post on this blog, and a quick note on how this whole thing gets published.
tags: [meta, static-sites]
---

This is the first post published through the new pipeline: write a markdown file, drop it into a category folder in this repo, and it ships to `blogs.gourabchoudhury.dev` on its own.

No servers involved -- just a build step that runs in GitHub Actions and static files served by GitHub Pages.

A code block, to check that syntax highlighting survives the trip:

```js
function categoryOf(path) {
  return path.split("/")[0];
}
```

More posts land in `blog/content/<category>/`, one file per post.
