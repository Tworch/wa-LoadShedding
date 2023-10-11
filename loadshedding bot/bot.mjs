import schedule from 'node-schedule';
import fetch from 'node-fetch';
import { create, Client } from '@open-wa/wa-automate';
import fs from 'fs';

const dbPath = 'db.json';

async function fuzzySearch(query) {
  try {
    const response = await fetch(`https://eskom-calendar-api.shuttleapp.rs/fuzzy_search/${query}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching fuzzy search results:', error);
    return [];
  }
}

async function listAreas() {
  try {
    const response = await fetch(`https://eskom-calendar-api.shuttleapp.rs/list_areas`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching list of areas:', error);
    return [];
  }
}

async function getPowerOutages(area) {
  try {
    const response = await fetch(`https://eskom-calendar-api.shuttleapp.rs/outages/${area}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching power outages:', error);
    return [];
  }
}

function scheduleNotifications(client) {
  let db = {};
  if (fs.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (error) {
      console.error('Error reading or parsing db.json:', error);
      db = {};
    }
  }
  for (const user in db) {
    const area = db[user];
    getPowerOutages(area).then(scheduleData => {
      if (!Array.isArray(scheduleData)) {
        console.error('Unexpected data structure for schedule:', scheduleData);
        return;
      }
      scheduleData.forEach(outage => {
        const notificationTime = new Date(outage.start);
        notificationTime.setHours(notificationTime.getHours() - 1);
        schedule.scheduleJob(notificationTime, function() {
          client.sendText(user, `Load shedding will start in one hour for area ${area}.`);
        });
      });
    });
  }
}

function start(client) {
  client.onMessage(async message => {
    if (message.body.startsWith('/search ')) {
      const query = message.body.split(' ')[1];
      const results = await fuzzySearch(query);
      client.sendText(message.from, `Search results for ${query}: ${JSON.stringify(results)}`);
    } else if (message.body === '/listareas') {
      const areas = await listAreas();
      client.sendText(message.from, `List of areas: ${JSON.stringify(areas)}`);
    } else if (message.body.startsWith('/loadshedding')) {
      const area = message.body.split(' ')[1];
      const schedule = await getPowerOutages(area);
      client.sendText(message.from, `Load shedding schedule for ${area}: ${JSON.stringify(schedule)}`);
    }
  });
  scheduleNotifications(client);
}

create().then(client => start(client));
