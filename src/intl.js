import en from './json/locales/en-US.json' with {type: "json"}
import es from './json/locales/es.json' with {type: "json"}
import fr from './json/locales/fr.json' with {type: "json"} 

// get the locale based on the path in the url given by the pattern /{lang}/...
const lang = window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en'

// determine the language using switch statement - default to english if the language is not supported
let text
switch (lang) {
  case 'en':
    text = en
    break
  case 'es':
    text = es
    break
  case 'fr':
    text = fr
    break
  default:
    text = en
}

export {lang, text}
window.text = text  // for debugging purposes, make the text object globally accessible
