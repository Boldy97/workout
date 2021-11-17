const express = require('express');
const bodyParser = require('body-parser');
const binarySearch = require('binarysearch');
const fs = require('fs').promises;
const argv = require('minimist')(process.argv.slice(2));
const dayjs = require('dayjs');

const DATA_PATH = 'data/data.json';
const PORT = argv.port || 3000;
const INTERVAL = 1000 * 60 * (argv.interval || 60);
const DELAY = 1000 * 60 * (argv.delay || 15);
let DATA = {
  players: [],
  actions: [],
  pointsByName: {},
  actionCountsByName: {}
};

async function start() {
  await loadData();
  setupWebserver();
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

  app.get('/api/status', (req, res) => {
    let cutoff = req.query.time || Date.now() - 1000 * 60 * 60 * 24 * 7; // max 7 days ago
    let index = binarySearch.closest(DATA.actions, cutoff, (action, cutoff) => action.time - cutoff);
    let newActions = [];
    if(index >= 0) {
      if(DATA.actions[index].time <= cutoff) index++;
      newActions = DATA.actions.slice(index);
    }
    res.send({
      players: DATA.players,
      actions: newActions,
      pointsByName: DATA.pointsByName,
      actionCountsByName: DATA.actionCountsByName
    });
  });

  app.post('/api/action', (req, res) => {
    let action = req.body;
    action = addAction(action);
    res.send(action);
  });

  app.listen(PORT, () => {
    console.log(`Listening at http://localhost:${PORT}`);
  });
}

function addAction(action) {
  action.time = Date.now();
  // actions
  DATA.actions.push(action);
  // pointsByName
  if(!DATA.pointsByName[action.name]) DATA.pointsByName[action.name] = 0;
  const gainedPoints = getGainedPoints(action.name);
  console.log(`Giving ${gainedPoints} point(s) to ${action.name}`);
  DATA.pointsByName[action.name] += gainedPoints;
  // actionCountsByName
  const date =dayjs(action.time).format('YYYY-MM-DD');
  const actionCount = getActionCountForNameAndDate(action.name, date);
  actionCount.count += gainedPoints;
  actionCount.cumulativeCount += gainedPoints;
  // end
  saveData();
  return action;
}

function isLeader(name) {
  return DATA.players.find(player => player.name === name).leader;
}

function getGainedPoints(name) {
  return isLeader(name) ? DATA.players.length - 1 : 1;
}

function getActionCountForNameAndDate(name, date) {
  if(!DATA.actionCountsByName[name]) {
    DATA.actionCountsByName[name] = [newActionCount(date)];
  }
  let last = DATA.actionCountsByName[name][DATA.actionCountsByName[name].length-1];
  if(last.date !== date) {
    const last_ = newActionCount(date);
    last_.cumulativeCount = last.cumulativeCount;
    last = last_;
    DATA.actionCountsByName[name].push(last);
  }
  return last;
}

function newActionCount(date) {
  return {
    date: date,
    time: new Date(date).getTime(),
    count: 0,
    cumulativeCount: 0
  };
}

start();
