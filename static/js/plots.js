import {divChartForecast, divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc, lang} from './ui.js'

//////////////////////////////////////////////////////////////////////// Constants and configs
const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
const percentiles = Array.from({length: 51}, (_, i) => i * 2)
const sortedArrayToPercentiles = array => percentiles.toReversed().map(p => array[Math.floor(array.length * p / 100) - (p === 100 ? 1 : 0)])
const secondsPerYear = 60 * 60 * 24 * 365.25
const statusPercentiles = [0, 13, 28, 72, 87]
const statusColors = ['rgb(44, 125, 205)', 'rgb(142, 206, 238)', 'rgb(231,226,188)', 'rgb(255, 168, 133)', 'rgb(205, 35, 63)']

const months = Array.from({length: 12}).map((_, idx) => (idx + 1).toString().padStart(2, '0'))
const monthNames = months.map(m => new Date(2021, parseInt(m, 10) - 1, 1).toLocaleString(lang, {month: 'short'}))

//////////////////////////////////////////////////////////////////////// Plots
const returnPeriodShapes = ({rp, x0, x1, maxFlow}) => {
  const returnPeriodColors = {
    '2': 'rgb(254, 240, 1)',
    '5': 'rgb(253, 154, 1)',
    '10': 'rgb(255, 56, 5)',
    '25': 'rgb(255, 0, 0)',
    '50': 'rgb(128, 0, 106)',
    '100': 'rgb(128, 0, 246)',
  }
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
      legendgrouptitle: {text: `${text.words.returnPeriods} m³/s`},
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
const plotForecast = ({forecast, rp, riverid, chartDiv}) => {
  chartDiv.innerHTML = ""
  const maxForecast = Math.max(...forecast.q)
  const returnPeriods = returnPeriodShapes({rp, x0: forecast.time[0], x1: forecast.time[forecast.time.length - 1], maxFlow: maxForecast})
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: forecast.time.concat(forecast.time.slice().toReversed()),
        y: forecast.q_uncertainty_lower.concat(forecast.q_uncertainty_upper.slice().toReversed()),
        name: `${text.plots.fcLineUncertainty}`,
        fill: 'toself',
        fillcolor: 'rgba(44,182,255,0.6)',
        line: {color: 'rgba(0,0,0,0)'}
      },
      {
        x: forecast.time,
        y: forecast.q_uncertainty_lower,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
      },
      {
        x: forecast.time,
        y: forecast.q_uncertainty_upper,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
      },
      {
        x: forecast.time,
        y: forecast.q,
        name: `${text.plots.fcLineMedian}`,
        line: {color: 'black'}
      },
      ...returnPeriods,
    ],
    {
      title: `${text.plots.fcTitle}${riverid}`,
      xaxis: {title: `${text.plots.fcXaxis} (UTC +00:00)`},
      yaxis: {
        title: `${text.plots.fcYaxis} (m³/s)`,
        range: [0, null]
      },
      legend: {'orientation': 'h'},
    }
  )
}
const plotRetrospective = ({daily, monthly, riverid, chartDiv}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: daily.time,
        y: daily.q,
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
      }
    ],
    {
      title: `${text.plots.retroTitle} ${riverid}`,
      legend: {orientation: 'h', x: 0, y: 1},
      hovermode: 'x',
      yaxis: {
        title: `${text.plots.retroYaxis} (m³/s)`,
        range: [0, null]
      },
      xaxis: {
        title: `${text.plots.retroXaxis} (UTC +00:00)`,
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
              count: daily.time.length,
              step: 'day',
            }
          ]
        },
      }
    }
  )
}
const plotYearlyVolumes = ({yearly, averages, riverid, chartDiv}) => {
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
      title: `${text.plots.volumeTitle}${riverid}`,
      legend: {orientation: 'h'},
      hovermode: 'x',
      xaxis: {title: `${text.words.year}`},
      yaxis: {
        title: `${text.words.millionMetersCubed} (m³ * 10^6)`,
        range: [0, null]
      }
    }
  )

}
const plotStatuses = ({statuses, monthlyAverages, monthlyAverageTimeseries, riverid, chartDiv}) => {
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
          legendgroup: `${text.words.monthlyStatusCategories}`,
          legendgrouptitle: {text: `${text.words.monthlyStatusCategories}`},
        }
      }),
      // long term or total monthly average
      {
        x: monthlyAverages.map(x => x.month),
        y: monthlyAverages.map(y => y.value),
        mode: 'lines',
        name: `${text.words.monthlyAverageFlows}`,
        visible: 'legendonly',
        line: {color: 'rgb(0,0,0)', width: 3},
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
      title: `${text.plots.statusTitle}${riverid}`,
      xaxis: {
        title: `${text.words.month}`,
        tickvals: months,
        ticktext: monthNames,
      },
      hovermode: 'x',
      yaxis: {
        title: `${text.words.flow} (m³/s)`,
        range: [0, null]
      },
    }
  )
}
const plotFdc = ({fdc, monthlyFdc, riverid, chartDiv}) => {
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
          }
        })
    ],
    {
      title: `${text.plots.fdcTitle}${riverid}`,
      xaxis: {title: `${text.words.percentile} (%)`},
      yaxis: {
        title: `${text.words.flow} (m³/s)`,
        range: [0, null]
      },
      legend: {orientation: 'h'},
      hovermode: 'x',
    }
  )
}

//////////////////////////////////////////////////////////////////////// Helper Functions
const clearCharts = chartTypes => {
  if (chartTypes === "forecast" || chartTypes === null) {
    [divChartForecast,]
      .forEach(el => el.innerHTML = '')
  }
  if (chartTypes === "retrospective" || chartTypes === null) {
    [divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc]
      .forEach(el => el.innerHTML = '')
  }
}

//////////////////////////////////////////////////////////////////////// Plotting Managers
const plotAllRetro = ({retro, riverid}) => {
  let monthlyAverages = []
  let yearlyVolumes = []
  let monthlyAverageTimeseries = {}
  let monthlyFdc = {}
  let monthlyStatusValues = {}
  text.statusLabels.forEach(label => monthlyStatusValues[label] = [])

  let monthlyValues = retro.time.reduce((acc, currentValue, currentIndex) => {
    const date = new Date(currentValue)
    const datestring = date.toISOString().slice(0, 7)
    if (!acc[datestring]) acc[datestring] = []
    acc[datestring].push(retro.q[currentIndex])
    return acc
  }, {})
  const fdc = sortedArrayToPercentiles(retro.q.toSorted((a, b) => a - b))
  const years = Array.from(new Set(Object.keys(monthlyValues).map(k => k.split('-')[0]))).sort((a, b) => a - b)

  Object
    .keys(monthlyValues)
    .forEach(k => monthlyAverageTimeseries[k] = monthlyValues[k].reduce((a, b) => a + b, 0) / monthlyValues[k].length)
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

  plotRetrospective({daily: retro, monthly: monthlyAverageTimeseries, riverid, chartDiv: divChartRetro})
  plotYearlyVolumes({yearly: yearlyVolumes, averages: fiveYearlyAverages, riverid, chartDiv: divChartYearlyVol})
  plotStatuses({statuses: monthlyStatusValues, monthlyAverages, monthlyAverageTimeseries, riverid, chartDiv: divChartStatus})
  plotFdc({fdc, monthlyFdc, riverid, chartDiv: divChartFdc})
}
const plotAllForecast = ({forecast, rp, riverid}) => {
  plotForecast({forecast, rp, riverid, chartDiv: divChartForecast})
}

//////////////////////////////////////////////////////////////////////// Event Listeners
window.addEventListener('resize', () => [divChartForecast, divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc].forEach(chart => Plotly.Plots.resize(chart)))

export {plotAllRetro, plotAllForecast, clearCharts}
