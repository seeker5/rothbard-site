# Rothbard Capital site

Static site hosted on GitHub Pages. Edit any file on github.com (pencil icon) and commit; the live site updates in about a minute.

- `index.html`: cover, about and portfolio (portfolio list is near the bottom in the `co(...)` lines)
- `assets/`: images and logos

After editing `index.html`, sync the other pages (this also stamps each page's title, description, and canonical URL):

```bash
python3 sync-pages.py
```
