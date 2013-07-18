exports.BattleTypeChart = {
  // For attributes 1 means neutral and 2 means strong. There's no resistance.
  attributes: {
    none: {
      data: 1,
      vaccine: 1,
      virus: 1,
      unknown: 1
    },
    data: {
      none: 2,
      vaccine: 2,
      virus: 1,
      unknown: 1
    },
    vaccine: {
      none: 2,
      data: 1,
      virus: 2,
      unknown: 1
    },
    virus: {
      none: 2,
      data: 2,
      vaccine: 1,
      unknown: 1
    },
    unknown: {
      none: 2,
      data: 2,
      vaccine: 2,
      virus: 2
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