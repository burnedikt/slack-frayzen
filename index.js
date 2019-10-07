const menu = require("./menu");

const RtmClient = require("@slack/client").RtmClient;

// The memory data store is a collection of useful functions we can include in our RtmClient
const MemoryDataStore = require("@slack/client").MemoryDataStore;
const CLIENT_EVENTS = require("@slack/client").CLIENT_EVENTS;
const RTM_EVENTS = require("@slack/client").RTM_EVENTS;

const bot_token = process.env.SLACK_BOT_TOKEN || "";

const rtm = new RtmClient(bot_token, {
  // Sets the level of logging we require
  logLevel: "info",
  // Initialise a data store for our client, this will load additional helper functions for the storing and retrieval of data
  dataStore: new MemoryDataStore()
});

rtm.start();

let user, team, generalChannelId;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
  console.log(
    `Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`
  );

  // find the ID of the #general channel
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === "general") {
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
  console.log("Connected to " + team.name + " as " + user.name);
});

const menuToSlackMessage = _menu => {
  // check the type of menu we got and handle it accordingly:
  if (_menu instanceof menu.RemoteMenu) {
    // non parseable menu but we got a remote link to it
    return `Weiß ich auch nicht genau, aber das komplette Menü findest du für gewöhnlich hier: ${_menu.url}`;
  } else {
    // default menu
    let msg = "Heute gibt es wohl folgendes:\n\n";
    if (_menu.meals) {
      _menu.meals.forEach(meal => {
        let meatTypeEmoji;
        switch (meal.meatType) {
          case menu.meat_types.SCHWEIN:
            meatTypeEmoji = " :pig:";
            break;
          case menu.meat_types.RIND:
            meatTypeEmoji = " :cow:";
            break;
          default:
            meatTypeEmoji = "";
        }
        msg += `${meal.name}${meatTypeEmoji}${
          meal.vegan || meal.vegetarian ? " :tomato:" : ""
        }${meal.nameEnglish ? ` (${meal.nameEnglish})` : ""}\n`;
      });

      msg += "\n*Guten Appetit! :fork_and_knife:*";
    }
    return msg;
  }
};

// Handle incoming events
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  if (message.channel === generalChannelId) {
    // do not handle messages in #general
    return;
  }
  // Map messages requesting the menu of a specific location
  // Was gibt's
  // What's on the menu
  // Speiseplan
  // Speisekarte
  const menu_request_snippets = [
    /.*was\s*gibt\'?s?n?.*(in|bei).*/gi,
    /.*what\'?s?.*on.*menu.*/gi,
    /.*Speiseplan.*/gi,
    /.*Speisekarte.*/gi
  ];

  let restaurant_regexs = {};
  restaurant_regexs[menu.types.FINANZKANTINE] = /.*finanzmensa|kantine.*/gi;
  restaurant_regexs[menu.types.BRUSKO] = /.*brusko.*/gi;
  restaurant_regexs[menu.types.OSTERIA] = /.*osteria|l'osteria.*/gi;
  restaurant_regexs[menu.types.UNIMENSA] = /(^|\s)mensa|unimensa.*/gi;

  // now check if the user actually requested the menu for any restaurant
  let match;
  for (var index = 0; index < menu_request_snippets.length; index++) {
    var regex = menu_request_snippets[index];
    if ((match = regex.exec(message.text)) != null) {
      // if we got here, someone asked for the menu
      // find out which menu he / she asked for
      let restaurant_type;
      for (let _restaurant_type in restaurant_regexs) {
        if (restaurant_regexs[_restaurant_type].exec(message.text)) {
          restaurant_type = _restaurant_type;
          break;
        }
      }
      // if we didn't find out the restaurant, let them know
      if (!restaurant_type) {
        console.warn("Could not identify requested restaurant ...");
        rtm.sendMessage(
          "Keine Ahnung! Sorry! :disappointed_relieved:",
          message.channel
        );
        return;
      }
      menu
        .loader(restaurant_type)
        .then(_menu => {
          rtm.sendMessage(menuToSlackMessage(_menu), message.channel);
        })
        .catch(err => {
          console.error(err);
        });
      // no further checks required
      break;
    }
  }
});
