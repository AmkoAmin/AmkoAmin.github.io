// rotating typed tagline in the hero
const phrases = [
  "systems programming in C/C++",
  "RAG pipelines & LLM integration",
  "autonomous robots with ROS 2",
  "distributed systems & real-time data",
];

const el = document.getElementById("typed");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduceMotion) {
  el.textContent = phrases[0];
} else {
  let phrase = 0;
  let pos = 0;
  let deleting = false;

  function tick() {
    const current = phrases[phrase];

    if (!deleting) {
      pos++;
      el.textContent = current.slice(0, pos);
      if (pos === current.length) {
        deleting = true;
        setTimeout(tick, 2200);
        return;
      }
      setTimeout(tick, 55);
    } else {
      pos--;
      el.textContent = current.slice(0, pos);
      if (pos === 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
      }
      setTimeout(tick, 28);
    }
  }

  tick();
}
