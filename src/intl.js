import {Lang} from './states/state.js'

const locales = {
  en: () => import('./json/locales/en-US.json'),
  es: () => import('./json/locales/es.json'),
  fr: () => import('./json/locales/fr.json'),
}

let translationDictionary

const loadLocale = async (locale) => {
  const module = await locales[locale]()
  translationDictionary = module.default
  document.documentElement.lang = locale
}

const resolve = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

const hydrateLanguageTags = () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = resolve(translationDictionary, el.dataset.i18n)
    if (val != null) el.innerText = val
  })
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = resolve(translationDictionary, el.dataset.i18nHtml)
    if (val != null) el.innerHTML = val
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = resolve(translationDictionary, el.dataset.i18nPlaceholder)
    if (val != null) el.placeholder = val
  })
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const val = resolve(translationDictionary, el.dataset.i18nTooltip)
    if (val != null) el.setAttribute('data-tooltip', val)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const val = resolve(translationDictionary, el.dataset.i18nTitle)
    if (val != null) el.title = val
  })
}

try {
  await loadLocale(Lang.get())
} catch (error) {
  console.error('Failed to load locale:', error)
  if (!translationDictionary) {
    translationDictionary = {}
  }
  if (!document.documentElement.lang) {
    document.documentElement.lang = 'en'
  }
}
hydrateLanguageTags()

export {translationDictionary, hydrateLanguageTags, loadLocale}
