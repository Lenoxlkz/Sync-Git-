const { Hct, argbFromHex } = require('/tmp/mcu/index.js');
console.log('Hct keys:', Object.getOwnPropertyNames(Hct));
const h = Hct.fromInt(argbFromHex('#7C5CFF'));
console.log('instance:', h, '· proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(h) || {}));
console.log('hue/chroma/tone:', h.hue, h.chroma, h.tone, '· toInt?', typeof h.toInt);
const { SchemeVibrant } = require('/tmp/mcu/index.js');
console.log('SchemeVibrant toString:', SchemeVibrant.toString().slice(0, 400));
