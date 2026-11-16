# Sufias Fashion theme: working rules

## Mobile first (always)
Every website change must also work well on phones. Most Sufias customers shop on mobile.
- Check the change at phone width (390px) as well as desktop: no sideways scrolling, nothing cut off.
- Form inputs use at least 16px text so iPhones do not zoom in while typing.
- Buttons and links are easy to tap (about 44px high), with space between them.
- Side-by-side layouts stack into one column on small screens.
- Images are sized for mobile and lazy-loaded below the fold; keep mobile PageSpeed in mind.
- Say in the reply what was checked on mobile, and what was not.

## Git
Work directly on `main`: `git pull --ff-only origin main`, commit, then push to `main`. The live theme syncs from GitHub `main`.
