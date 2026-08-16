(function () {
  var links = document.querySelectorAll(".blog-toc a[href^=\"#\"]");
  if (!links.length || !("IntersectionObserver" in window)) return;

  var targets = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) targets.push({ el: el, link: a });
  });
  if (!targets.length) return;

  function setActive(link) {
    links.forEach(function (a) {
      a.classList.toggle("active", a === link);
    });
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var match = targets.find(function (t) { return t.el === entry.target; });
        if (match) setActive(match.link);
      });
    },
    { rootMargin: "-100px 0px -70% 0px", threshold: 0 }
  );

  targets.forEach(function (t) { observer.observe(t.el); });
})();
