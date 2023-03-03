'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const filter = document.querySelector('.filterdiv');
const showAllBtn = document.querySelector('.all');
const alert_txt = document.querySelector('.alert-txt');
const alert_box = document.querySelector('.alert');
const errorBtn = document.querySelector('.errbtn');
const closeFormbtn = document.querySelector('.closeFormbtn');

showAllBtn.value = 'ertyui';

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #filterkey = 0;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    errorBtn.addEventListener('click', function (e) {
      e.preventDefault();
      alert_box.classList.remove('alert_active');
      _errortimeout();
    });
    containerWorkouts.addEventListener(
      'click',
      this._deleteWorkout.bind(this),
      true
    );
    closeFormbtn.addEventListener('click', this._closeForm.bind(this));
    filter.addEventListener('click', this._filter.bind(this));
    showAllBtn.classList.add('activefilter');
  }

  _closeForm(e) {
    e.preventDefault();
    this._hideForm();
  }
  _deleteWorkout(e) {
    if (!e.target.classList.contains('delete')) return;
    const clickedEl = e.target.closest('.workout');
    if (!clickedEl) return;
    const workout = this.#workouts.find(
      workout => workout.id == clickedEl.dataset.id
    );
    const indexWorkout = this.#workouts.indexOf(workout);
    this.#workouts.splice(indexWorkout, 1);

    clickedEl.remove();
    this._removeWorkoutMarker(indexWorkout);
    this._setLocalStorage();
    // this._calculateTotals();
  }

  _removeWorkoutMarker(indexWorkout) {
    this.#map.removeLayer(this.#markers[indexWorkout]);
    this.#markers.splice(indexWorkout, 1);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert_box.classList.add('alert_active');
          alert_txt.textContent = 'Could not get your position';
          // setTimeout(() => {
          //   alert_box.classList.remove('alert_active');
          // }, 2000);
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    const showerror = function () {
      {
        alert_box.classList.add('alert_active');
        alert_txt.textContent = 'Inputs Have To Be Numbers!';
        setTimeout(() => {
          alert_box.classList.remove('alert_active');
        }, 2000);
        return;
      }
    };

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        showerror();
        return;
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        showerror();
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 350,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${
      workout.id
    }" data-type="${workout.type}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <button class='delete'> Delete </button>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <button class='delete'> Delete </button>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _filter(e) {
    const workdet = document.querySelectorAll('.workout');
    console.log(workdet);
    const clickEl = e.target.closest('.filter');
    console.log(e.target);
    if (!clickEl || !e.target.classList.contains('filter')) return;
    const runBtn = document.querySelector('.run');
    const cycBtn = document.querySelector('.cyc');

    if (e.target.classList.contains('cyc')) {
      workdet.forEach(function (work) {
        if (work.dataset.type === 'running') {
          console.log(work.dataset.type);
          work.classList.add('hideworkout');
        }

        if (work.dataset.type === 'cycling') {
          work.classList.remove('hideworkout');
        }
      });
      cycBtn.classList.add('activefilter');
      runBtn.classList.remove('activefilter');
      showAllBtn.classList.remove('activefilter');

      // cycBtn.style.backgroundColor = '#2bdc69';
      // runBtn.style.backgroundColor = '#fffdfd';
      // showALlBtn.style.backgroundColor = '#fffdfd';
    }

    if (e.target.classList.contains('run')) {
      workdet.forEach(function (work) {
        if (work.dataset.type === 'cycling') {
          work.classList.add('hideworkout');
        }

        if (work.dataset.type === 'running') {
          work.classList.remove('hideworkout');
        }
      });

      cycBtn.classList.remove('activefilter');
      runBtn.classList.add('activefilter');
      showAllBtn.classList.remove('activefilter');
    }
    if (e.target.classList.contains('all')) {
      workdet.forEach(work => work.classList.remove('hideworkout'));
      cycBtn.classList.remove('activefilter');
      runBtn.classList.remove('activefilter');
      showAllBtn.classList.add('activefilter');
    }
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
