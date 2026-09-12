// Fills the Morning/Midday/Night news boxes from /api/news, a serverless
// function backed by a Netlify Blobs store that the site-sync automation
// (808dystopia-core repo) writes to. Any failure just leaves the
// "Coming soon" placeholders already in the page's markup untouched.
(function () {
  var MAX_HOME_ITEMS = 3;
  var isNewsPage = document.body.dataset.page === "news";

  function renderStories(article, stories) {
    article.classList.remove("empty");

    var visible = isNewsPage ? stories : stories.slice(0, MAX_HOME_ITEMS);
    var list = document.createElement("ul");
    list.className = "story-list";
    visible.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });

    var h3 = article.querySelector("h3");
    var p = article.querySelector("p");
    if (h3) h3.textContent = stories.length === 1 ? "1 story" : stories.length + " stories";
    if (p) p.replaceWith(list);

    if (!isNewsPage && stories.length > MAX_HOME_ITEMS) {
      var more = document.createElement("a");
      more.href = "/news";
      more.className = "more-link";
      more.textContent = "+" + (stories.length - MAX_HOME_ITEMS) + " more →";
      article.appendChild(more);
    }
  }

  fetch("/api/news")
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data) return;
      ["morning", "midday", "night"].forEach(function (slot) {
        var article = document.querySelector('[data-slot="' + slot + '"]');
        var stories = data[slot] && data[slot].stories;
        if (article && Array.isArray(stories) && stories.length > 0) {
          renderStories(article, stories);
        }
      });
    })
    .catch(function () {
      // Leave the static "Coming soon" placeholders as-is.
    });
})();
