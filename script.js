/* =========================================================
   DATA — categories pulled straight from the trained
   ColumnTransformer's OneHotEncoder, so every option here
   is guaranteed to be something the model actually saw.
========================================================= */
const NEIGHBOURHOODS = {"neighbourhood_group": ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"], "neighbourhood": ["Allerton", "Arden Heights", "Arrochar", "Arverne", "Astoria", "Bath Beach", "Battery Park City", "Bay Ridge", "Bay Terrace", "Bay Terrace, Staten Island", "Baychester", "Bayside", "Bayswater", "Bedford-Stuyvesant", "Belle Harbor", "Bellerose", "Belmont", "Bensonhurst", "Bergen Beach", "Boerum Hill", "Borough Park", "Breezy Point", "Briarwood", "Brighton Beach", "Bronxdale", "Brooklyn Heights", "Brownsville", "Bull's Head", "Bushwick", "Cambria Heights", "Canarsie", "Carroll Gardens", "Castle Hill", "Castleton Corners", "Chelsea", "Chinatown", "City Island", "Civic Center", "Claremont Village", "Clason Point", "Clifton", "Clinton Hill", "Co-op City", "Cobble Hill", "College Point", "Columbia St", "Concord", "Concourse", "Concourse Village", "Coney Island", "Corona", "Crown Heights", "Cypress Hills", "DUMBO", "Ditmars Steinway", "Dongan Hills", "Douglaston", "Downtown Brooklyn", "Dyker Heights", "East Elmhurst", "East Flatbush", "East Harlem", "East Morrisania", "East New York", "East Village", "Eastchester", "Edenwald", "Edgemere", "Elmhurst", "Eltingville", "Emerson Hill", "Far Rockaway", "Fieldston", "Financial District", "Flatbush", "Flatiron District", "Flatlands", "Flushing", "Fordham", "Forest Hills", "Fort Greene", "Fort Hamilton", "Fresh Meadows", "Glendale", "Gowanus", "Gramercy", "Graniteville", "Grant City", "Gravesend", "Great Kills", "Greenpoint", "Greenwich Village", "Grymes Hill", "Harlem", "Hell's Kitchen", "Highbridge", "Hollis", "Holliswood", "Howard Beach", "Howland Hook", "Huguenot", "Hunts Point", "Inwood", "Jackson Heights", "Jamaica", "Jamaica Estates", "Jamaica Hills", "Kensington", "Kew Gardens", "Kew Gardens Hills", "Kingsbridge", "Kips Bay", "Laurelton", "Lighthouse Hill", "Little Italy", "Little Neck", "Long Island City", "Longwood", "Lower East Side", "Manhattan Beach", "Marble Hill", "Mariners Harbor", "Maspeth", "Melrose", "Middle Village", "Midland Beach", "Midtown", "Midwood", "Mill Basin", "Morningside Heights", "Morris Heights", "Morris Park", "Morrisania", "Mott Haven", "Mount Eden", "Mount Hope", "Murray Hill", "Navy Yard", "Neponsit", "New Brighton", "New Dorp", "New Dorp Beach", "New Springville", "NoHo", "Nolita", "North Riverdale", "Norwood", "Oakwood", "Olinville", "Ozone Park", "Park Slope", "Parkchester", "Pelham Bay", "Pelham Gardens", "Port Morris", "Port Richmond", "Prince's Bay", "Prospect Heights", "Prospect-Lefferts Gardens", "Queens Village", "Randall Manor", "Red Hook", "Rego Park", "Richmond Hill", "Ridgewood", "Riverdale", "Rockaway Beach", "Roosevelt Island", "Rosebank", "Rosedale", "Rossville", "Schuylerville", "Sea Gate", "Sheepshead Bay", "Shore Acres", "Silver Lake", "SoHo", "Soundview", "South Beach", "South Ozone Park", "South Slope", "Springfield Gardens", "Spuyten Duyvil", "St. Albans", "St. George", "Stapleton", "Stuyvesant Town", "Sunnyside", "Sunset Park", "Theater District", "Throgs Neck", "Todt Hill", "Tompkinsville", "Tottenville", "Tremont", "Tribeca", "Two Bridges", "Unionport", "University Heights", "Upper East Side", "Upper West Side", "Van Nest", "Vinegar Hill", "Wakefield", "Washington Heights", "West Brighton", "West Farms", "West Village", "Westchester Square", "Westerleigh", "Whitestone", "Williamsbridge", "Williamsburg", "Willowbrook", "Windsor Terrace", "Woodhaven", "Woodlawn", "Woodside"]};

/* Order returned by model.predict_proba — matches classifier.classes_ */
const CLASS_ORDER = ["Entire home/apt", "Private room", "Shared room"];

/* =========================================================
   INIT — populate borough select + neighbourhood datalist
========================================================= */
const boroughSelect = document.getElementById('neighbourhood_group');
NEIGHBOURHOODS.neighbourhood_group.forEach(b => {
  const opt = document.createElement('option');
  opt.value = b;
  opt.textContent = b;
  boroughSelect.appendChild(opt);
});

const neighDatalist = document.getElementById('neighbourhood-list');
NEIGHBOURHOODS.neighbourhood.forEach(n => {
  const opt = document.createElement('option');
  opt.value = n;
  neighDatalist.appendChild(opt);
});

/* highlight the schematic borough map as the user picks a borough */
const boroughNodes = document.querySelectorAll('#borough-svg .node');
boroughSelect.addEventListener('change', () => {
  boroughNodes.forEach(n => {
    n.classList.toggle('active', n.dataset.borough === boroughSelect.value);
  });
});

/* =========================================================
   FORM SUBMIT — call the FastAPI /predict endpoint
========================================================= */
const form = document.getElementById('predict-form');
const runBtn = document.getElementById('run-btn');
const formError = document.getElementById('form-error');
const statusChip = document.getElementById('status-chip');
const readoutPanel = document.querySelector('.readout');

const trackEls = {};
CLASS_ORDER.forEach(cls => {
  trackEls[cls] = document.querySelector(`.track[data-class="${cls}"]`);
});

const verdictValue = document.getElementById('verdict-value');
const rawJson = document.getElementById('raw-json');
const rawToggle = document.getElementById('raw-toggle');

rawToggle.addEventListener('click', () => {
  const hidden = rawJson.hasAttribute('hidden');
  if (hidden) { rawJson.removeAttribute('hidden'); rawToggle.textContent = 'Hide raw response'; }
  else { rawJson.setAttribute('hidden', ''); rawToggle.textContent = 'View raw response'; }
});

function setStatus(state, label){
  statusChip.classList.remove('scanning', 'done', 'error');
  if (state) statusChip.classList.add(state);
  statusChip.textContent = label;
}

function resetTracks(){
  CLASS_ORDER.forEach(cls => {
    const el = trackEls[cls];
    el.classList.remove('leading', 'animated');
    el.querySelector('[data-fill]').style.width = '0%';
    el.querySelector('[data-terminal]').style.left = '0%';
    el.querySelector('[data-pct]').textContent = '0%';
  });
}

function animateTracks(probabilities){
  // probabilities: array aligned to CLASS_ORDER
  const maxIdx = probabilities.indexOf(Math.max(...probabilities));

  CLASS_ORDER.forEach((cls, i) => {
    const el = trackEls[cls];
    const pct = Math.round(probabilities[i] * 1000) / 10; // one decimal
    const fill = el.querySelector('[data-fill]');
    const terminal = el.querySelector('[data-terminal]');
    const pctLabel = el.querySelector('[data-pct]');

    requestAnimationFrame(() => {
      el.classList.add('animated');
      fill.style.width = pct + '%';
      terminal.style.left = pct + '%';
      if (i === maxIdx) el.classList.add('leading');
    });

    animateCounter(pctLabel, pct);
  });
}

function animateCounter(el, target){
  const duration = 900;
  const start = performance.now();
  function tick(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = (eased * target).toFixed(1);
    el.textContent = val + '%';
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(1) + '%';
  }
  requestAnimationFrame(tick);
}

function flickerVerdict(text){
  verdictValue.classList.remove('lit');
  verdictValue.textContent = text;
  // force reflow so the animation restarts
  void verdictValue.offsetWidth;
  verdictValue.classList.add('lit');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const apiBase = document.getElementById('api-base').value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8000';

  const payload = {
    latitude: parseFloat(form.latitude.value),
    longitude: parseFloat(form.longitude.value),
    price: parseFloat(form.price.value),
    minimum_nights: parseInt(form.minimum_nights.value, 10),
    number_of_reviews: parseInt(form.number_of_reviews.value, 10),
    reviews_per_month: parseFloat(form.reviews_per_month.value),
    calculated_host_listings_count: parseInt(form.calculated_host_listings_count.value, 10),
    availability_365: parseInt(form.availability_365.value, 10),
    neighbourhood_group: form.neighbourhood_group.value,
    neighbourhood: form.neighbourhood.value,
  };

  for (const [key, val] of Object.entries(payload)) {
    if (val === '' || val === null || (typeof val === 'number' && Number.isNaN(val))) {
      formError.textContent = `Missing or invalid value for "${key.replaceAll('_', ' ')}".`;
      return;
    }
  }

  runBtn.classList.add('loading');
  runBtn.disabled = true;
  setStatus('scanning', 'SCANNING…');
  resetTracks();

  try {
    const res = await fetch(`${apiBase}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`API responded ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const probs = data.Probability;
    const predicted = data.Predicted_room_type;

    readoutPanel.classList.add('has-result');
    animateTracks(probs);

    setTimeout(() => {
      flickerVerdict(predicted);
      setStatus('done', 'SIGNAL LOCKED');
    }, 650);

    rawJson.textContent = JSON.stringify(data, null, 2);

  } catch (err) {
    setStatus('error', 'SIGNAL LOST');
    formError.textContent = `Couldn't reach the model: ${err.message}. Check that the FastAPI server is running and the API base URL is correct.`;
  } finally {
    runBtn.classList.remove('loading');
    runBtn.disabled = false;
  }
});
