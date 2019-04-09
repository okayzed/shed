var names = "Friendly Fox, Brilliant Beaver, Observant Owl, Gregarious Giraffe, Wild Wolf, Silent Seal, Wacky Whale, Curious Cat, Intelligent Iguana";
names = names.split(', ');

function randomName() {
  var c = Math.random();
  if (c == 1) c = 0.5;
  return names[parseInt(c*10)];
}

module.exports = randomName;