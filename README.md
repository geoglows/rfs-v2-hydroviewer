# RFS Viewer

This is the source code for https://hydroviewer.geoglows.org

## Translations

To add a translation,

1. Make a new directory at the root level of the project. The name should be the 2 character language code from [ISO 639](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes).
2. Create a copy of index.html from an existing translation and place it in your new directory.
3. Translate all the text on the page. Note, do not translate the class names or ID's of any html tags. Just the text contained within tags.
4. Add the plotly localization file for the language, if it exists, to the `head` tag of the html. Find available localizations at the [plotly.js locales directory](https://github.com/plotly/plotly.js/tree/master/lib/locales).
5. Create a copy of an existing localization JS file in `/static/js/`. Name it using your language's language code in the name pattern localization.{ISO639-code}.js. Populate the required translations.
6. Update the script tag where the localization tag is loaded in the head to reference your new translation.
7. Add a new entry for your translation to the language drop down in the html of all existing translations. On the page for your language, the href for your new link should be #. On all other pages, the href for your link should be /{ISO639-code}.
