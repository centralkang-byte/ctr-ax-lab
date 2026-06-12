// Sets the theme BEFORE first paint so the page doesn't flash light -> dark
// after EvalShell hydrates. Loaded as a render-blocking script at the top of
// <body> (see app/layout.tsx). Mirrors EvalShell's resolution: explicit stored
// choice wins, otherwise the OS preference. Density is handled in CSS (the base
// html font-size already equals "comfortable"), so this only touches the theme.
// Keep the storage key in sync with EvalShell.THEME_STORAGE_KEY.
(function () {
  try {
    var stored = localStorage.getItem("ctr_ax_lab_theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    /* localStorage blocked (private mode) — fall back to the CSS :root default */
  }
})();
