// dependencies
const cheerio = require('cheerio');
const request = require('request-promise-native');
const dateformat = require('dateformat');

// main menu url
const mensaId = 411;
const menuUrl = `http://www.studentenwerk-muenchen.de/mensa/speiseplan/speiseplan_${mensaId}_-de.html`;

// request the menu
request(menuUrl)
  .then((html) => {
    // parse the html page with cheerio (basically severside jquery)
    const $ = cheerio.load(html);
    // find today's menu section
    const todayStringFormat = dateformat(new Date(), 'yyyy-mm-dd');
    const meals = $(`.heute_${todayStringFormat}`)
      .siblings('.c-schedule__list')
      .children('.c-schedule__list-item')
      .map((index, element) => {
        let $ele = $(element);
        // get the text node only
        let name = $ele.find('.js-schedule-dish-description')
          .contents().filter(function(){
            return this.nodeType == 3;
          }).text().trim();
        // check whether the meal is with or without meat
        let meatless = parseInt($ele.data('essen-fleischlos'), 10);
        // whether or not the meal is vegan
        let vegan = false;
        // whether or not the meal is vegetarian
        let vegetarian = false;
        let meatType = null;
        if (meatless > 0) {
          // meatless case
          vegetarian = true;
          if (meatless > 1) {
            vegan = true;
          }
        } else {
          // meat case
          let meatTypeString = $ele.data('essen-typ');
          switch (meatTypeString) {
          case 'S':
            meatType = 'Schweinefleisch';
            break;
          case 'R':
            meatType = 'Rindfleisch';
          }
        }
        // check allergenes
        let allergenes = $ele.data('essen-allergene').trim();
        if (allergenes) {
          allergenes = allergenes.split(',');
        } else {
          allergenes = [];
        }
        // and additives
        let additives = $ele.data('essen-zusatz').trim();
        if (additives) {
          additives = additives.split(',');
        } else {
          additives = [];
        }
        // return all gathered information
        return {
          'name' : name,
          'vegan': vegan,
          'vegetarian': vegetarian,
          'meatType': meatType,
          'allergenes': allergenes,
          'additives': additives
        };
      })
      .toArray();
    console.log(meals);
  })
  .catch((err) => {
    console.log(err);
  });
