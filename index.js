const express = require('express');
const bodyParser = require('body-parser');
const binarySearch = require('binarysearch');
const fs = require('fs').promises;
const argv = require('minimist')(process.argv.slice(2));

const DATA_PATH = 'data/data.json';
const PORT = argv.port || 3000;
const INTERVAL = 1000 * 60 * (argv.interval || 60);
const DELAY = 1000 * 60 * (argv.delay || 15);
let DATA = {
  actions: [],
  points: {}
};

async function start() {
  await loadData();
  setupWebserver();
  setInterval(updatePoints, 1000);
}

async function loadData() {
  try {
    DATA = JSON.parse(await fs.readFile(DATA_PATH, {
      encoding: 'utf8'
    }));
  } catch(e) {
    console.log('Could not load data', e);
  }
}

async function saveData() {
  await fs.writeFile(DATA_PATH, JSON.stringify(DATA));
}

function setupWebserver() {
  const app = express();

  app.use(bodyParser.json());
  app.use(express.static('public'));

  app.post('/api/action', (req, res) => {
    let action = req.body;
    action = addAction(action);
    res.send(action);
  });

  app.get('/api/status', (req, res) => {
    let cutoff = req.query.time || Date.now() - 1000 * 60 * 60 * 24 * 7; // max 7 days ago
    let index = binarySearch.closest(DATA.actions, cutoff, (action, cutoff) => action.time - cutoff);
    let newActions = [];
    if(index >= 0) {
      if(DATA.actions[index].time <= cutoff) index++;
      newActions = DATA.actions.slice(index);
    }
    res.send({
      points: DATA.points,
      actions: newActions
    });
  });

  app.listen(PORT, () => {
    console.log(`Listening at http://localhost:${PORT}`);
  });
}

function addAction(action) {
  action.time = Date.now();
  action.timeVictory = action.time + INTERVAL;
  action.timeDelay = action.time + DELAY;
  assignPointForNewAction(action);
  DATA.actions.push(action);
  saveData();
  return action;
}

function assignPointForNewAction(action) {
  if(!DATA.points[action.name]) DATA.points[action.name] = 0;
  const previousAction = DATA.actions[DATA.actions.length - 1];
  if(previousAction && previousAction.name === action.name && Date.now() < previousAction.timeDelay) return;
  givePoint(action.name);
}

function updatePoints() {
  const action = DATA.actions[DATA.actions.length - 1];
  if(!action) return;
  if(action.assignedPoint) return;
  if(Date.now() < action.timeVictory) return;
  givePoint(action.name);
  action.assignedPoint = true;
  saveData();
}

function givePoint(name) {
  console.log('Giving point to', name, '!');
  DATA.points[name]++;
}

start();
