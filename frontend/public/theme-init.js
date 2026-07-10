{
  const storageKey = "finance-tracker-color-scheme";
  const meta = document.querySelector('meta[name="color-scheme"]');
  try {
    const colorScheme = localStorage.getItem(storageKey);
    if (colorScheme === "light" || colorScheme === "dark") {
      document.documentElement.dataset.theme = colorScheme;
      if (meta) meta.content = colorScheme;
    }
  } catch {
    document.documentElement.removeAttribute("data-theme");
    if (meta) meta.content = "light dark";
  }
}
