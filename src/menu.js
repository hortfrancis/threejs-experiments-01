// Vite resolves this glob at build time into a map of matching file paths.
// Nothing is imported or executed — the `{ eager: false }` values are loader
// functions we never call. We only want the keys, so the menu discovers new
// experiments on its own and there is no list to keep up to date.
const modules = import.meta.glob('/experiments/*/main.js');

// "/experiments/01-isometric-floor/main.js" -> "01-isometric-floor"
const slugs = Object.keys(modules)
  .map((path) => path.split('/')[2])
  .sort();

// "01-isometric-floor" -> "Isometric floor"
function title(slug) {
  const words = slug.replace(/^\d+-/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

document.getElementById('list').innerHTML = slugs
  .map(
    (slug) => `
      <li>
        <a href="/experiments/${slug}/">
          ${title(slug)}
          <span class="slug">${slug}</span>
        </a>
      </li>`,
  )
  .join('');
