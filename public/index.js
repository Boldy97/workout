$(document).ready(init);

let name = null;
const actions = [];
let status = {};
let registration;

async function init() {
  setDefaultValues();
  setInterval(update, 1000);
  update(true);
  registration = await registerServiceWorker();
  await requestNotificationPermission();
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('service.js');
  registration.active.postMessage('hello world');
  return registration;
}

async function requestNotificationPermission() {
  const permission = await window.Notification.requestPermission();
  if(permission !== 'granted') {
    throw new Error('Permission not granted for Notification');
  }
}

function showLocalNotification(title, body, swRegistration) {
  const options = { body };
  registration.showNotification(title, options);
}

async function setDefaultValues() {
  name = window.localStorage.getItem('name');
  if(name) {
    $('#input-name').val(name);
  }
  $('#input-multiplier').val(1);
}

async function update(skipNotification) {
  const hasNewData = await fetchStatus();
  if(hasNewData && !skipNotification) {
    const action = actions[actions.length-1];
    console.log(action);
    registration.showNotification(`A new rep was logged by ${action.name}!`, {
      body: getDescriptionForAction(action)
    });
  }
  await updateView(hasNewData);
}

async function fetchStatus() {
  const cutoff = actions.length ? actions[actions.length-1].time : null;
  let status_ = await $.get(`/api/status?time=${cutoff}`, null);
  actions.push(...status_.actions);
  status = status_;
  return !!status_.actions.length;
}

async function updateView(hasNewData) {
  await updateViewShowHide();
  await updateViewLastAction();
  await updateViewPoints();
  await updateViewGraph(hasNewData);
}

async function updateViewShowHide() {
  $('#name-select')[name?'hide':'show']();
  $('#chart')[name && !isLeader(name)?'show':'hide']();
  $('#last-action')[name?'show':'hide']();
  $('#points')[(name && !isLeader(name))?'show':'hide']();
  $('#new-action')[name?'show':'hide']();
}

async function updateViewLastAction() {
  const action = actions[actions.length-1];
  if(!action) return;
  $('#last-action-name').text(action.name);
  const description = getDescriptionForAction(action);
  $('#last-action-description').text(description);
  $('#last-action-time-day').text(new Date(action.time).toLocaleDateString());
  $('#last-action-time-time').text(new Date(action.time).toLocaleTimeString());
}

async function updateViewPoints() {
  let combinedCount = 0;
  for(let name of Object.keys(status.pointsByName)) {
    const count = status.pointsByName[name];
    updateViewPointsRow(name, count);
    if(!isLeader(name)) {
      combinedCount += count;
    }
  }
  updateViewPointsRow('Combined', combinedCount);
}

async function updateViewPointsRow(name, count) {
  let $row = $(`#points-${name}`);
  if($row.length) {
    $row.find('td:last').text(count);
    return;
  }
  let content = $(`<tr id="points-${name}">
    <td>${name}</td>
    <td>${count}</td>
  </tr>`);
  $('#points').append(content);
}

async function updateViewGraph(hasNewData) {
  if(!hasNewData) {
    return;
  }
  nv.addGraph(function() {
    var chart = nv.models.lineChart()
        .useInteractiveGuideline(true)
        .x(function(d) { return d.time })
        .y(function(d) { return d.cumulativeCount })
        .color(d3.scale.category10().range());

    chart.xAxis.tickFormat(function(d) {
      return d3.time.format('%Y-%m-%d')(new Date(d))
    });

    d3.select('#chart svg')
        .datum(getChartData())
        .call(chart);

    nv.utils.windowResize(chart.update);

    return chart;
  });
}

async function selectName() {
  name = $('#name-select-dropdown').val();
  window.localStorage.setItem('name', name);
  updateView();
}

async function submit() {
  window.localStorage.setItem('name', name);
  await $.ajax({
    type: 'POST',
    url: '/api/action',
    data: JSON.stringify({
      name: name,
      type: $('#input-type').val(),
      count: +$('#input-count').val(),
      multiplier: +$('#input-multiplier').val(),
    }),
    contentType: 'application/json',
    dataType: 'json'
  });
  await update();
}

// utility

function isLeader(name) {
  return status.players.find(player => player.name === name).leader;
}

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function getDescriptionForAction(action) {
  return (action.multiplier !== 1 ? `${action.multiplier}x` : '') + `${action.count} ${action.type}`;
}

function getChartData() {
  const result = [];
  const combined = {
    key: 'Combined',
    values: []
  };
  for(let name of Object.keys(status.actionCountsByName)) {
    const actionCounts = status.actionCountsByName[name];
    result.push({
      key: name,
      values: actionCounts
    });
    if(!isLeader(name)) {
      mergeData(combined.values, actionCounts);
    }
  }
  result.push(combined);
  return result;
}

function mergeData(target, source) {
  source = clone(source);
  if(!target.length) {
    target.push(...source);
    return;
  }
  for(let i in source) {
    let found = false;
    for(let j in target) {
      if(source[i].date === target[j].date) {
        found = true;
        for(let k=j;k<target.length;k++) {
          target[k].cumulativeCount += source[i].count;
        }
        break;
      }
    }
    if(!found) {
      source[i].cumulativeCount = target[target.length-1].cumulativeCount + source[i].count;
      target.push(source[i]);
    }
  }
}
