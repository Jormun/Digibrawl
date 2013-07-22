exports.BattleTypeChart = {
  // For attributes 0 means neutral and 50 means strong. There's no resistance.
  attributes: {
    none: {
      data: 0,
      vaccine: 0,
      virus: 0,
      unknown: 0
    },
    data: {
      none: 50,
      vaccine: 50,
      virus: 0,
      unknown: 0
    },
    vaccine: {
      none: 50,
      data: 0,
      virus: 50,
      unknown: 0
    },
    virus: {
      none: 50,
      data: 50,
      vaccine: 0,
      unknown: 0
    },
    unknown: {
      none: 50,
      data: 50,
      vaccine: 50,
      virus: 50
    },
  },
  elements: {
    fire: {},
    ice: {},
    land: {},
    light: {},
    neutral: {},
    pitchblack: {},
    steel: {},
    thunder: {},
    water: {},
    wind: {},
    wood: {}
  }
};