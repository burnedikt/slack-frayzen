// dependencies
const cheerio = require('cheerio');
const request = require('request-promise-native');
const dateformat = require('dateformat');
const translate = require('translate');

// we'll alway input german texts to the translation service
translate.from = 'de';
translate.engine = 'google';
translate.key = process.env.TRANSLATE_KEY;

// supported mensa types
const MENSA_TYPES = Object.freeze({
  UNIMENSA: 'unimensa',
  FINANZKANTINE: 'finanzmensa',
  OSTERIA: 'osteria',
  BRUSKO: 'brusko'
});

const MEAT_TYPES = Object.freeze({
  SCHWEIN: 'schwein',
  RIND: 'rind'
});

class Menu {
  constructor(restaurant_type, meals) {
    this.restaurant_type = restaurant_type;
    this.meals = meals;
  }
}

class RemoteMenu extends Menu {
  constructor(restaurant_type, url) {
    super(restaurant_type);
    this.url = url;
  }
}

function translateMenuToEnglish(menu) {
  return Promise.all(menu.meals.map((meal) => {
    // translate the meal's name to english
    return translate(meal.name, 'en').then(text => {
      meal.nameEnglish = text;
      return meal;
    }).catch(err => {
      console.error(err);
    });
  }))
  .then((meals) => {
    menu.meals = meals;
    return menu;
  });
}

// request the menu
const unimensa_menu = () => {
  // main menu url
  const mensaId = 411;
  const menuUrl = `http://www.studentenwerk-muenchen.de/mensa/speiseplan/speiseplan_${mensaId}_-de.html`;

  return request(menuUrl)
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
            .contents().filter(function () {
              return this.nodeType == 3;
            }).text().trim();
          // check whether the meal is with or without meat
          let meatless = parseInt($ele.data('essen-fleischlos'), 10);
          // whether or not the meal is vegan
          let vegan = false;
          // whether or not the meal is vegetarian
          let vegetarian = false;
          let meatType;
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
                meatType = MEAT_TYPES.SCHWEIN;
                break;
              case 'R':
                meatType = MEAT_TYPES.RIND;
            }
          }
          // check allergenes
          let allergenes = $ele.data('essen-allergene');
          if (allergenes && typeof allergenes === 'string') {
            allergenes = allergenes.trim().split(',');
          } else {
            if (allergenes) {
              allergenes = [allergenes];
            } else {
              allergenes = [];
            }
          }
          // and additives
          let additives = $ele.data('essen-zusatz');
          if (additives && typeof additives === 'string') {
            additives = additives.trim().split(',');
          } else {
            if (additives) {
              additives = [additives]
            } else {
              additives = [];
            }
          }
          // return all gathered information
          return {
            'name': name,
            'nameEnglish': '',
            'vegan': vegan,
            'vegetarian': vegetarian,
            'meatType': meatType,
            'allergenes': allergenes,
            'additives': additives
          };
        })
        .toArray();
      return new Menu(MENSA_TYPES.UNIMENSA, meals);
    })
    .then(translateMenuToEnglish)
    .catch((err) => {
      console.log(err);
    });
};

const finanzmensa_menu = () => {
  return new Promise((resolve) => {
    resolve(new RemoteMenu(MENSA_TYPES.FINANZKANTINE, 'http://fm-kantine.hf-catering.de/'));
  });
};

const brusko_menu = () => {
  return new Promise((resolve) => {
    resolve(new RemoteMenu(MENSA_TYPES.BRUSKO, 'http://www.brusko.de/brusko-menu.html'));
  });
};

const osteria_menu = () => {
  return new Promise((resolve) => {
    resolve(new RemoteMenu(MENSA_TYPES.BRUSKO, 'http://losteria.de/menu/pizza/'));
  });
};

module.exports = {
  RemoteMenu: RemoteMenu,
  Menu: Menu,
  types: MENSA_TYPES,
  meat_types: MEAT_TYPES,
  loader: (mensa_type) => {
    switch (mensa_type) {
      case MENSA_TYPES.UNIMENSA:
        return unimensa_menu();
      case MENSA_TYPES.FINANZKANTINE:
        return finanzmensa_menu();
      case MENSA_TYPES.BRUSKO:
        return brusko_menu();
      case MENSA_TYPES.OSTERIA:
        return osteria_menu();
      default:
        console.error('No matching loader found for mensa type...');
        return undefined;
    }
  }
};
