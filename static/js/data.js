const REST_ENDPOINT = "https://api.riverforecastsystem.com/v2"

const convertTimeArray = data => {
  const step = data.timeUnit.split(" since ")[0]
  const converter = {
    seconds: 1,
    minutes: 60,
    hours: 3600,
    days: 86400
  }[step]
  data.time = data.time.map(t => {
    const originDate = new Date(data.timeUnit.split(" since ")[1])
    originDate.setSeconds(originDate.getSeconds() + (t * converter))
    return originDate.toISOString()
  })
  return data
}

const fetchForecastPromise = ({riverid, date}) => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecast/stats/${riverid}?date=${date}`)
      .then(response => response.json())
      .then(data => convertTimeArray(data))
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchReturnPeriodsPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/return-periods/logpearson3/${riverid}`)
      .then(response => response.json())
      .then(data => {
        const returnPeriods = {}
        data.return_periods.forEach((rp, i) => returnPeriods[rp] = data.q[i])
        return returnPeriods
      })
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchRetroPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/retrospective/daily/${riverid}`)
      .then(response => response.json())
      .then(data => convertTimeArray(data))
      .then(response => resolve(response))
      .catch(() => reject())
  })
}

const updateDownloadLinks = riverid => {
  const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/stats/${riverid}` : ""
  const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/daily/${riverid}` : ""
  document.getElementById("download-forecast-link").href = hrefForecast
  document.getElementById("download-retrospective-link").href = hrefRetro
  document.getElementById("download-forecast-btn").disabled = !riverid
  document.getElementById("download-retrospective-btn").disabled = !riverid
}

export {fetchForecastPromise, fetchReturnPeriodsPromise, fetchRetroPromise, updateDownloadLinks}