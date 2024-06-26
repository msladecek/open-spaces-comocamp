const OpenSpaceNamedEvent = require('./events/OpenSpaceNamedEvent');
const DateRangeSetEvent = require('./events/DateRangeSetEvent');
const TopicSubmittedEvent = require('./events/TopicSubmittedEvent');

if (process.argv.includes('--run-tests')) {
  run_tests();
  process.exit(0);
}

const port = 3000;
const fs = require('fs');
const express = require('express');
const app = express();
const { engine } = require('express-handlebars');
const { v4: uuidv4 } = require('uuid');
app.use(express.urlencoded({ extended: true })); 
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.engine('handlebars', engine({ defaultLayout: false }));
app.set('view engine', 'handlebars');
app.set('views', './views');
app.listen(port, () => { console.log(`Example app listening at http://localhost:${port}`); });

const EVENT_STORE_PATH = __dirname + '/eventstore/';
function getAllEventFileNames(filterFunction) { return fs.readdirSync(EVENT_STORE_PATH).filter(filterFunction)};
function writeEventIfIdNotExists(event) { if (fs.readdirSync(EVENT_STORE_PATH).filter(file => file.includes(event.id)).length === 0) { fs.writeFileSync(`${EVENT_STORE_PATH}${event.timestamp.replace(/:/g, '-').replace(/\..+/, '')}-${event.id}-${event.type}.json`, JSON.stringify(event)); } }
function getLastEvent(eventType) { try { return JSON.parse(fs.readFileSync(EVENT_STORE_PATH + getAllEventFileNames(file => file.includes(eventType)).sort().reverse()[0], 'utf8'));
} catch (err) { return null; } }
function getAllEvents(filterFunction) { return fs.readdirSync(EVENT_STORE_PATH).map(file => JSON.parse(fs.readFileSync(EVENT_STORE_PATH + file, 'utf8'))).filter(filterFunction); }


app.get('/', (req, res) => { res.redirect('/create_space'); });

app.get('/create_space', (req, res) => { res.render('create_space', { spaceName: OpenSpaceNameSV(getAllEvents).spaceName, id: uuidv4() }); });
app.post('/create_space', (req, res) => {
  const {spaceName, id} = req.body;
  const openSpaceEvent = new OpenSpaceNamedEvent(spaceName, new Date().toISOString(), id);
  if (!spaceName.trim()) { res.status(400).send('Space name is required'); return; }
  try { writeEventIfIdNotExists(openSpaceEvent);
    res.render('space_created_confirmation', OpenSpaceNameSV(getAllEvents));
  } catch (err) { res.status(500).send('Failed to write event to the file system'); }
});
function OpenSpaceNameSV(eventsFunction) {
  const lastEvent = eventsFunction(event => event.type === 'OpenSpaceNamedEvent').sort((a, b) => a.timestamp - b.timestamp).reverse()[0];
  return lastEvent ? { spaceName: lastEvent.spaceName, errorMessage: ''} : { errorMessage: 'No space has been created yet.', spaceName: ''};
}

app.get('/set_dates', (req, res) => { res.render('set_dates', { eventName: OpenSpaceNameSV(getAllEvents).spaceName, id: uuidv4() }); });
app.post('/set_dates', (req, res) => {
  const { startDate, endDate, id } = req.body;
  const dateRangeSetEvent = new DateRangeSetEvent(startDate, endDate, new Date().toISOString(), id);
  try { writeEventIfIdNotExists(dateRangeSetEvent); 
    res.render('set_dates_confirmation', OpenSpaceDateRangeSV(getAllEvents));
  } catch (err) { res.status(500).send('Failed to write date range event to the file system'); return; }
});
function OpenSpaceDateRangeSV(eventsFunction) {
  const lastEvent = eventsFunction(event => event.type === 'DateRangeSetEvent').sort((a, b) => a.timestamp - b.timestamp).reverse()[0];
  return lastEvent ? { errorMessage: '', startDate: lastEvent.startDate, endDate: lastEvent.endDate } : { errorMessage: 'Date range not set yet.', startDate: '', endDate: '' };
}

app.get('/submit_topic', (req, res) => { res.render('submit_topic', { eventName: OpenSpaceNameSV(getAllEvents).spaceName, id: uuidv4() }); });
app.post('/submit_topic', (req, res) => {
    const { name, type, topic, id } = req.body;
    const topicSubmittedEvent = new TopicSubmittedEvent(name, type, topic, new Date().toISOString(), id);
    try {
        writeEventIfIdNotExists(topicSubmittedEvent);
        res.render('sessions', { sessions: SessionsSV(getAllEvents) });
    } catch (err) { res.status(500).send('Failed to write event to the file system'); }
});
function SessionsSV(eventsFunction) {
    return eventsFunction(event => event.type === 'TopicSubmittedEvent').sort((a, b) => a.timestamp - b.timestamp);
}

function run_tests() {
  function logResult(expected, result) { 
    console.log(`Expected: ${expected}, Got: ${result}`);
  }
  function assertObjectEqual(expected, actual) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new Error(`Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  const testEventStream = [
    new OpenSpaceNamedEvent("Test1", new Date("2024-05-01T00:00:00.000Z"), "1ceee960-2f9f-47b0-ad19-fed15d4f82cb"),
    new OpenSpaceNamedEvent("Test2", new Date("2024-05-02T00:00:00.000Z"), "2ceee960-2f9f-47b0-ad19-fed15d4f82cb"),
    new OpenSpaceNamedEvent("Test3", new Date("2024-05-03T00:00:00.000Z"), "3ceee960-2f9f-47b0-ad19-fed15d4f82cb"),
  ]
  
  const tests = [
    {
      name: 'Test OpenSpaceNameSV with no events',
      test: () => {
        const expected = { errorMessage: 'No space has been created yet.', spaceName: '' };
        const result = OpenSpaceNameSV(() => testEventStream.slice(0, 0));
        assertObjectEqual(expected, result);
        return true;
      }
    },
    {
      name: 'Test OpenSpaceNameSV with first event',
      test: () => {
        const expected = { spaceName: 'Test1', errorMessage: '' };
        const result = OpenSpaceNameSV(() => testEventStream.slice(0, 1));
        assertObjectEqual(expected, result);
        return true;
      }
    },
    {
      name: 'Test OpenSpaceNameSV with first two events',
      test: () => {
        const expected = { spaceName: 'Test2', errorMessage: '' };
        const result = OpenSpaceNameSV(() => testEventStream.slice(0, 2));
        assertObjectEqual(expected, result);
        return true;
      }
    },
    {
      name: 'Test OpenSpaceNameSV with all three events',
      test: () => {
        const expected = { spaceName: 'Test3', errorMessage: '' };
        const result = OpenSpaceNameSV(() => testEventStream);
        assertObjectEqual(expected, result);
        return true;
      }
    },
  ]

  tests.forEach(test => {
    try { console.log((test.test() ? '✅ ' : '❌ ') + test.name);
    } catch (error) { console.log('❌ ' + test.name + ' had error: ' + error); }
  });
}
module.exports = app;
