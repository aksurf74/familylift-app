(async function () {
  let S = window.FamilyLiftState;

  if (!S?.profile) {
    document.getElementById('app').innerHTML = `
      <main class="shell">
        <section class="glass">
          <h1>FamilyLift konnte nicht starten</h1>
          <div class="error">Profilzustand fehlt. Bitte neu anmelden.</div>
        </section>
      </main>`;
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const profile = S.profile;
  const family = S.members || [];
  const person = (id) => family.find((member) => member.id === id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const favorites = [
    { id: 'home', label: 'Zuhause', lat: 48.593856, lng: 9.244877 }
  ];

  const historyLabels = {
    requested: 'Angefragt',
    accepted: 'Bestätigt',
    driver_on_the_way: 'Unterwegs',
    driver_arrived: 'Fahrer ist da',
    completed: 'Erledigt',
    cancelled: 'Storniert',
    rejected: 'Abgelehnt'
  };

  let page = 'home';
  let pickup = null;
  let destination = null;
  let etaChoice = null;
  let busy = false;
  let formError = '';
  let realtime = 'CONNECTING';
  let draft = {
    pickupText: '',
    destinationText: '',
    type: 'now',
    date: '',
    time: '',
    people: '1',
    driver: 'any',
    note: ''
  };

  const rides = () => S.rides || [];
  const active = () => rides().find((ride) =>
    !['completed', 'cancelled', 'rejected'].includes(ride.status) &&
    (
      ride.requesterId === profile.id ||
      (ride.driverId
        ? ride.driverId === profile.id
        : profile.canDrive && ride.requesterId !== profile.id)
    )
  );

  function navigation() {
    const entries = [
      ['home', 'Home', 'home'],
      ['rides', 'Fahrten', 'car'],
      ['stats', 'Statistik', 'stats'],
      ['family', 'Familie', 'family']
    ];

    return `<nav class="nav">${entries.map(([target, label, icon]) => `
      <button type="button" data-page="${target}" class="${page === target ? 'active' : ''}">
        <img src="assets/icons/${icon}.svg" alt="">
        <span>${label}</span>
      </button>`).join('')}</nav>`;
  }

  function header() {
    return `
      <div class="top">
        <div>
          <div class="brand-lockup">
            <div class="brand-wordmark"><span>Family</span><em>Lift</em></div>
            <div class="brand-tagline">TOGETHER FURTHER</div>
          </div>
          <h2>Hallo ${esc(profile.name)} 👋</h2>
        </div>
        <button type="button" id="logout" class="profile">
          <span class="avatar">${esc(profile.initials)}</span>
          <span>
            <small>${realtime === 'SUBSCRIBED' ? 'Live verbunden' : 'Angemeldet'}</small>
            <b>${esc(profile.name)}</b>
          </span>
        </button>
      </div>`;
  }

  function selectedArrivalMinutes() {
    if (etaChoice === 'custom') {
      const input = Number($('#customEta')?.value);
      return Number.isInteger(input) && input >= 1 && input <= 180 ? input : null;
    }
    return Number(etaChoice) || null;
  }

  function rideCard(ride) {
    const requester = person(ride.requesterId);
    const driver = person(ride.driverId);
    const ownOffer = ride.proposals?.find((offer) => offer.driverId === profile.id);
    const isRequester = ride.requesterId === profile.id;
    const isDriver = ride.driverId === profile.id;
    const canOffer = !ride.driverId && profile.canDrive && !isRequester;
    const requesterName = esc(requester?.name || 'Jemand');
    const driverName = esc(driver?.name || 'Fahrer');

    if (ride.status === 'driver_arrived') {
      return `
        <section class="glass arrived-card status-arrived">
          <div class="arrived-icon">🚗</div>
          <div class="eyebrow">ABHOLUNG ABGESCHLOSSEN</div>
          <h1>${driverName} ist da.</h1>
          <p class="arrived-goodride">Gute Fahrt!</p>
          <div class="journey-destination">
            <span>🏁 Ziel</span>
            <b>${esc(ride.destinationLabel)}</b>
          </div>
          <button type="button" class="primary" id="closeFamilyLift">FAMILYLIFT ABSCHLIESSEN</button>
          <div id="closeError"></div>
        </section>`;
    }

    let actions = '';

    if (ride.status === 'requested' && (isDriver || canOffer)) {
      actions = `
        ${ownOffer ? `
          <div class="offer-confirmation">
            <b class="lime-check">✓ Angebot gesendet</b>
            <span>Bin da in ca. ${ownOffer.etaMinutes} Min.</span>
          </div>` : ''}
        <div class="field eta-field">
          <label>Wann bist du ungefähr da?</label>
          <div class="eta-grid eta-grid-four">
            ${[15, 30, 45].map((minutes) => `
              <button type="button" class="chip ${etaChoice === minutes ? 'selected' : ''}" data-eta="${minutes}">
                ${minutes} Min.
              </button>`).join('')}
            <button type="button" class="chip ${etaChoice === 'custom' ? 'selected' : ''}" data-eta="custom">Andere</button>
          </div>
          ${etaChoice === 'custom' ? `
            <input id="customEta" type="number" min="1" max="180" inputmode="numeric" placeholder="Minuten, 1 bis 180">` : ''}
        </div>
        <button type="button" id="offer" class="primary">
          ${isDriver ? 'ICH FAHRE' : ownOffer ? 'ANGEBOT AKTUALISIEREN' : 'FAHRT ANBIETEN'}
        </button>`;
    }

    // Legacy fallback: accepted is not a separate user step, but old records can still have this status.
    if (isDriver && ride.status === 'accepted') {
      actions = '<button type="button" id="advance" class="primary" data-action="way">ICH FAHRE</button>';
    }

    if (isDriver && ride.status === 'driver_on_the_way') {
      actions = '<button type="button" id="advance" class="primary" data-action="arrived">BIN DA</button>';
    }

    const proposals = isRequester && ride.proposals?.length
      ? `<h2>Fahrervorschläge</h2>${ride.proposals.map((offer, index) => `
          <div class="proposal">
            <b>${esc(person(offer.driverId)?.name)}</b>
            <div>Bin da in ca. ${offer.etaMinutes} Min.</div>
            <button type="button" class="primary" data-select="${index}">DIESEN VORSCHLAG WÄHLEN</button>
          </div>`).join('')}`
      : '';

    let statusEyebrow = historyLabels[ride.status] || '';
    let statusTitle = '';
    let statusMessage = '';

    if (ride.status === 'requested') {
      if (isRequester && ride.driverId) {
        statusEyebrow = 'ANGEFRAGT';
        statusTitle = `${driverName} wurde angefragt.`;
        statusMessage = 'Warte auf die Rückmeldung.';
      } else if (isRequester) {
        statusEyebrow = 'FAHRER GESUCHT';
        statusTitle = 'Wer kann mich holen?';
        statusMessage = 'Deine Anfrage ist für alle verfügbaren Fahrer sichtbar.';
      } else {
        statusEyebrow = 'NEUE ANFRAGE';
        statusTitle = `${requesterName} braucht einen Lift.`;
        statusMessage = 'Wähle, wann du ungefähr da bist.';
      }
    } else if (ride.status === 'accepted') {
      statusEyebrow = 'BESTÄTIGT';
      statusTitle = isRequester ? `${driverName} fährt.` : `Du holst ${requesterName} ab.`;
      statusMessage = ride.etaMinutes ? `In ca. ${ride.etaMinutes} Min. da.` : 'Ankunftszeit noch offen.';
    } else if (ride.status === 'driver_on_the_way') {
      statusEyebrow = 'UNTERWEGS';
      statusTitle = isRequester ? `${driverName} ist unterwegs 🚗` : `Du holst ${requesterName} ab.`;
      statusMessage = ride.etaMinutes ? `In ca. ${ride.etaMinutes} Min. da.` : 'Unterwegs zur Abholung.';
    }

    const canCancel = isRequester && ['requested', 'accepted', 'driver_on_the_way'].includes(ride.status);

    return `
      <section class="glass ride-status-card status-${ride.status}">
        <div class="ride-head">
          <div>
            <span class="eyebrow">${esc(statusEyebrow)}</span>
            <h2>${statusTitle}</h2>
            <p class="muted status-message">${statusMessage}</p>
          </div>
          <span class="badge">${driver ? driverName : 'OFFEN'}</span>
        </div>
        <div class="ride-info">
          <p>📍 ${esc(ride.pickupLabel)}</p>
          <p>🏁 ${esc(ride.destinationLabel)}</p>
          <p>👥 ${ride.passengerCount}</p>
          ${ride.note ? `<p class="note">💬 ${esc(ride.note)}</p>` : ''}
        </div>
        ${proposals}
        ${actions}
        ${canCancel ? '<button type="button" id="cancel" class="text-btn danger">Stornieren</button>' : ''}
      </section>`;
  }

  function homePage() {
    const ride = active();
    return `${header()}${ride ? rideCard(ride) : `
      <section class="glass hero">
        <h1>Brauchst du einen Lift?</h1>
        <button type="button" id="newRide" class="primary">RIDE ANFORDERN</button>
      </section>
      <section class="glass">
        <h2>Keine aktive Fahrt</h2>
        <p class="muted">Neue Anfragen erscheinen automatisch.</p>
      </section>`}`;
  }

  function requestPage() {
    const drivers = family.filter((member) => member.canDrive && member.id !== profile.id);

    return `
      <button type="button" id="back" class="back">‹ Zurück</button>
      <div class="eyebrow">NEUE ABHOLUNG</div>
      <h1>Let’s ride.</h1>
      <section class="glass">
        <div class="field">
          <label>Abholung</label>
          <button type="button" id="locate" class="secondary full ${pickup?.source === 'gps' ? 'selected' : ''}">
            ${pickup?.source === 'gps' ? '✓ Aktueller Standort erfasst' : '📍 Aktuellen Standort verwenden'}
          </button>
          <div class="or">oder</div>
          <label class="field-question" for="pickupText">Wo willst du abgeholt werden?</label>
          <input id="pickupText" value="${esc(draft.pickupText)}" placeholder="Ort eingeben">
        </div>

        <div class="field">
          <label>Wohin?</label>
          <div class="dest-grid" style="grid-template-columns:1fr">
            ${favorites.map((place) => `
              <button type="button" class="chip full ${destination?.id === place.id ? 'selected' : ''}" data-dest="${place.id}">
                🏠 ${esc(place.label)}
              </button>`).join('')}
          </div>
          <input id="destinationText" value="${esc(draft.destinationText)}" placeholder="Anderes Ziel eingeben">
        </div>

        <div class="field">
          <label>Zeitpunkt</label>
          <select id="type">
            <option value="now" ${draft.type === 'now' ? 'selected' : ''}>Sofort</option>
            <option value="later" ${draft.type === 'later' ? 'selected' : ''}>Später</option>
          </select>
        </div>

        <div class="field-grid ${draft.type === 'later' ? '' : 'hidden'}">
          <div class="field"><label>Datum</label><input id="date" type="date" value="${esc(draft.date)}"></div>
          <div class="field"><label>Uhrzeit</label><input id="time" type="time" value="${esc(draft.time)}"></div>
        </div>

        <div class="field">
          <label>Personen</label>
          <select id="people">
            ${[1, 2, 3, 4].map((count) => `<option ${draft.people == count ? 'selected' : ''}>${count}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Fahrer</label>
          <select id="driver">
            <option value="any">Wer kann mich holen?</option>
            ${drivers.map((driver) => `<option value="${driver.id}" ${draft.driver === driver.id ? 'selected' : ''}>${esc(driver.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Notiz für den Fahrer <span class="muted">optional</span></label>
          <textarea id="note" placeholder="z. B. Ausgang Nord, kurz anrufen, Gepäck dabei">${esc(draft.note)}</textarea>
        </div>

        ${formError ? `<div class="error">${esc(formError)}</div>` : ''}
        <button type="button" id="send" class="primary" ${busy ? 'disabled' : ''}>
          ${busy ? 'WIRD GESENDET …' : 'ANFRAGE SENDEN'}
        </button>
      </section>`;
  }

  function historyPage() {
    return `
      <div class="eyebrow">FAHRTEN</div>
      <h1>Verlauf</h1>
      ${rides().map((ride) => `
        <section class="glass history-card">
          <h2>${esc(person(ride.requesterId)?.name)} → ${esc(person(ride.driverId)?.name || 'Offen')}</h2>
          <p>${historyLabels[ride.status]} · ${esc(ride.pickupLabel)} → ${esc(ride.destinationLabel)}</p>
        </section>`).join('') || '<section class="glass">Noch keine Fahrten.</section>'}`;
  }

  function driverData() {
    const completed = rides().filter((ride) => ride.status === 'completed');
    return family
      .filter((member) => member.canDrive)
      .map((driver) => {
        const trips = completed.filter((ride) => ride.driverId === driver.id);
        return {
          ...driver,
          trips: trips.length,
          km: trips.reduce((sum, ride) => sum + (Number(ride.routeDistanceKm) || 0), 0)
        };
      })
      .sort((a, b) => b.km - a.km || b.trips - a.trips);
  }

  function statsPage() {
    const completed = rides().filter((ride) => ride.status === 'completed');
    const km = completed.reduce((sum, ride) => sum + (Number(ride.routeDistanceKm) || 0), 0);
    const passengers = completed.reduce((sum, ride) => sum + Number(ride.passengerCount || 0), 0);
    const aaron = driverData().find((driver) => driver.name.toLowerCase() === 'aaron') || { km: 0, trips: 0 };
    const levels = [
      { km: 250, name: 'Taxi Rookie' },
      { km: 500, name: 'Family Driver' },
      { km: 1000, name: 'Driveback Pro' },
      { km: 2500, name: 'Road Hero' },
      { km: 5000, name: 'Legend Status 😎' }
    ];
    const next = levels.find((level) => level.km > aaron.km) || { km: Math.ceil((aaron.km + 1) / 5000) * 5000, name: 'Legend Status 😎' };
    const previous = [{ km: 0, name: 'Driver Mode' }, ...levels].filter((level) => level.km <= aaron.km).pop();
    const progress = Math.min(100, Math.max(0, ((aaron.km - previous.km) / (next.km - previous.km)) * 100));
    const remaining = Math.max(0, next.km - aaron.km);

    return `
      <div class="eyebrow">FAMILY STATS</div>
      <section class="glass stats-compact">
        <div class="stats">
          <div class="stat"><b>${completed.length}</b><span>Fahrten</span></div>
          <div class="stat"><b>${km.toFixed(1)}</b><span>km</span></div>
          <div class="stat"><b>${passengers}</b><span>Personen</span></div>
        </div>
      </section>
      <section class="glass payback-card driveback-animate driveback-hero">
        <div class="eyebrow">AARON DRIVEBACK</div>
        <div class="muted">DRIVER MODE</div>
        <h2>${aaron.km.toFixed(1)} <span class="muted">km</span></h2>
        <p><b>${aaron.trips}</b> FamilyLift-Fahrten</p>
        <div class="driveback-track" style="--driveback-progress:${progress}%">
          <i></i><b></b><span class="tick t1"></span><span class="tick t2"></span><span class="tick t3"></span><span class="tick t4"></span>
        </div>
        <div class="driveback-next">
          <span>NEXT UNLOCK · ${esc(next.name)}<br>NOCH ${remaining.toFixed(1)} KM</span>
          <b>${next.km} km</b>
        </div>
        <p class="milestone-label">Driver Mode unlocked. 😎</p>
      </section>`;
  }

  function familyPage() {
    const ranking = driverData();
    const medals = ['🥇', '🥈', '🥉'];

    return `
      <div class="eyebrow">FAMILIE</div>
      <div class="family-title-row">
        <h1>FamilyLift Crew</h1>
        <span class="version-badge">1.1</span>
      </div>
      <section class="glass">
        ${family.map((member) => {
          const driver = ranking.find((entry) => entry.id === member.id);
          const rank = driver ? ranking.indexOf(driver) : -1;
          return `
            <div class="person family-person">
              <div>
                <b>${driver ? `${medals[rank] || '🚗'} ` : ''}${esc(member.name)}</b>
                <small>${member.canDrive ? 'Fahrer' : 'Mitfahrerin'}</small>
              </div>
              <div class="family-km">
                <b>${driver ? `${driver.km.toFixed(1)} km` : '–'}</b>
                <small>${driver ? `${driver.trips} Fahrten` : 'kein Fahrer-Ranking'}</small>
              </div>
            </div>`;
        }).join('')}
      </section>`;
  }

  function render() {
    const content = page === 'home'
      ? homePage()
      : page === 'request'
        ? requestPage()
        : page === 'rides'
          ? historyPage()
          : page === 'stats'
            ? statsPage()
            : familyPage();

    $('#app').innerHTML = `<main class="shell">${content}</main>${page === 'request' ? '' : navigation()}`;
    wire();
  }

  async function reload() {
    S.rides = await FamilyLiftData.getRides();
    render();
  }

  function bindDraft() {
    ['pickupText', 'destinationText', 'date', 'time', 'people', 'driver', 'note'].forEach((id) => {
      const element = $('#' + id);
      if (element) element.oninput = element.onchange = (event) => { draft[id] = event.target.value; };
    });

    if ($('#type')) {
      $('#type').onchange = (event) => {
        draft.type = event.target.value;
        render();
      };
    }
  }

  function wire() {
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.onclick = () => { page = button.dataset.page; render(); };
    });

    if ($('#logout')) $('#logout').onclick = () => confirm('FamilyLift abmelden?') && FamilyLiftLogout();
    if ($('#newRide')) $('#newRide').onclick = () => { page = 'request'; render(); };
    if ($('#back')) $('#back').onclick = () => { page = 'home'; render(); };

    bindDraft();

    document.querySelectorAll('[data-dest]').forEach((button) => {
      button.onclick = () => {
        destination = favorites.find((place) => place.id === button.dataset.dest);
        draft.destinationText = '';
        render();
      };
    });

    if ($('#destinationText')) {
      $('#destinationText').oninput = (event) => {
        draft.destinationText = event.target.value;
        destination = null;
      };
    }

    if ($('#pickupText')) {
      $('#pickupText').oninput = (event) => {
        draft.pickupText = event.target.value;
        pickup = null;
      };
    }

    if ($('#locate')) {
      $('#locate').onclick = () => navigator.geolocation.getCurrentPosition(
        (position) => {
          pickup = {
            label: 'Aktueller Standort',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            capturedAt: new Date().toISOString(),
            source: 'gps'
          };
          draft.pickupText = '';
          formError = '';
          render();
        },
        (error) => {
          formError = error.code === 1
            ? 'Standortzugriff wurde verweigert.'
            : error.code === 3
              ? 'Standortermittlung hat zu lange gedauert.'
              : 'Standort konnte nicht ermittelt werden.';
          render();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    }

    if ($('#send')) {
      $('#send').onclick = async () => {
        const pickupFinal = pickup || { label: draft.pickupText.trim(), lat: null, lng: null, capturedAt: null };
        const destinationFinal = destination || { label: draft.destinationText.trim(), lat: null, lng: null };

        if (!pickupFinal.label || !destinationFinal.label) {
          formError = 'Bitte Abholung und Ziel angeben.';
          render();
          return;
        }

        let requestedTime = new Date().toISOString();
        if (draft.type === 'later') {
          if (!draft.date || !draft.time) {
            formError = 'Bitte Datum und Uhrzeit angeben.';
            render();
            return;
          }
          requestedTime = new Date(`${draft.date}T${draft.time}`).toISOString();
        }

        busy = true;
        render();

        try {
          await FamilyLiftData.createRide({
            familyId: profile.family_id,
            requesterId: profile.id,
            driverId: draft.driver === 'any' ? null : draft.driver,
            pickupLabel: pickupFinal.label,
            pickupLatitude: pickupFinal.lat,
            pickupLongitude: pickupFinal.lng,
            pickupCapturedAt: pickupFinal.capturedAt,
            destinationLabel: destinationFinal.label,
            destinationLatitude: destinationFinal.lat,
            destinationLongitude: destinationFinal.lng,
            pickupType: draft.type,
            requestedPickupTime: requestedTime,
            passengerCount: Number(draft.people),
            note: draft.note.trim()
          });

          pickup = null;
          destination = null;
          draft = { pickupText: '', destinationText: '', type: 'now', date: '', time: '', people: '1', driver: 'any', note: '' };
          busy = false;
          page = 'home';
          await reload();
        } catch (error) {
          busy = false;
          formError = `Anfrage konnte nicht gesendet werden: ${error.message || error}`;
          render();
        }
      };
    }

    document.querySelectorAll('[data-eta]').forEach((button) => {
      button.onclick = () => {
        etaChoice = button.dataset.eta === 'custom' ? 'custom' : Number(button.dataset.eta);
        render();
      };
    });

    const ride = active();
    if (!ride) return;

    if ($('#offer')) {
      $('#offer').onclick = async () => {
        const minutes = selectedArrivalMinutes();
        if (!minutes) return alert('Bitte auswählen, wann du ungefähr da bist.');

        try {
          if (ride.driverId === profile.id) {
            await FamilyLiftData.acceptDirectRide(ride.id, minutes);
            await FamilyLiftData.driverOnTheWay(ride.id);
          } else {
            const offer = ride.proposals.find((proposal) => proposal.driverId === profile.id);
            if (offer) await FamilyLiftData.updateRideOffer(offer.id, ride.id, profile.id, minutes);
            else await FamilyLiftData.createRideOffer(ride.id, profile.id, minutes);
          }
          etaChoice = null;
          await reload();
        } catch (error) {
          alert(error.message || error);
        }
      };
    }

    document.querySelectorAll('[data-select]').forEach((button) => {
      button.onclick = async () => {
        try {
          const offer = ride.proposals[Number(button.dataset.select)];
          await FamilyLiftData.selectRideOffer(ride.id, offer.id);
          await FamilyLiftData.driverOnTheWay(ride.id);
          await reload();
        } catch (error) {
          alert(error.message || error);
        }
      };
    });

    if ($('#advance')) {
      $('#advance').onclick = async () => {
        try {
          const action = $('#advance').dataset.action;
          if (action === 'way') await FamilyLiftData.driverOnTheWay(ride.id);
          if (action === 'arrived') await FamilyLiftData.driverArrived(ride.id);
          await reload();
        } catch (error) {
          alert(error.message || error);
        }
      };
    }

    if ($('#closeFamilyLift')) {
      $('#closeFamilyLift').onclick = async () => {
        const button = $('#closeFamilyLift');
        const errorBox = $('#closeError');
        button.disabled = true;
        button.textContent = 'WIRD ABGESCHLOSSEN …';

        try {
          await FamilyLiftData.completeRide(ride.id);
          S.rides = await FamilyLiftData.getRides();
          page = 'home';
          render();
        } catch (error) {
          button.disabled = false;
          button.textContent = 'FAMILYLIFT ABSCHLIESSEN';
          errorBox.innerHTML = `<div class="error">${esc(`Abschluss fehlgeschlagen: ${error.message || error}`)}</div>`;
        }
      };
    }

    if ($('#cancel')) {
      $('#cancel').onclick = async () => {
        if (!confirm('Fahrt stornieren?')) return;
        try {
          await FamilyLiftData.cancelRide(ride.id);
          await reload();
        } catch (error) {
          alert(error.message || error);
        }
      };
    }
  }

  window.FamilyLiftRender = render;
  render();

  const syncFromBackend = async () => {
    try {
      S.rides = await FamilyLiftData.getRides();
      if (page !== 'request') render();
    } catch (error) {
      console.error('Backend sync failed', error);
    }
  };

  const unsubscribe = FamilyLiftData.subscribeToFamilyChanges(
    profile.family_id,
    syncFromBackend,
    (status) => {
      realtime = status;
      if (status === 'SUBSCRIBED' && page !== 'request') render();
    }
  );

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFromBackend();
  });
  window.addEventListener('pageshow', syncFromBackend);
  window.FamilyLiftRealtimeStop = unsubscribe;
})();
