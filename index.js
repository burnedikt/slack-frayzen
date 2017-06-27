// const menu = require('./menu');
// menu.then((meals) => {
//   console.log(meals);
// });

const RtmClient = require('@slack/client').RtmClient;

// The memory data store is a collection of useful functions we can include in our RtmClient
const MemoryDataStore = require('@slack/client').MemoryDataStore;
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;

const bot_token = process.env.SLACK_BOT_TOKEN || '';

const rtm = new RtmClient(bot_token, {
  // Sets the level of logging we require
  logLevel: 'info',
  // Initialise a data store for our client, this will load additional helper functions for the storing and retrieval of data
  dataStore: new MemoryDataStore()
});

rtm.start();

let user, team, generalChannelId;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);

  // find the ID of the #general channel
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name ==='general') {
      generalChannelId = c.id;
    }
  }
});

// Wait for the client to connect
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
  // Get the user's name
  user = rtm.dataStore.getUserById(rtm.activeUserId);

  // Get the team's name
  team = rtm.dataStore.getTeamById(rtm.activeTeamId);

  // Log the slack team name and the bot's name
  console.log('Connected to ' + team.name + ' as ' + user.name);
});

// Handle incoming events
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  if (message.channel === generalChannelId) {
    // do not handle messages in #general
    return;
  }
  console.log('Message:', message); //this is no doubt the lamest possible message handler, but you get the idea
});
