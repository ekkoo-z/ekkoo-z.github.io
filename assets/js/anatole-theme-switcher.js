const getStoredThemeStyle = () => localStorage.getItem('theme');

const setThemeStyle = (style) => {
  localStorage.setItem('theme', style);
  const html = document.documentElement;
  const prevTheme = [...html.classList].find((c) => c.match(/theme--(light|dark)/));
  if (prevTheme) {
    html.classList.remove(prevTheme);
  }
  html.classList.add(`theme--${style}`);
  html.setAttribute('data-theme', style);
};

const setDarkTheme = () => setThemeStyle('dark');
const setLightTheme = () => setThemeStyle('light');

const switchTheme = () => {
  const curr = getStoredThemeStyle();
  if (curr === 'dark') {
    setLightTheme();
  } else {
    setDarkTheme();
  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => {
    const themeSwitcher = document.querySelector('.themeswitch');
    if (themeSwitcher) themeSwitcher.addEventListener('click', switchTheme, false);
  },
  false,
);

/* 默认强制暗色：只在用户显式选择过 'light' 时才切换到亮色 */
const currThemeStyle = getStoredThemeStyle();
if (currThemeStyle === 'light') {
  setLightTheme();
} else {
  setDarkTheme();
}
