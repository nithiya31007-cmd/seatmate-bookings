import { useEffect, useMemo, useRef, useState } from 'react';
import TearTicket from '../TearTicket.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const SHIFTS = {
  early: { label: '3:15 PM', window: '2:45–3:05 PM', icon: '🌤️' },
  late: { label: '5:00 PM', window: '4:45–5:00 PM', icon: '🌇' }
};

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function normalizeSearch(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((term) => term && !['bus', 'buses', 'route', 'no', 'number'].includes(term)).join(' ');
}

function StepHeading({ number, eyebrow, children, action }) {
  return (
    <div className={`step-heading${action ? ' step-heading-spread' : ''}`}>
      <div className="step-heading">
        <span className="step-number" aria-hidden="true">{number}</span>
        <div><p className="eyebrow">{eyebrow}</p><h2>{children}</h2></div>
      </div>
      {action}
    </div>
  );
}

function BookingDetails({ booking }) {
  return (
    <dl className="booking-details">
      <dt>Route No</dt><dd>{booking.routeNo}</dd>
      <dt>Route</dt><dd>Thandalam → {booking.destination}</dd>
      <dt>Seat</dt><dd>{booking.seat}</dd>
      <dt>Departure</dt><dd>{formatTime(booking.departure)}</dd>
      <dt>Date</dt><dd>{formatDate(booking.date)}</dd>
    </dl>
  );
}

function RouteMap({ destination }) {
  return (
    <div className="route-visual">
      <div className="route-visual-top"><span><i /> ROUTE PREVIEW</span><span className="schematic-tag">SCHEMATIC</span></div>
      <svg className="route-visual-map" viewBox="0 0 440 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="map-road" d="M-10 73 C48 70 45 27 112 37 S187 87 240 59 318 19 367 42 405 71 450 20" />
        <path className="map-route" d="M-10 73 C48 70 45 27 112 37 S187 87 240 59 318 19 367 42 405 71 450 20" />
      </svg>
      <span className="map-point map-point-start">T</span><span className="map-point map-point-stop">•</span>
      <span className="map-point map-point-end">↗</span>
      <div className="map-labels"><span>Thandalam</span><span>{destination}</span></div>
    </div>
  );
}

function RouteCard({ route, shift, alreadyBooked, onBook }) {
  const shiftDetails = SHIFTS[shift];
  const demoOpen = route.demoBookingOpen === true;
  const open = demoOpen || route.bookingStatus === 'Booking open';
  return (
    <article className="bus-card route-slide-next" tabIndex="-1">
      <div className="bus-card-top"><span className="bus-number">ROUTE {route.routeNo}</span><span className="departure-badge">{shiftDetails.label}</span></div>
      <RouteMap destination={route.destination} />
      <h3 className="route-destination">{route.destination}</h3>
      <dl className="bus-details">
        <dt>Route</dt><dd>Thandalam → {route.destination}</dd>
        <dt>Stops</dt><dd>{route.stops.join(' · ')}</dd>
        <dt>Departure</dt><dd>{shiftDetails.label}</dd>
        <dt>Seats available to book</dt><dd>{route.seatsAvailable}</dd>
      </dl>
      <div className="bus-status-row">
        <span className={`booking-status ${open ? 'status-open' : 'status-closed'}`}>
          {demoOpen ? 'Demo booking open' : open ? `Booking open · until ${shiftDetails.window.split('–')[1]}` : route.bookingStatus}
        </span>
        {route.staffOnly && <span className="capacity-status">Staff only</span>}
        {!route.staffOnly && route.seatsAvailable === 0 && <span className="capacity-status">Fully booked</span>}
        {alreadyBooked && !route.staffOnly && <span className="capacity-status">You have booked this shift</span>}
        {route.demoReservedSeat && <span className="capacity-status">Demo: seat {String(route.demoReservedSeat).padStart(2, '0')} already booked</span>}
      </div>
      <details className="route-disclosure"><summary>View Route</summary><ol>{route.stops.map((stop, index) => <li key={`${stop}-${index}`}>{stop}</li>)}</ol></details>
      <div className="bus-actions">
        <button className="primary-button compact-button" type="button" disabled={route.staffOnly || !open || route.seatsAvailable === 0 || alreadyBooked} onClick={() => onBook(route)}>
          Book Seat
        </button>
      </div>
    </article>
  );
}

function Ticket({ booking, onTear, onTorn, busy }) {
  const root = useRef(null);
  const actions = useRef({ onTear, onTorn });
  actions.current = { onTear, onTorn };

  useEffect(() => {
    const text = (parent, tag, className, value) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      parent.append(element);
      return element;
    };
    const routeContent = document.createElement('div');
    routeContent.className = 'ticket-main-content';
    text(routeContent, 'span', 'ticket-brand', 'SEATMATE · EVENING BUS');
    text(routeContent, 'h3', 'ticket-title', `Route ${booking.routeNo}`);
    text(routeContent, 'p', 'ticket-subtitle', `Thandalam → ${booking.destination}`);
    const routeArt = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    routeArt.setAttribute('viewBox', '0 0 300 100');
    routeArt.setAttribute('aria-hidden', 'true');
    routeArt.classList.add('ticket-route-art');
    routeArt.innerHTML = '<path d="M-10 79 C40 72 43 25 98 37 S158 85 202 56 254 22 310 30" class="ticket-route-shadow"/><path d="M-10 79 C40 72 43 25 98 37 S158 85 202 56 254 22 310 30" class="ticket-route-line"/><circle cx="34" cy="70" r="7" class="ticket-route-stop"/><circle cx="152" cy="71" r="7" class="ticket-route-stop"/><circle cx="264" cy="29" r="7" class="ticket-route-stop"/>';
    routeContent.append(routeArt);
    text(routeContent, 'span', 'ticket-route-origin', 'THANDALAM CAMPUS');

    const stub = document.createElement('div');
    stub.className = 'ticket-stub-content';
    text(stub, 'h3', 'ticket-stub-title', 'Admit one');
    text(stub, 'p', 'ticket-stub-route', `Route ${booking.routeNo} · ${booking.destination}`);
    const metadata = document.createElement('div');
    metadata.className = 'ticket-metadata';
    for (const [label, value] of [
      ['DATE', formatDate(booking.date)],
      ['DEPARTURE', formatTime(booking.departure)],
      ['SEAT', String(booking.seat).padStart(2, '0')]
    ]) {
      const field = document.createElement('div');
      text(field, 'span', 'ticket-field-label', label);
      text(field, 'strong', '', value);
      metadata.append(field);
    }
    stub.append(metadata);
    text(stub, 'span', 'ticket-number', `NO. ${String(booking.id).padStart(6, '0')}`);

    const ticket = TearTicket({
      stub,
      children: routeContent,
      orientation: 'horizontal',
      scrim: true,
      imageRadius: 8,
      onTear: () => actions.current.onTear(),
      onTorn: () => actions.current.onTorn(),
      width: 460,
      height: 250,
      stubSize: 150,
      radius: 16,
      holes: 12,
      holeSize: 6,
      notch: 3,
      roughness: 0,
      tearAngle: 30,
      stretch: 30,
      resistance: 0.45,
      rotate: 0,
      tilt: true,
      tiltMax: 9,
      tiltReach: 260,
      parallax: 6,
      perspective: 1000,
      background: '#241033',
      color: '#fffaff',
      stubBackground: '#f8efff',
      border: true,
      borderWidth: 1,
      recenter: true
    });
    ticket.classList.add('history-slide');
    root.current?.append(ticket);
    return () => ticket.remove();
  }, [booking.id, booking.routeNo, booking.destination, booking.date, booking.departure, booking.seat]);

  return <div ref={root} aria-busy={busy} />;
}

export default function App() {
  const [email, setEmail] = useState(() => sessionStorage.getItem('seatmate-email') || '');
  const [step, setStep] = useState(() => sessionStorage.getItem('seatmate-email') ? 'shift' : 'login');
  const [shift, setShift] = useState('');
  const [routes, setRoutes] = useState([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [routeIndex, setRouteIndex] = useState(0);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(0);
  const [booking, setBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [notice, setNotice] = useState({ message: '', error: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(() => sessionStorage.getItem('seatmate-email') || '');
  const [tornBookingId, setTornBookingId] = useState(null);
  const emailInput = useRef(null);
  const heading = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('is-authenticated', Boolean(email));
    if (step !== 'login') {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [email, step]);

  const matches = useMemo(() => {
    const search = normalizeSearch(routeSearch);
    const query = search.replace(/\s+/g, '');
    return routes.filter((route) => {
      const searchable = normalizeSearch(`${route.routeNo} ${route.destination} ${route.stops.join(' ')}`);
      return !search || search.split(' ').every((term) => searchable.includes(term));
    }).sort((left, right) => {
      if (!query) return 0;
      const leftNumber = left.routeNo.toLowerCase();
      const rightNumber = right.routeNo.toLowerCase();
      const leftRank = leftNumber === query ? 0 : leftNumber.startsWith(query) ? 1 : 2;
      const rightRank = rightNumber === query ? 0 : rightNumber.startsWith(query) ? 1 : 2;
      return leftRank - rightRank;
    });
  }, [routes, routeSearch]);

  const currentRouteIndex = Math.min(routeIndex, Math.max(0, matches.length - 1));
  const currentRoute = matches[currentRouteIndex];

  async function handleLogin(event) {
    event.preventDefault();
    const normalizedEmail = loginEmail.trim().toLowerCase();
    setLoading(true);
    setNotice({ message: '', error: false });
    try {
      await requestJson('/api/login', { method: 'POST', body: formBody({ email: normalizedEmail }) });
      sessionStorage.setItem('seatmate-email', normalizedEmail);
      setEmail(normalizedEmail);
      setLoginEmail(normalizedEmail);
      setStep('shift');
    } catch (requestError) {
      setNotice({ message: requestError.message, error: true });
    } finally {
      setLoading(false);
    }
  }

  async function selectShift(nextShift) {
    setShift(nextShift);
    setRouteSearch('');
    setRouteIndex(0);
    setError('');
    setNotice({ message: '', error: false });
    setLoading(true);
    setStep('bus');
    try {
      const [result, bookingResult] = await Promise.all([
        requestJson(`/api/routes?shift=${encodeURIComponent(nextShift)}`),
        requestJson(`/api/bookings?email=${encodeURIComponent(email)}`)
      ]);
      setAlreadyBooked(bookingResult.bookings.some((item) => item.shift === nextShift));
      const normalizedRoutes = result.routes.map((route) => {
        const demoSeat = Object.hasOwn(route, 'demoReservedSeat')
          ? route.demoReservedSeat
          : route.demoBookingOpen && nextShift === 'early' && route.routeNo === '1C' ? 8 : null;
        if (demoSeat === null || route.bookedSeats.includes(demoSeat)) return { ...route, demoReservedSeat: demoSeat };
        return {
          ...route,
          demoReservedSeat: demoSeat,
          seatsAvailable: route.seatsAvailable - 1,
          bookedSeats: [...route.bookedSeats, demoSeat].sort((a, b) => a - b),
          availableSeats: route.availableSeats.filter((seat) => seat !== demoSeat)
        };
      });
      setRoutes(normalizedRoutes);
    } catch (requestError) {
      setRoutes([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function openSeatPicker(route) {
    setSelectedRoute(route);
    setSelectedSeat(0);
    setError(route.availableSeats.length ? '' : 'This bus is fully booked. Please check another route.');
    setStep('seat');
  }

  async function confirmBooking(event) {
    event.preventDefault();
    if (!selectedRoute || selectedSeat < 1) {
      setError('Choose an available seat before confirming.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await requestJson('/api/bookings', {
        method: 'POST',
        body: formBody({
          email,
          routeNo: selectedRoute.routeNo,
          shift,
          seat: String(selectedSeat)
        })
      });
      setBooking(result);
      setStep('confirmation');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(history = false) {
    setStep(history ? 'history' : 'my-booking');
    setLoading(true);
    setError('');
    try {
      const result = await requestJson(`/api/bookings?email=${encodeURIComponent(email)}${history ? '&history=all' : ''}`);
      setBookings(result.bookings);
      setHistoryIndex(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function tearBooking(item) {
    setTornBookingId(item.id);
    try {
      await requestJson('/api/bookings', {
        method: 'DELETE',
        body: formBody({ email, bookingId: String(item.id) })
      });
    } finally {
      setTornBookingId(null);
    }
  }

  function finishTear(item) {
    const next = bookings.filter((saved) => saved.id !== item.id);
    setBookings(next);
    setHistoryIndex((index) => Math.min(index, Math.max(0, next.length - 1)));
    setNotice({ message: 'Ticket torn. Booking removed and the seat is available again.', error: false });
  }

  function logout() {
    sessionStorage.removeItem('seatmate-email');
    setEmail('');
    setLoginEmail('');
    setShift('');
    setRoutes([]);
    setSelectedRoute(null);
    setNotice({ message: '', error: false });
    setError('');
    setStep('login');
  }

  function moveRoute(direction) {
    setRouteIndex((index) => Math.max(0, Math.min(matches.length - 1, index + direction)));
  }

  function changeSearch(value) {
    setRouteSearch(value);
    setRouteIndex(0);
  }

  const currentBooking = bookings[historyIndex];

  return (
    <div className="page-shell">
      <header className="brand-banner">
        <a className="brand-link" href="./" aria-label="SeatMate home">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}seatmate-logo.jpg`} alt="" />
          <span className="brand-copy"><span className="brand-name">SeatMate</span><span className="brand-caption">Thandalam Campus Transport</span></span>
        </a>
        {email && <div className="account-tools">
          <span className="account-email">{email}</span>
          <button className="header-button" type="button" onClick={() => loadBookings(true)}>Booking history</button>
          <button className="header-button" type="button" onClick={logout}>Log out</button>
        </div>}
      </header>

      <main>
        {step === 'login' && <section className="page-intro" aria-labelledby="page-title"><p className="eyebrow">Evening buses · Thandalam campus</p><h1 id="page-title">Welcome to SeatMate</h1><p>Choose your evening ride and reserve one seat for yourself.</p></section>}
        {notice.message && <div className={`notice${notice.error ? ' notice-error' : ''}`} role={notice.error ? 'alert' : 'status'} aria-live="polite">{notice.message}</div>}

        {step === 'login' && <section className="step-card step-arrive" aria-labelledby="email-heading">
          <div className="login-layout">
            <div
              className="login-hero"
              style={{ '--login-hero-image': `url("${import.meta.env.BASE_URL}seatmate-login-hero.jpg")` }}
            >
              <div className="hero-route-tag"><span /> THANDALAM CAMPUS · EVENING SERVICE</div>
              <div className="hero-copy"><p className="hero-kicker">EVENING BUS BOOKING</p><h2>Your ride home,<br />made simple.</h2><p>Find your Thandalam campus route and book one seat for yourself.</p></div>
              <button className="hero-cta" type="button" onClick={() => { emailInput.current?.focus(); emailInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Get started <span aria-hidden="true">→</span></button>
            </div>
            <div className="login-panel">
              <StepHeading number="01" eyebrow="Your ride starts here">Welcome to SeatMate</StepHeading>
              <p className="login-intro">Log in with your email to explore Thandalam evening routes.</p>
              <form className="email-form" onSubmit={handleLogin}>
                <label htmlFor="college-email">Email address</label>
                <div className="email-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="m5 7 7 5 7-5" /></svg>
                  <input ref={emailInput} id="college-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength="190" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
                </div>
                <p className="field-help">Demo login accepts any valid email without verification. Anyone who enters an email can view bookings saved under it; use a demo email.</p>
                <button className="primary-button" type="submit" disabled={loading}><span>{loading ? 'Signing in…' : 'Continue'}</span><span className="button-arrow" aria-hidden="true">→</span></button>
              </form>
              {notice.error && <p className="form-error" role="alert">{notice.message}</p>}
              <div className="login-bottom-note"><span className="secure-dot" /> Quick access · No password required</div>
            </div>
          </div>
        </section>}

        {step === 'shift' && <section className="step-card step-arrive" aria-labelledby="shift-heading">
          <StepHeading number="2" eyebrow="Pick a departure">Select your evening shift</StepHeading>
          <div className="shift-grid">{Object.entries(SHIFTS).map(([key, details]) => <button className="shift-card" type="button" key={key} onClick={() => selectShift(key)}>
            <span className="shift-icon" aria-hidden="true">{details.icon}</span><span className="shift-time">{details.label}</span>
            <span className="shift-window">Books {details.window}</span><span className="shift-arrow" aria-hidden="true">→</span>
          </button>)}</div>
        </section>}

        {step === 'bus' && <section className="step-card step-arrive" aria-labelledby="bus-heading">
          <StepHeading number="3" eyebrow={shift ? `Selected shift · ${SHIFTS[shift].label}` : 'Pick a departure'} action={<button className="text-button" type="button" onClick={() => setStep('shift')}>Change shift</button>}>Buses and routes</StepHeading>
          <p className="section-help">Routes stay visible when booking is closed. Seats count reservations, not physical occupancy. Route 41C is staff-only.</p>
          <form className="route-search" role="search" onSubmit={(event) => { event.preventDefault(); const card = document.querySelector('.bus-card'); card?.focus({ preventScroll: true }); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
            <label htmlFor="route-search-input">Search by bus number, destination, or stop</label>
            <div className="route-search-row"><input id="route-search-input" type="search" list="route-suggestions" placeholder="For example, 1C, Ennore, or Central" autoComplete="off" value={routeSearch} onChange={(event) => changeSearch(event.target.value)} />
              <datalist id="route-suggestions">{routes.map((route) => <option key={route.routeNo} value={`${route.routeNo} - ${route.destination}`} />)}</datalist>
              <button className="primary-button compact-button" type="submit">Search</button>
            </div>
            <p className="route-search-result" aria-live="polite">{loading ? 'Loading routes from the SeatMate database…' : error || (matches.length ? routeSearch ? `${matches.length} matching ${matches.length === 1 ? 'bus' : 'buses'}` : `${routes.length} buses available` : routeSearch ? 'No matching buses. Try a route number, destination, or stop.' : 'No routes are scheduled for this shift.')}</p>
          </form>
          <div className="route-slider" aria-live="polite">
            <div className="bus-list">{!loading && !error && currentRoute && <RouteCard route={currentRoute} shift={shift} alreadyBooked={alreadyBooked} onBook={openSeatPicker} />}</div>
            {!loading && !error && matches.length > 1 && <div className="route-controls">
              <button className="secondary-button route-nav-button" type="button" onClick={() => moveRoute(-1)} disabled={currentRouteIndex === 0}>← Previous</button>
              <span className="route-position">{currentRouteIndex + 1} of {matches.length} routes</span>
              <button className="secondary-button route-nav-button" type="button" onClick={() => moveRoute(1)} disabled={currentRouteIndex === matches.length - 1}>Next →</button>
            </div>}
          </div>
          <button className="text-button my-booking-button" type="button" onClick={() => loadBookings(false)}>View My Booking</button>
        </section>}

        {step === 'seat' && selectedRoute && <section className="step-card step-arrive" aria-labelledby="seat-heading">
          <StepHeading number="4" eyebrow={`Route ${selectedRoute.routeNo} · Thandalam → ${selectedRoute.destination}`}>Choose one seat for yourself</StepHeading>
          <p className="section-help">Only seats available to book are shown. Each student or teacher may select one seat for themselves.</p>
          <form onSubmit={confirmBooking}>
            <fieldset className="seat-fieldset"><legend>Choose your seat</legend>
              <div className="seat-legend" aria-label="Seat availability legend"><span><i className="legend-dot legend-available" />Available</span><span><i className="legend-dot legend-selected" />Selected</span><span><i className="legend-dot legend-unavailable" />Booked</span></div>
              <div className="bus-cabin" aria-label="Bus seating layout, viewed from above">
                <div className="bus-front"><span className="front-label">FRONT OF BUS</span><span className="driver-area"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" /><circle cx="16" cy="16" r="3" /><path d="M8 10h16M16 19v7M13 16l-5 2M19 16l5 2" /></svg>Driver</span><span className="front-door">ENTRY</span></div>
                <div className="seat-grid">{Array.from({ length: selectedRoute.capacity }, (_, index) => index + 1).map((seat) => {
                  const unavailable = selectedRoute.bookedSeats.includes(seat);
                  const seatIndex = seat - 1;
                  const seatInRow = seatIndex % 5;
                  return <label className={`seat-option${unavailable ? ' seat-unavailable' : ''}`} key={seat} style={{ gridColumn: seatInRow < 3 ? seatInRow + 1 : seatInRow + 2, gridRow: Math.floor(seatIndex / 5) + 1 }}>
                    <input type="radio" name="seat" value={seat} disabled={unavailable} checked={selectedSeat === seat} aria-label={`Seat ${seat}${unavailable ? ', booked' : ', available'}`} onChange={() => { setSelectedSeat(seat); setError(''); }} />
                    <span className="seat-number">{seat}</span>
                  </label>;
                })}</div>
                <div className="bus-rear"><span>REAR OF BUS</span></div>
              </div>
            </fieldset>
            <div className="seat-summary"><span className="seat-summary-label">YOUR SELECTION</span><strong>{selectedSeat ? `Seat ${String(selectedSeat).padStart(2, '0')}` : 'Choose a seat to continue'}</strong><span className="seat-summary-meta">{SHIFTS[shift].label} departure · {selectedSeat ? 'one seat for you' : 'one seat per person'}</span></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions"><button className="secondary-button" type="button" onClick={() => selectShift(shift)}>Back to buses</button><button className="primary-button" type="submit" disabled={!selectedSeat || loading}>{loading ? 'Confirming…' : 'Confirm booking'}</button></div>
          </form>
        </section>}

        {step === 'confirmation' && booking && <section className="step-card confirmation-card step-arrive" aria-labelledby="confirmation-heading">
          <div className="confirmation-icon" aria-hidden="true">✓</div><p className="eyebrow">Your seat is reserved</p><h2 id="confirmation-heading" ref={heading} tabIndex="-1">Booking confirmed!</h2>
          <BookingDetails booking={booking} />
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setStep('shift')}>Book another shift</button><button className="primary-button" type="button" onClick={() => loadBookings(false)}>View My Booking</button></div>
        </section>}

        {step === 'my-booking' && <section className="step-card step-arrive" aria-labelledby="my-booking-heading">
          <StepHeading number="✓" eyebrow="Your Thandalam rides">My Booking</StepHeading>
          {loading ? <p className="loading-message">Loading your bookings…</p> : error ? <p className="form-error" role="alert">{error}</p> : bookings.length === 0 ? <p className="empty-booking">No bookings found for today. You can book one seat for each evening shift.</p> : bookings.map((item) => <article className="saved-booking" key={item.id}><h3>{formatTime(item.departure)} · Route {item.routeNo}</h3><BookingDetails booking={item} /></article>)}
          <button className="secondary-button" type="button" onClick={() => setStep('shift')}>Back to evening shifts</button>
        </section>}

        {step === 'history' && <section className="step-card step-arrive" aria-labelledby="history-heading">
          <StepHeading number="↺" eyebrow="Past and current reservations" action={<button className="text-button" type="button" onClick={() => setStep('shift')}>Back</button>}>Booking history</StepHeading>
          {loading ? <p className="loading-message">Loading booking history…</p> : error ? <p className="form-error" role="alert">{error}</p> : !currentBooking ? <p className="empty-booking">You don't have any bookings yet.</p> : <>
            <Ticket booking={currentBooking} busy={tornBookingId === currentBooking.id} onTear={() => tearBooking(currentBooking)} onTorn={() => finishTear(currentBooking)} />
            {bookings.length > 1 && <div className="route-controls">
              <button className="secondary-button route-nav-button" type="button" onClick={() => setHistoryIndex((index) => Math.max(0, index - 1))} disabled={historyIndex === 0}>← Previous</button>
              <span className="route-position">{historyIndex + 1} of {bookings.length} bookings</span>
              <button className="secondary-button route-nav-button" type="button" onClick={() => setHistoryIndex((index) => Math.min(bookings.length - 1, index + 1))} disabled={historyIndex === bookings.length - 1}>Next →</button>
            </div>}
          </>}
        </section>}
      </main>

      <footer><p>SeatMate · Evening buses only</p><p className="footer-note">Demo login only · Booking history is not private without verified sign-in.</p></footer>
    </div>
  );
}
