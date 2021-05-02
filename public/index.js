$(document).ready(init);

const actions = [];
let points = {};

function init() {
  setDefaultValues();
  setInterval(update, 1000);
  update();
}

async function setDefaultValues() {
  const name = window.localStorage.getItem('name');
  if(name) {
    $('#input-name').val(name);
  }
  $('#input-multiplier').val(1);
}

async function update() {
  await fetchStatus();
  updateView();
}

async function fetchStatus() {
  const cutoff = actions.length ? actions[actions.length-1].time : null;
  let status = await $.get(`/api/status?time=${cutoff}`, null);
  actions.push(...status.actions);
  points = status.points;
}

function updateView() {
  const action = actions[actions.length-1];
  if(!action) return;

  $('#last-action-name').text(action.name);

  const description = (action.multiplier !== 1 ? `${action.multiplier}x` : '') + `${action.count} ${action.type}`;
  $('#last-action-description').text(description);

  const timeLeft = Math.floor((action.timeVictory - Date.now()) / 1000);
  let timer = '--:--';
  if(timeLeft > 0) {
    const timeMinutes = ('0' + Math.floor(timeLeft /  60)).slice(-2);
    const timeSeconds = ('0' + timeLeft % 60).slice(-2);
    timer = `${timeMinutes}:${timeSeconds}`;
  }
  $('#last-action-timer').text(timer);

  for(let name of Object.keys(points)) {
    let $row = $(`#points-${name}`);
    if(!$row.length) {
      let something = $(`<tr id="points-${name}">
        <td>${name}</td>
        <td>${points[name]}</td>
      </tr>`);
      $('#points').append(something);
      continue;
    }
    $row.find('td:last').text(points[name]);
  }
}

async function submit() {
  const name = $('#input-name').val();
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
