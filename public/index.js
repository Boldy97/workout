$(document).ready(init);

let name = null;
const actions = [];
let status = {};

function init() {
  setDefaultValues();
  setInterval(update, 1000);
  update();
}

async function setDefaultValues() {
  name = window.localStorage.getItem('name');
  if(name) {
    $('#input-name').val(name);
  }
  $('#input-multiplier').val(1);
}

async function update() {
  const hasNewData = await fetchStatus();
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
  //$('#chart')[name?'show':'hide']();
  $('#last-action')[name?'show':'hide']();
  $('#points')[(name && !isLeader(name))?'show':'hide']();
  $('#new-action')[name?'show':'hide']();
}

async function updateViewLastAction() {
  const action = actions[actions.length-1];
  if(!action) return;
  $('#last-action-name').text(action.name);
  const description = (action.multiplier !== 1 ? `${action.multiplier}x` : '') + `${action.count} ${action.type}`;
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
    var chart = nv.models.cumulativeLineChart()
        .useInteractiveGuideline(true)
        .x(function(d) { return d.time })
        .y(function(d) { return d.cumulativeCount })
        .color(d3.scale.category10().range())
        .duration(300)
        .clipVoronoi(false);

    chart.xAxis.tickFormat(function(d) {
      return d3.time.format('%Y-%m-%d')(new Date(d))
    });

    d3.select('#chart svg')
        .datum(getChartData())
        .call(chart);

    //TODO: Figure out a good way to do this automatically
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

function getChartData() {
  const result = [];
  for(let name of Object.keys(status.actionCountsByName)) {
    const actionCounts = status.actionCountsByName[name];
    result.push({
      key: name,
      values: actionCounts
    });
  }
  // TODO combined
  return result;
}
