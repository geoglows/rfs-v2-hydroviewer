import {divChartFdc, divChartForecast, divChartRetro, divChartStatus, divChartYearlyVol, divTableForecast, divYearlyPeaks, divRasterHydrograph, divCumulativeVolume, lang} from './ui.js'

//////////////////////////////////////////////////////////////////////// Constants and configs
const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
const percentiles = Array.from({length: 51}, (_, i) => i * 2)
const sortedArrayToPercentiles = array => percentiles.toReversed().map(p => array[Math.floor(array.length * p / 100) - (p === 100 ? 1 : 0)])
const secondsPerYear = 60 * 60 * 24 * 365.25
const statusPercentiles = [0, 13, 28, 72, 87]
const statusColors = [
  'rgb(44, 125, 205)',
  'rgb(142, 206, 238)',
  'rgb(231,226,188)',
  'rgb(255, 168, 133)',
  'rgb(205, 35, 63)'
]
const returnPeriodColors = {
  '2': 'rgb(254, 240, 1)',
  '5': 'rgb(253, 154, 1)',
  '10': 'rgb(255, 56, 5)',
  '25': 'rgb(255, 0, 0)',
  '50': 'rgb(128, 0, 106)',
  '100': 'rgb(128, 0, 246)',
}
const months = Array.from({length: 12}).map((_, idx) => (idx + 1).toString().padStart(2, '0'))
const monthNames = months.map(m => new Date(2021, parseInt(m, 10) - 1, 1).toLocaleString(lang, {month: 'short'}))

const experimentalPlotWatermark = [
  {
    text: text.plots.experimentalOverlay,
    xref: "paper",
    yref: "paper",
    x: 0.5,
    y: 0.5,
    showarrow: false,
    font: {
      size: 80,
      color: "rgba(0,0,0,0.25)"
    },
    xanchor: "center",
    yanchor: "middle"
  }
]

//////////////////////////////////////////////////////////////////////// Plots
const returnPeriodShapes = ({rp, x0, x1, maxFlow}) => {
  const visible = maxFlow > rp['2'] ? true : 'legendonly'
  const box = (y0, y1, name) => {
    return {
      x: [x0, x1, x1, x0],
      y: [y0, y0, y1, y1],
      fillcolor: returnPeriodColors[name],
      fill: 'toself',
      line: {width: 0},
      mode: 'lines',
      opacity: 0.5,
      legendgroup: 'returnperiods',
      legendgrouptitle: {text: `${text.words.returnPeriods}`},
      showlegend: true,
      visible: visible,
      name: `${name}: ${rp[name].toFixed(2)} m³/s`,
    }
  }
  return Object
    .keys(rp)
    .map((key, index, array) => {
      const y0 = rp[key]
      const y1 = index === array.length - 1 ? Math.max(rp[key] * 1.15, maxFlow * 1.15) : rp[array[index + 1]]
      return box(y0, y1, key)
    })
    .concat([{legendgroup: 'returnperiods', legendgrouptitle: {text: `${text.words.returnPeriods} m³/s`}}])
}
const plotForecast = ({forecast, rp, riverId, chartDiv}) => {
  chartDiv.innerHTML = ""
  const maxForecast = Math.max(...forecast.stats.median)
  const returnPeriods = returnPeriodShapes({rp, x0: forecast.datetime[0], x1: forecast.datetime[forecast.datetime.length - 1], maxFlow: maxForecast})
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: forecast.datetime.concat(forecast.datetime.slice().toReversed()),
        y: forecast.stats.p20.concat(forecast.stats.p80.slice().toReversed()),
        name: `${text.plots.fcLineUncertainty}`,
        fill: 'toself',
        fillcolor: 'rgba(44,182,255,0.6)',
        line: {color: 'rgba(0,0,0,0)'},
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.stats.p20,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.stats.p80,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.stats.median,
        line: {color: 'black'},
        name: text.plots.fcLineMedian,
        legendgroup: 'forecast',
      },
      // todo: plot bias-corrected forecast if available
      ...(forecast.flow_median_original ? [
        {
          x: forecast.datetime.concat(forecast.datetime.slice().toReversed()),
          y: forecast.flow_uncertainty_lower_original.concat(forecast.flow_uncertainty_upper_original.slice().toReversed()),
          name: text.plots.fcLineUncertaintyOriginal,
          fill: 'toself',
          fillcolor: 'rgba(227,212,9,0.8)',
          line: {color: 'rgba(0,0,0,0)'},
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_uncertainty_lower_original,
          name: '',
          line: {color: 'rgb(255,236,0)'},
          showlegend: false,
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_uncertainty_upper_original,
          name: '',
          line: {color: 'rgb(255,236,0)'},
          showlegend: false,
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_median_original,
          name: text.plots.fcLineMedianOriginal,
          line: {color: 'blue'},
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
      ] : []),
      ...returnPeriods,
    ],
    {
      title: {text: `${text.plots.fcTitle}${riverId}`},
      annotations: forecast.flow_median_original ? experimentalPlotWatermark : [],
      xaxis: {title: {text: `${text.plots.fcXaxis} (UTC +00:00)`}},
      yaxis: {
        title: {text: `${text.plots.fcYaxis} (m³/s)`},
        range: [0, null]
      },
    }
  )
}
const plotForecastMembers = ({forecast, rp, riverId, chartDiv}) => {
  chartDiv.innerHTML = ""
  const memberTraces = forecast.discharge
    .map((memberArray, memberIdx) => {
      const memberNumber = memberIdx + 1
      return {
        x: forecast.datetime,
        y: memberArray,
        name: text.words.ensMembers,
        showlegend: memberNumber === 1,
        type: 'scatter',
        mode: 'lines',
        line: {width: 0.5, color: `rgb(0, 166, 255)`},
        legendgroup: 'forecastmembers',
      }
    })
  // todo: plot bias-corrected forecast if available
  const maxForecast = Math.max(...memberTraces.map(trace => Math.max(...trace.y)))
  const returnPeriods = returnPeriodShapes({rp, x0: forecast.datetime[0], x1: forecast.datetime[forecast.datetime.length - 1], maxFlow: maxForecast})
  Plotly.newPlot(
    chartDiv,
    [...memberTraces, ...returnPeriods,],
    {
      title: {text: `${text.plots.fcMembersTitle}${riverId}`},
      annotations: forecast.ensemble_01_original ? experimentalPlotWatermark : [],  // todo bias corrected members
      xaxis: {title: {text: `${text.plots.fcXaxis} (UTC +00:00)`}},
      yaxis: {
        title: {text: `${text.plots.fcYaxis} (m³/s)`},
        range: [0, null]
      },
      legend: {'orientation': 'h'},
    }
  )
}

const forecastProbabilityTable = ({forecast, rp}) => {
  /*
  forecast: object with structure
    datetime: [Date, Date, ...],
    discharge: [[Number, Number, ...], [Number, Number, ...], ...], // array of arrays, one per ensemble member
    stats: {
      min: [Number, Number, ...],
      p20: [Number, Number, ...],
      p25: [Number, Number, ...],
      median: [Number, Number, ...],
      p75: [Number, Number, ...],
      p80: [Number, Number, ...],
      max: [Number, Number, ...],
      average: [Number, Number, ...],
    }
  rp: object mapping return period strings to discharge values
   */
  // groupby day so that each column is 1 day regardless of the sub time step
  // for each ensemble member in forecast.discharge
  const stepsPerDay = 8
  const totalSteps = forecast.datetime.length
  const arrayDailyBreakPoints = Array.from({length: Math.ceil(totalSteps / stepsPerDay)}, (_, i) => i * stepsPerDay)

  // dailyArrays has shape [numMembers, numberOfDays] where each entry is the daily maximum for that member
  const numMembers = Array.isArray(forecast.discharge) ? forecast.discharge.length : 0
  const dailyArrays = (forecast.discharge || []).map(memberArray => {
    return arrayDailyBreakPoints.map(startIdx => {
      const daySlice = memberArray.slice(startIdx, startIdx + stepsPerDay)
      return daySlice.length ? Math.max(...daySlice) : Number.NEGATIVE_INFINITY
    })
  })

  // Build one column per day using the datetime array (assumes uniform step of 3 hours => 8/day)
  const dailyDateStrings = forecast
    .datetime
    .filter((_, index) => index % stepsPerDay === 0)
    .map(date => new Date(date).toLocaleDateString(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }))

  const headerRow = `<tr><th>${text.words.returnPeriods}</th>${dailyDateStrings.map(date => `<th>${date}</th>`).join('')}</tr>`

  const returnPeriods = ['2', '5', '10', '25', '50', '100']
  const bodyRows = returnPeriods.map(rpKey => {
    const percentages = dailyDateStrings.map((_, index) => {
      const countAboveThreshold = dailyArrays
        .reduce((count, dailyArray) => count + (dailyArray[index] > rp[rpKey] ? 1 : 0), 0)
      return (numMembers ? (countAboveThreshold / numMembers * 100) : 0).toFixed(0)
    })
    return `<tr><td>${rpKey} (${rp[rpKey].toFixed(0)} m³/s)</td>${percentages.map(p => `<td style="background-color: ${returnPeriodColors[rpKey].replace('rgb', 'rgba').replace(')', `, ${p === "0" ? 0 : 0.25 + 0.75 * (p / 100)})`)}">${p}%</td>`).join('')}</tr>`
  })

  return `<table class="forecast-probability-table"><thead>${headerRow}</thead><tbody>${bodyRows.join('')}</tbody></table>`
}

const plotRetrospective = ({daily, monthly, riverId, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: daily.datetime,
        y: daily.discharge,
        type: 'lines',
        name: `${text.words.dailyAverage}`,
      },
      {
        x: Object.keys(monthly),
        y: Object.values(monthly),
        type: 'lines',
        name: `${text.words.monthlyAverage}`,
        line: {color: 'rgb(0, 166, 255)'},
        visible: 'legendonly'
      },
      // todo if there is a key ${river_id}_original, plot it also
      ...(biasCorrected ? [{
        x: daily.datetime,
        y: daily[`${riverId}_original`],
        type: 'lines',
        name: `${text.words.dailyAverageOriginal}`,
        line: {color: 'rgb(255, 0, 0)'},
        visible: 'legendonly'
      }] : [])
    ],
    {
      title: {text: `${text.plots.retroTitle} ${riverId}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      legend: {orientation: 'h', x: 0, y: 1},
      hovermode: 'x',
      yaxis: {
        title: {text: `${text.plots.retroYaxis} (m³/s)`},
        range: [0, null]
      },
      xaxis: {
        title: {text: `${text.plots.retroXaxis} (UTC +00:00)`},
        type: 'date',
        autorange: false,
        range: defaultDateRange,
        rangeslider: {},
        rangeselector: {
          buttons: [
            {
              count: 1,
              label: `1 ${text.words.year}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 5,
              label: `5 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 10,
              label: `10 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 30,
              label: `30 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              label: `${text.words.all}`,
              count: daily.datetime.length,
              step: 'day',
            }
          ]
        },
      }
    }
  )
}
const plotYearlyVolumes = ({yearly, averages, riverId, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: yearly.map(x => x.year),
        y: yearly.map(y => y.value),
        type: 'line',
        name: `${text.words.annualVolume}`,
        marker: {color: 'rgb(0, 166, 255)'}
      },
      ...averages?.map((x, idx) => {
        return {
          x: [x.period, (idx + 1 < averages.length ? averages[idx + 1].period : x.period + 5)],
          y: [x.average, x.average],
          type: 'scatter',
          mode: 'lines',
          legendgroup: `${text.words.fiveYearAverage}`,
          showlegend: idx === 0,
          name: `${text.words.fiveYearAverage}`,
          marker: {color: 'red'},
        }
      }) || []
    ],
    {
      title: {text: `${text.plots.volumeTitle}${riverId}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      legend: {orientation: 'h'},
      hovermode: 'x',
      xaxis: {title: {text: `${text.words.year}`}},
      yaxis: {
        title: {text: `${text.words.millionMetersCubed} (m³ * 10^6)`},
        range: [0, null]
      }
    }
  )
}
const plotStatuses = ({statuses, monthlyAverages, monthlyAverageTimeseries, riverId, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  const years = Array.from(new Set(Object.keys(monthlyAverageTimeseries).map(k => k.split('-')[0]))).sort((a, b) => a - b)

  Plotly.newPlot(
    chartDiv,
    [
      // shaded regions for thresholds based on percentiles
      ...statusColors.map((color, idx) => {
        const label = text.statusLabels[idx]
        const nextLabel = text.statusLabels[idx + 1]
        const lastEntry = idx === text.statusLabels.length - 1
        return {
          x: months.concat(...months.toReversed()),
          y: statuses[label].concat(lastEntry ? Array.from({length: 12}).fill(0) : statuses[nextLabel].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: label,
          line: {width: 0},
          fillcolor: color,
          visible: 'legendonly',
          legendgrouptitle: {text: `${text.words.monthlyStatusCategories}`},
        }
      }),
      // long term or total monthly average
      {
        x: monthlyAverages.map(x => x.month),
        y: monthlyAverages.map(y => y.value),
        mode: 'lines',
        name: `${text.words.monthlyAverageFlows}`,
        visible: true,
        line: {color: 'rgb(0,157,255)', width: 3, dash: 'dash'},
      },
      // each individual year's monthly averages
      ...years.toReversed().map((year, idx) => {
        const values = Object
          .keys(monthlyAverageTimeseries)
          .filter(k => k.startsWith(`${year}-`))
          .map(k => monthlyAverageTimeseries[k])
          .flat()
        return {
          x: months,
          y: values,
          name: `${text.words.year} ${year}`,
          visible: idx === 0 ? true : 'legendonly',
          mode: 'lines',
          line: {width: 2, color: 'black'}
        }
      })
    ],
    {
      title: {text: `${text.plots.statusTitle}${riverId}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      xaxis: {
        title: {text: `${text.words.month}`},
        tickvals: months,
        ticktext: monthNames,
      },
      hovermode: 'x',
      yaxis: {
        title: {text: `${text.words.flow} (m³/s)`},
        range: [0, null]
      },
    }
  )
}
const plotFdc = ({fdc, monthlyFdc, riverId, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: percentiles,
        y: fdc,
        type: 'lines',
        name: `${text.words.flowDurationCurve}`,
      },
      ...Object
        .keys(monthlyFdc)
        .sort()
        .map((m, idx) => {
          return {
            x: percentiles,
            y: monthlyFdc[m],
            type: 'line',
            name: `${text.words.fdc} ${monthNames[idx]}`,
            visible: 'legendonly',
          }
        })
    ],
    {
      title: {text: `${text.plots.fdcTitle}${riverId}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      xaxis: {title: {text: `${text.words.percentile} (%)`}},
      yaxis: {
        title: {text: `${text.words.flow} (m³/s)`},
        range: [0, null]
      },
      legend: {orientation: 'h'},
      hovermode: 'x',
    }
  )
}
const plotYearlyPeaks = ({yearlyPeaks, riverId, chartDiv}) => {
  chartDiv.innerHTML = "";

  const currentYear = new Date().getFullYear();
  yearlyPeaks = yearlyPeaks.filter(p => p.year < currentYear).sort((a, b) => a.year - b.year);

  const formatVal = val => {
    if (val >= 1000) return `${Math.round((val / 1000) * 10) / 10}k`;
    if (val === 0) return "0";
    const magnitude = Math.floor(Math.log10(Math.abs(val)));
    const factor = 10 ** (magnitude - 2);
    return Math.round(val / factor) * factor;
  };

  // --- Circular logic for outlier detection ---
  const angles = yearlyPeaks.map(d => (2 * Math.PI * (d.doy - 1)) / 365);
  const circDist = (a1, a2) => Math.min(Math.abs(a1 - a2), 2 * Math.PI - Math.abs(a1 - a2));

  // Compute circular median angle
  const circMedian = arr => arr.reduce((best, a) => {
    const total = arr.reduce((sum, x) => sum + circDist(x, a), 0);
    return total < best.dist ? {ang: a, dist: total} : best;
  }, {ang: 0, dist: Infinity}).ang;
  const medianAngle = circMedian(angles);
  const medianDoy = Math.round((medianAngle / (2 * Math.PI)) * 365) + 1;

  // Distances from median
  const distancesDays = angles.map(a => circDist(a, medianAngle) * (365 / (2 * Math.PI)));
  const sorted = [...distancesDays].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const threshold = q3 + 1.5 * iqr;

  // Identify outliers - iqr rule and more than 30 days from median
  const outlierIndices = distancesDays
    .map((d, i) => (d > threshold && d > 30 ? i : -1))
    .filter(i => i !== -1);
  const outliers = outlierIndices.map(i => yearlyPeaks[i]);
  const normalPoints = yearlyPeaks.filter((_, i) => !outlierIndices.includes(i));

  // --- Bins + color setup ---
  const peaks = yearlyPeaks.map(p => p.peak);
  const minVal = Math.min(...peaks);
  const maxVal = Math.max(...peaks);
  const nBins = 5;
  const viridis = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
  const traces = [];

  // --- Build bin traces ---
  for (let i = 0; i < nBins; i++) {
    const lower = minVal + (i * (maxVal - minVal)) / nBins;
    const upper = minVal + ((i + 1) * (maxVal - minVal)) / nBins;
    const inBin = p => p.peak >= lower && p.peak < upper;

    const binPoints = normalPoints.filter(inBin);
    const outlierBinPoints = outliers.filter(inBin);
    const allPoints = [...binPoints, ...outlierBinPoints];

    if (allPoints.length) {
      const legendgroup = `bin-${i}`;
      traces.push({
        name: `${formatVal(lower)}–${formatVal(upper)} m³/s`,
        legendgroup,
        x: allPoints.map(p => p.doy),
        y: allPoints.map(p => p.year),
        mode: "markers",
        type: "scatter",
        marker: {size: 9, color: viridis[i], line: {width: 0}},
        text: allPoints.map(
          p => `${text.words.year}: ${p.year}<br>${text.words.date}: ${p.date}<br>${text.words.discharge}: ${formatVal(p.peak)} m³/s`
        ),
        showlegend: true,
      });

      // Red outline
      if (outlierBinPoints.length)
        traces.push({
          legendgroup,
          showlegend: false,
          x: outlierBinPoints.map(p => p.doy),
          y: outlierBinPoints.map(p => p.year),
          mode: "markers",
          type: "scatter",
          marker: {size: 15, color: "rgba(0,0,0,0)", line: {color: "red", width: 2}},
          hoverinfo: "skip",
        });
    }
  }

  // --- legend symbol for red outlier rings ---
  traces.push({
    name: `${text.words.temporalOutliers}`,
    x: [null],
    y: [null],
    mode: "markers",
    type: "scatter",
    marker: {size: 15, color: "rgba(0,0,0,0)", line: {color: "red", width: 2}},
    hoverinfo: "skip",
    showlegend: true,
  });

  // --- Median DOY line ---
  const minYear = Math.min(...yearlyPeaks.map(p => p.year));
  const maxYear = Math.max(...yearlyPeaks.map(p => p.year));
  traces.push({
    x: [medianDoy, medianDoy],
    y: [minYear - 1, maxYear + 1],
    mode: "lines",
    line: {dash: "dash", width: 1, color: "black"},
    hoverinfo: "none",
    name: `${text.words.medianDOY}`,
    showlegend: true,
  });

  const monthNames = Array.from({length: 12}, (_, i) =>
    new Date(Date.UTC(2023, i, 1)).toLocaleString(lang, {month: "short", timeZone: "UTC"})
  );
  const monthStarts = monthNames.map((_, i) => Math.floor((Date.UTC(2023, i, 1) - Date.UTC(2023, 0, 0)) / 86400000) + 1);

  const layout = {
    uirevision: "peaks-locked",
    title: {text: `${text.plots.peaksTitle}${riverId}`, x: 0.5},
    xaxis: {
      title: {text: text.plots.peaksXaxis},
      tickmode: "array",
      tickvals: monthStarts,
      ticktext: monthNames,
      autorange: false,
      range: [1, 366],
      fixedrange: true,
    },
    yaxis: {
      title: {text: text.words.year},
      autorange: false,
      range: [minYear - 1, maxYear + 1],
      fixedrange: true,
    },
    height: 560,
    margin: {t: 80, l: 80, r: 180, b: 70},
    legend: {
      x: 1.05,
      y: 1,
      bgcolor: "rgba(255,255,255,0)",
      bordercolor: "rgba(0,0,0,0)",
      title: {text: `${text.words.peakDischarge} (m³/s)`},
    },
  };

  const config = {
    displaylogo: false,
    doubleClick: false,
    scrollZoom: false,
    responsive: true,
  };

  Plotly.newPlot(chartDiv, traces, layout, config);
}
const plotRasterHydrograph = ({retro, riverId, chartDiv}) => {
  chartDiv.innerHTML = "";

  // --- Helper functions ---
  const formatVal = v =>
    v == null ? null :
      v >= 1000 ? `${Math.round((v / 1000) * 10) / 10}k` :
        v === 0 ? "0" :
          (() => {
            const m = Math.floor(Math.log10(Math.abs(v)));
            const f = 10 ** (m - 2);
            return Math.round(v / f) * f;
          })();

  // --- Preprocess data into (year, doy, flow) ---
  const firstYear = retro.datetime[0].getUTCFullYear();
  const lastYear = retro.datetime[retro.datetime.length - 1].getUTCFullYear();
  const nYears = lastYear + 1 - firstYear;
  const yYears = Array.from({length: nYears}, (_, i) => firstYear + i)
  const xDays = Array.from({length: 366}, (_, i) => i + 1)
  const zValues = Array.from({length: nYears}, () => Array.from({length: 366}, () => null));
  // get a list of all 366 possible days in month-day format then for each year, create a label list
  const allDays = Array.from({length: 366}, (_, i) => {
    const d = new Date(Date.UTC(2023, 0, i + 1));
    return `${d.toLocaleString(lang, {month: "short", timeZone: "UTC"})} ${d.getUTCDate()}`;
  });
  const hoverLabelData = yYears.map(year => {
    return allDays.map(date => {
      return {year, date}
    });
  });

  let currentYear = firstYear;
  let yearIdx = 0;
  let doyIdx = 0;
  retro.datetime.forEach((date, idx) => {
    const year = date.getUTCFullYear();
    if (year !== currentYear) {
      currentYear = year;
      doyIdx = 0;
      yearIdx += 1;
    } else {
      doyIdx += 1;
    }
    zValues[yearIdx][doyIdx] = retro.discharge[idx];
  });

  // --- Data range + bin setup ---
  const valsFlat = zValues.flat()
  const vmin = Math.min(...valsFlat);
  const vmax = Math.max(...valsFlat);
  const nBins = 7;
  const viridis = ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#bddf26", "#fde725"];
  const binEdges = Array.from({length: nBins + 1}, (_, i) => vmin + (i * (vmax - vmin)) / nBins);
  const colorscale = binEdges.slice(0, -1).flatMap((_, i) => {
    const p = i / nBins, c = viridis[i];
    return [[p, c], [(i + 1) / nBins, c]];
  });

  // --- Map values to bin midpoints ---
  const binMid = binEdges.map((v, i) => (v + binEdges[i + 1]) / 2).slice(0, -1);
  // const binnedMatrix = dataMatrix.map(r =>
  //   r.map(v => v == null ? null : binMid.find((_, i) => v <= binEdges[i + 1]) ?? binMid.at(-1))
  // );
  const binnedMatrix = zValues.map(row => {
    return row.map(v => v == null ? null : binMid.find((_, i) => v <= binEdges[i + 1]) ?? binMid.at(-1))
  })

  // const months = Array.from({length: 12}, (_, i) =>
  //   new Date(Date.UTC(2023, i, 1)).toLocaleString(lang, {month: "short", timeZone: "UTC"})
  // );
  // const monthStarts = months.map((_, i) =>
  //   Math.floor((Date.UTC(2023, i, 1) - Date.UTC(2023, 0, 0)) / 86400000) + 1
  // );

  Plotly.newPlot(chartDiv, [{
    z: binnedMatrix,
    x: xDays,
    y: yYears,
    type: "heatmap",
    colorscale,
    zmin: vmin,
    zmax: vmax,
    customdata: hoverLabelData,
    hovertemplate:
      `${text.words.year}: %{y}<br>${text.words.date}: %{customdata.date}<br>${text.words.discharge}: %{customdata.flow} m³/s`,
    colorbar: {
      title: {text: `${text.words.discharge} (m³/s)`, side: "top"},
      tickvals: binMid,
      ticktext: binMid.map((v, i) => `${formatVal(binEdges[i])}–${formatVal(binEdges[i + 1])}`)
    },
    hoverinfo: "skip"
  }], {
    title: {text: `${text.plots.heatMapTitle}${riverId}`, x: 0.5},
    // xaxis: {title: text.plots.heatMapXaxis, tickmode: "array", tickvals: monthStarts, ticktext: months, side: "bottom", fixedrange: true},
    xaxis: {title: text.plots.heatMapXaxis, side: "bottom", fixedrange: true},
    yaxis: {title: text.words.year, fixedrange: true},
    margin: {t: 80, l: 80, r: 80, b: 70},
    height: 560
  });
};
const plotCumulativeVolumes = ({retro, riverId, chartDiv}) => {
  chartDiv.innerHTML = "";

  const daily = retro.datetime.map((currentValue, currentIndex) => {
    const d = new Date(currentValue);
    const year = d.getUTCFullYear();
    const doy = Math.floor((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000);

    const flow = retro.discharge[currentIndex];
    const volume_m3 = flow * 86400;
    return {year, doy, volume_m3};
  });

  const currentYear = new Date().getUTCFullYear();
  const filtered = daily.filter(d => d.year < currentYear);

  const cumulative = {};
  filtered.forEach(d => {
    if (!cumulative[d.year]) cumulative[d.year] = [];
    const prev = cumulative[d.year].length
      ? cumulative[d.year][cumulative[d.year].length - 1].cum
      : 0;
    cumulative[d.year].push({doy: d.doy, cum: prev + d.volume_m3});
  });

  const totals = Object.entries(cumulative).map(([year, arr]) => ({
    year: +year,
    total: arr[arr.length - 1].cum
  }));

  const sortedTotals = [...totals].sort((a, b) => a.total - b.total);
  const driestYear = sortedTotals[0].year;
  const wettestYear = sortedTotals[sortedTotals.length - 1].year;
  const medianYear = sortedTotals[Math.floor(sortedTotals.length / 2)].year;

  // compute mean cumulative curve
  const doys = Array.from({length: 365}, (_, i) => i + 1);
  const meanCumulative = doys.map(doy => {
    const vals = Object.values(cumulative)
      .map(yearArr => {
        const day = yearArr.find(x => x.doy === doy);
        return day ? day.cum : null;
      })
      .filter(v => v !== null);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return {doy, mean};
  }).filter(p => p.mean !== null);

  const traces = [];

  Object.entries(cumulative).forEach(([year, arr]) => {
    traces.push({
      x: arr.map(p => p.doy),
      y: arr.map(p => p.cum / 1e6),
      mode: "lines",
      line: {color: "lightgray", width: 0.8},
      name: year,
      hoverinfo: `${text.words.year}: ${year}`,
      showlegend: false,
    });
  });

  const highlightYear = (year, color, label) => {
    const arr = cumulative[year];
    traces.push({
      x: arr.map(p => p.doy),
      y: arr.map(p => p.cum / 1e6),
      mode: "lines",
      line: {color, width: 2},
      name: label,
      hoverinfo: `${text.words.year}: ${year}`,
      showlegend: true,
    });
  };

  highlightYear(wettestYear, "blue", `${text.words.wettestYear}: ${wettestYear}`);
  highlightYear(driestYear, "red", `${text.words.driestYear}: ${driestYear}`);
  highlightYear(medianYear, "green", `${text.words.medianYear}: ${medianYear}`);

  traces.push({
    x: meanCumulative.map(p => p.doy),
    y: meanCumulative.map(p => p.mean / 1e6),
    mode: "lines",
    line: {color: "black", width: 2.5},
    name: text.words.average,
    hoverinfo: "skip",
    showlegend: true,
  });

  const months = Array.from({length: 12}, (_, i) =>
    new Date(Date.UTC(2023, i, 1)).toLocaleString(lang, {month: "short", timeZone: "UTC"})
  );
  const monthStarts = months.map((_, i) =>
    Math.floor((Date.UTC(2023, i, 1) - Date.UTC(2023, 0, 0)) / 86400000) + 1
  );

  const layout = {
    title: {text: `${text.plots.cumVolumeTitle}` + riverId},
    xaxis: {
      title: {text: text.words.months},
      tickmode: "array",
      tickvals: monthStarts,
      ticktext: monthNames,
      range: [1, 366],
      fixedrange: false,
    },
    yaxis: {
      title: {text: text.plots.cumVolumeYaxis},
    },
    legend: {
      x: 1.05,
      y: 1,
      bgcolor: "rgba(255,255,255,0)",
      bordercolor: "rgba(0,0,0,0)",
    },
    height: 560,
    margin: {t: 80, l: 80, r: 180, b: 70},
    grid: {rows: 1, columns: 1},
  };

  const config = {
    displaylogo: false,
    doubleClick: false,
    scrollZoom: true,
    responsive: true,
  };
  Plotly.newPlot(chartDiv, traces, layout, config);
};

//////////////////////////////////////////////////////////////////////// Helper Functions
const clearCharts = chartTypes => {
  if (chartTypes === "forecast" || chartTypes === null || chartTypes === undefined) {
    [divChartForecast, divTableForecast]
      .forEach(el => el.innerHTML = '')
  }
  if (chartTypes === "retro" || chartTypes === null || chartTypes === undefined) {
    [divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc, divYearlyPeaks, divRasterHydrograph, divCumulativeVolume]
      .forEach(el => el.innerHTML = '')
  }
}
//////////////////////////////////////////////////////////////////////// Plotting Managers
const plotAllRetro = ({retro, riverId}) => {
  /*
  retro: object with structure
    datetime: [Date, Date, ...],
    discharge: [Number, Number, ...],
  riverId: Number (integer)
   */
  let monthlyAverages = []
  let yearlyVolumes = []
  let monthlyAverageTimeseries = {}
  let monthlyFdc = {}
  let monthlyStatusValues = {}
  let yearlyPeaks = {}
  text.statusLabels.forEach(label => monthlyStatusValues[label] = [])
  const biasCorrected = retro.hasOwnProperty(`${riverId}_original`)

  // Get subsets of data with the same YYYY-MM timestamp
  let monthlyValues = retro.datetime.reduce((acc, currentValue, currentIndex) => {
    const date = new Date(currentValue)
    const datestring = date.toISOString().slice(0, 7)
    if (!acc[datestring]) acc[datestring] = []
    acc[datestring].push(retro.discharge[currentIndex])
    return acc
  }, {})
  const fdc = sortedArrayToPercentiles(retro.discharge.toSorted((a, b) => a - b))
  const years = Array.from(new Set(Object.keys(monthlyValues).map(k => k.split('-')[0]))).sort((a, b) => a - b)

  // Calculate yearly discharge peaks.
  const dateToDoy = date => {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date - start
    return Math.floor(diff / 86400000)
  }
  retro.datetime.forEach((currentValue, currentIndex) => {
    const doy = dateToDoy(currentValue)
    const value = retro.discharge[currentIndex]
    const year = currentValue.getUTCFullYear()

    // store max per year with its day of year
    if (!yearlyPeaks[year] || value > yearlyPeaks[year].peak) {
      yearlyPeaks[year] = {year, date: currentValue, doy, peak: value}
    }
  })

  // convert to array
  yearlyPeaks = Object.values(yearlyPeaks).sort((a, b) => a.year - b.year)

  // Calculate monthly averages from the monthly values. Minimum 20 values to calculate a monthly average.
  Object
    .keys(monthlyValues)
    .forEach(k => {
      if (monthlyValues[k].length < 20) {
        delete monthlyValues[k]
        return
      }
      monthlyAverageTimeseries[k] = monthlyValues[k].reduce((a, b) => a + b, 0) / monthlyValues[k].length
    })
  months
    .forEach(month => {
      const values = Object.keys(monthlyValues).filter(k => k.endsWith(`-${month}`)).map(k => monthlyValues[k]).flat().sort((a, b) => b - a)
      statusPercentiles.forEach((percentile, idx) => {
        monthlyStatusValues[Object.keys(monthlyStatusValues)[idx]].push(values[Math.floor(values.length * percentile / 100)])
      })
      monthlyAverages.push({month, value: values.reduce((a, b) => a + b, 0) / values.length})
      monthlyFdc[month] = sortedArrayToPercentiles(values.toReversed())
    })
  years
    .forEach(year => {
      const yearValues = Object.keys(monthlyAverageTimeseries).filter(k => k.startsWith(`${year}-`)).map(k => monthlyAverageTimeseries[k])
      if (yearValues.length === 12) yearlyVolumes.push({year, value: yearValues.reduce((a, b) => a + b, 0) / 12 * secondsPerYear / 1e6})
    })
  const fiveYearlyAverages = yearlyVolumes
    .reduce((acc, {year, value}) => {
      const period = Math.floor(year / 5) * 5
      let group = acc.find(g => g.period === period)
      if (!group) {
        group = {period, total: 0, count: 0}
        acc.push(group)
      }
      group.total += value
      group.count += 1
      return acc
    }, [])
    .map(({period, total, count}) => ({
      period,
      average: total / count
    }))

  plotRetrospective({daily: retro, monthly: monthlyAverageTimeseries, riverId, chartDiv: divChartRetro, biasCorrected})
  plotYearlyVolumes({yearly: yearlyVolumes, averages: fiveYearlyAverages, riverId, chartDiv: divChartYearlyVol, biasCorrected})
  plotYearlyPeaks({yearlyPeaks, riverId, chartDiv: divYearlyPeaks})
  plotStatuses({statuses: monthlyStatusValues, monthlyAverages, monthlyAverageTimeseries, riverId, chartDiv: divChartStatus, biasCorrected})
  plotRasterHydrograph({retro, riverId, chartDiv: divRasterHydrograph})
  plotCumulativeVolumes({retro, riverId, chartDiv: divCumulativeVolume})
  plotFdc({fdc, monthlyFdc, riverId, chartDiv: divChartFdc, biasCorrected})
}
const plotAllForecast = ({forecast, rp, riverId, showStats}) => {
  showStats ? plotForecast({forecast, rp, riverId, chartDiv: divChartForecast}) : plotForecastMembers({forecast, rp, riverId, chartDiv: divChartForecast})
  divTableForecast.innerHTML = forecastProbabilityTable({forecast, rp})
}

//////////////////////////////////////////////////////////////////////// Event Listeners
window.addEventListener('resize', () => [divChartForecast, divChartRetro, divChartYearlyVol, divYearlyPeaks, divChartStatus, divRasterHydrograph, divCumulativeVolume, divChartFdc].forEach(chart => Plotly.Plots.resize(chart)))

export {plotAllRetro, plotAllForecast, clearCharts}
