export const reportCSS = `
    @page { size: letter; margin: 0.5in; }

    body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; }

    /* LAYOUT UTILS */
    .report-page { max-width: 8.5in; margin: 0 auto; box-sizing: border-box; }
    .page-break { page-break-after: always; }

    /* SCREEN PREVIEW — simulate printed pages */
    @media screen {
        body { background-color: #525659; padding: 20px 0; }
        .report-page {
            width: 8.5in;
            min-height: 11in;
            padding: 0.5in;
            margin: 20px auto;
            background: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
    }

    /* COVER PAGE STYLES */
    .cover-page { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding-top: 0.5in; }
    .cover-title { font-size: 36pt; font-weight: bold; color: #003366; margin-top: 1em; margin-bottom: 0.2em; }
    .cover-subtitle { font-size: 14pt; font-style: italic; color: #666; margin-bottom: 3in; }
    .references-section { width: 100%; text-align: center; margin-top: auto; }
    .references-section p { font-size: 10pt; margin: 6px 0; }
    .references-section a { color: #003366; }

    /* REPORT CONTENT STYLES */
    .report-page-title { font-size: 18pt; font-weight: bold; color: #003366; border-bottom: 2px solid #003366; margin-bottom: 1em; }
    .figure-container { text-align: center; margin-bottom: 0.5em; }
    .report-figure { width: 100%; max-height: 500px; object-fit: contain; }
    .figure-caption { font-size: 10pt; font-style: italic; color: #555; margin-top: 5px; }
    p { margin: 0; }

    /* TABLE STYLES */
    .report-table { margin-bottom: 0.5em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: center; font-size: 9pt; }
    th { background-color: #f0f0f0; }

    /* COMMENTS SECTION */
    .comments-section { margin-top: 0.5em; page-break-inside: avoid; }
    .comments-section h3 { font-size: 12pt; color: #003366; margin-bottom: 5px; }
    .comment-field { width: 100%; border: 1px solid #999; padding: 6px; font-family: 'Arial', sans-serif; font-size: 10pt; resize: vertical; box-sizing: border-box; }
    .comment-field:focus { outline: none; border-color: #003366; }
    @media print { .comment-field { border: 1px solid #ccc; resize: none; } }

    /* PRINT OPTIMIZATION */
    @media print {
        body { -webkit-print-color-adjust: exact; }
    }
`;

export const buildCoverPage = ({logoURL, todayDate, translations}) => `
  <div class="report-page page-break cover-page">
      <div class="logo-container">
          <img src="${logoURL}" style="width: 3in;" alt="GEOGloWS Logo">
      </div>
      <div class="cover-title">${translations.coverTitle}</div>
      <div class="cover-subtitle">${translations.coverSubtitle}<br>${translations.generated}: ${todayDate}</div>

      <div class="references-section">
          <p>${translations.sourceReport} <a href="https://apps.geoglows.org/hydroviewer" target="_blank">apps.geoglows.org/hydroviewer</a></p>
          <p>${translations.sourceData} <a href="https://aws.amazon.com/marketplace/pp/prodview-gne36pxf5jbqk" target="_blank">s3://geoglows-v2</a></p>
          <p>${translations.sourceLearnMore} <a href="https://training.geoglows.org" target="_blank">training.geoglows.org</a></p>
          <p>${translations.disclaimer}</p>
      </div>
  </div>
`;

export const buildReportPage = ({pageTitle, imageUrl, riverId, index, tableHTML, translations}) => `
    <div class="report-page page-break">
        <div class="report-page-title">${pageTitle}</div>
        <div class="figure-container">
            <img class="report-figure" src="${imageUrl}" alt="${translations.forecastForRiver} ${riverId}">
            <div class="figure-caption">${translations.figureCaption} ${index + 1}: ${translations.forecastForRiver} ${riverId}</div>
        </div>
        <div class="report-table">
            ${tableHTML}
        </div>
        <div class="comments-section">
            <p>${translations.notes}</p>
            <textarea class="comment-field" rows="4" placeholder="${translations.commentPlaceholder}"></textarea>
        </div>
    </div>
`;

export const buildReportDocument = ({lang, css, coverPageHTML, reportPagesHTML, translations}) => `
<html lang="${lang}">
<head>
  <title>${translations.pageTitle}</title>
  <style>${css}</style>
</head>
<body>
  <div id="report">
    ${coverPageHTML}
    ${reportPagesHTML}
  </div>
</body>
</html>
`;
