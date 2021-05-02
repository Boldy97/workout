const express = require('express');
const bodyParser = require('body-parser');
const binarySearch = require('binarysearch');
const fs = require('fs').promises;
const argv = require('minimist')(process.argv.slice(2));

const PORT = 3000;
const DATA_PATH = 'data/data.json';
const INTERVAL = 1000 * 60 * (argv.interval || 60);
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
    const action = req.body;
    action.time = Date.now();
    action.timeVictory = action.time + INTERVAL;
    DATA.actions.push(action);
    if(!DATA.points[action.name]) DATA.points[action.name] = 0;
    saveData();
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

function updatePoints() {
  const action = DATA.actions[DATA.actions.length - 1];
  if(!action) return;
  if(action.assignedPoint) return;
  if(Date.now() < action.timeVictory) return;
  console.log('Giving point to', action.name, '!');
  DATA.points[action.name]++;
  action.assignedPoint = true;
  saveData();
}

start();
