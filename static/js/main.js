let map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 0], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

var redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

var highlightedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -48],
  shadowSize: [57, 57]
});

var polyline = null;
var polylines = [];

const markers = [];
let events = [];
let currentIndex = -1;
let previousIndex = -1;
let isAnimating = false;
let drawingMarker = null;
let animatingLine = null;
let isFromPlay = false;
let shouldAnimate = false;
let cancelAnimation = false;

function formatDate(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0,10);
}

fetch('/events')
  .then(r => r.json())
  .then(data => {
    events = data.map(e => ({
      ...e,
      ts: new Date(e.date).getTime()
    }));
    if (events.length === 0) return;
    events.sort((a,b)=>a.ts-b.ts);
    initTimeline();
    addAllMarkers();
  })
  .catch(err => console.error('Failed loading events', err));

function addAllMarkers(){
  events.forEach(ev => {
    const m = L.marker([ev.lat, ev.lon], {icon: redIcon});
    m.bindPopup(`
      <div class="popup-content">
        <h2>${ev.title}</h2>
        <h3>${ev.date}</h3>
        <p>${ev.description || 'No description available'}</p>
      </div>
    `);
    m.evTs = ev.ts;
    m.addTo(map);
    markers.push(m);
  });
}

function updateMarkers(uptoTs){
  markers.forEach(m => {
    const isCurrent = m.evTs === uptoTs;
    m.setIcon(isCurrent ? highlightedIcon : redIcon);
    m.setOpacity(isCurrent ? 1 : 0.6);
    if (m.evTs <= uptoTs) {
      if (!map.hasLayer(m)) m.addTo(map);
    } else {
      if (map.hasLayer(m)) map.removeLayer(m);
    }
  });

  // Clear previous polylines
  polylines.forEach(p => map.removeLayer(p));
  polylines = [];

  // Draw all dotted, fading polylines instantly
  const visibleEvents = events.filter(e => e.ts <= uptoTs);
  const maxDiff = events[events.length - 1].ts - events[0].ts;
  for (let i = 0; i < visibleEvents.length - 1; i++) {
    if (!(currentIndex > previousIndex && i === visibleEvents.length - 2)) {
      const start = visibleEvents[i];
      const end = visibleEvents[i + 1];
      const age = uptoTs - end.ts;
      const fade = Math.min(1.0, (age / maxDiff) * 1.0);
      const opacity = 1 - fade;
      const line = L.polyline([[start.lat, start.lon], [end.lat, end.lon]], {
        color: 'red',
        weight: 3,
        opacity: opacity,
        dashArray: '5, 5'
      }).addTo(map);
      polylines.push(line);
    }
  }

  // Animate the new segment if advancing
  if (shouldAnimate && currentIndex > previousIndex && visibleEvents.length >= 2 && !isAnimating) {
    isAnimating = true;
    const newStart = visibleEvents[visibleEvents.length - 2];
    const newEnd = visibleEvents[visibleEvents.length - 1];
    const startTime = Date.now();
    const duration = 15000; // 15 seconds for the new segment
    const animate = () => {
      if (cancelAnimation) {
        // Cleanup
        const age = uptoTs - newEnd.ts;
        const fade = Math.min(1.0, (age / maxDiff) * 1.0);
        const opacity = 1 - fade;
        const dottedLine = L.polyline([[newStart.lat, newStart.lon], [newEnd.lat, newEnd.lon]], {
          color: 'red',
          weight: 3,
          opacity: opacity,
          dashArray: '5, 5'
        }).addTo(map);
        polylines.push(dottedLine);
        if (animatingLine) {
          map.removeLayer(animatingLine);
          animatingLine = null;
        }
        if (drawingMarker) {
          map.removeLayer(drawingMarker);
          drawingMarker = null;
        }
        isAnimating = false;
        cancelAnimation = false;
        return;
      }
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentLat = newStart.lat + (newEnd.lat - newStart.lat) * progress;
      const currentLon = newStart.lon + (newEnd.lon - newStart.lon) * progress;
      map.setView([currentLat, currentLon], 6);
      if (!animatingLine) {
        animatingLine = L.polyline([[newStart.lat, newStart.lon], [currentLat, currentLon]], {color: 'red', weight: 3}).addTo(map);
      } else {
        animatingLine.setLatLngs([[newStart.lat, newStart.lon], [currentLat, currentLon]]);
      }
      if (!drawingMarker) {
        drawingMarker = L.circleMarker([currentLat, currentLon], {color: 'red', radius: 5, fillOpacity: 1}).addTo(map);
      } else {
        drawingMarker.setLatLng([currentLat, currentLon]);
      }
      if (progress < 1) requestAnimationFrame(animate);
      else {
        // Add the final dotted line
        const age = uptoTs - newEnd.ts;
        const fade = Math.min(1.0, (age / maxDiff) * 1.0);
        const opacity = 1 - fade;
        const dottedLine = L.polyline([[newStart.lat, newStart.lon], [newEnd.lat, newEnd.lon]], {
          color: 'red',
          weight: 3,
          opacity: opacity,
          dashArray: '5, 5'
        }).addTo(map);
        polylines.push(dottedLine);
        if (animatingLine) {
          map.removeLayer(animatingLine);
          animatingLine = null;
        }
        if (drawingMarker) {
          map.removeLayer(drawingMarker);
          drawingMarker = null;
        }
        isAnimating = false;
      }
    };
    animate();
  }
}

function initTimeline(){
  const slider = document.getElementById('slider');
  const playBtn = document.getElementById('play');
  const resetBtn = document.getElementById('reset');
  const dateDisplay = document.getElementById('current-date');

  noUiSlider.create(slider, {
    start: [0],
    connect: [true, false],
    range: { min: 0, max: events.length - 1 },
    step: 1,
    tooltips: false,
    format: { to: v => Math.round(v), from: v => Number(v) }
  });

  slider.noUiSlider.on('update', (values)=>{
    const index = Math.round(Number(values[0]));
    const uptoTs = events[index].ts;
    if (index !== currentIndex) {
      previousIndex = currentIndex;
      currentIndex = index;
      shouldAnimate = isFromPlay;
      isFromPlay = false;
      if (isAnimating) {
        cancelAnimation = true;
      }
    }
    dateDisplay.textContent = formatDate(uptoTs);
    updateMarkers(uptoTs);
  });

  let playing = false;

  playBtn.addEventListener('click', ()=>{
    if (playing) {
      playing = false;
      playBtn.textContent = 'Play';
      // Note: can't easily cancel recursive setTimeout, but setting playing=false will stop advancing
    } else {
      playing = true;
      playBtn.textContent = 'Pause';
      const advance = () => {
        if (playing && !isAnimating) {
          const curIndex = Math.round(Number(slider.noUiSlider.get()));
          const nextIndex = Math.min(curIndex + 1, events.length - 1);
          isFromPlay = true;
          slider.noUiSlider.set(nextIndex);
          if (nextIndex < events.length - 1) {
            setTimeout(advance, 100); // check again soon
          } else {
            playing = false;
            playBtn.textContent = 'Play';
          }
        } else if (playing) {
          setTimeout(advance, 100); // wait for animation
        }
      };
      advance();
    }
  });

  resetBtn.addEventListener('click', ()=>{
    if (isAnimating) {
      cancelAnimation = true;
    }
    slider.noUiSlider.set(0);
  });

  // initialize to the event closest to current date
  const now = Date.now();
  let closestIndex = 0;
  let minDiff = Math.abs(events[0].ts - now);
  for (let i = 1; i < events.length; i++) {
    const diff = Math.abs(events[i].ts - now);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  slider.noUiSlider.set(closestIndex);
}
