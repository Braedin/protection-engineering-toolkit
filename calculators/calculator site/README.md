# Protection Toolkit (review copy)

Static site, plain HTML and JavaScript. No build step and no dependencies.
Open `index.html` in a browser to try it, or copy the folder to any static host.

```
index.html                  home page, cards built from js/registry.js
calculators/*.html          one page per calculator (form config + notes)
js/calcs/*.js               the calculations, pure functions, no DOM
js/core.js                  shared form builder, results renderer, SVG plots
js/registry.js              list of calculators (edit to add one)
css/style.css               styles, light and dark
tests/run.js                checks against the original spreadsheet values
CHANGES.md                  formula fixes and items to verify
```

## Run the tests

```
node tests/run.js
```

## Add a calculator

1. Write `js/calcs/my-calc.js` (copy the wrapper from any existing file).
2. Copy any file in `calculators/`, change the `inputs`, `calc` and `notes`.
3. Add an entry to `js/registry.js`.
4. Add checks to `tests/run.js` against a known-good result.

Inputs are remembered per calculator in the browser (localStorage).
This folder is separate from the GitHub repository and nothing has been committed there.
