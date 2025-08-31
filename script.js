/* ========== WeatherNow – Script (Pastel + Pixel, Favorites) ========== */
const apiKey = '476512a59cc1c78cb49b844c1a785be7';

/* ---- DOM ---- */
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const statusBox = document.getElementById('status');
const weatherCard = document.getElementById('weather-card');

const favWrap = document.getElementById('favorites-wrap');
const favContainer = document.getElementById('favorites-container');
const refreshBtn = document.getElementById('refresh-btn');

const $ = (id) => document.getElementById(id);
const refs = {
    when: $('when-text'), icon: $('cur-icon'), desc: $('cur-desc'),
    temp: $('cur-temp'), place: $('cur-place'),
    sunrise: $('sunrise'), sunset: $('sunset'), dayLength: $('day-length'),
    rain: $('rain'), humidity: $('humidity'), wind: $('wind'),
    week: $('week-grid'),
};

/* ---- Local Storage Helpers ---- */
const LS_KEY = 'we-now:favorites';
const loadFavs = () => JSON.parse(localStorage.getItem(LS_KEY) || '[]');
const saveFavs = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));
const keyOf = (s) => (s || '').trim().toLowerCase();

/* ---- Search / Add Favorite ---- */
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (!city) { setStatus('กรุณาป้อนชื่อเมือง'); return; }
    setStatus('กำลังโหลดข้อมูล...');

    try {
        await renderAll(city);
        weatherCard.classList.remove('hidden');

        const favs = loadFavs();
        if (!favs.some(c => keyOf(c) === keyOf(city))) {
            favs.push(city);        // เก็บค่าดิบที่ผู้ใช้พิมพ์
            saveFavs(favs);
            await renderFavorites();
        }

        favWrap.classList.remove('hidden');
        setStatus('');
        cityInput.value = '';
    } catch (err) {
        setStatus(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

/* ---- Refresh All Favorites ---- */
refreshBtn.addEventListener('click', async () => {
    setStatus('รีเฟรชข้อมูลเมืองโปรด...');
    await renderFavorites();
    setStatus('');
});

/* ---- Initial Load ---- */
window.addEventListener('DOMContentLoaded', async () => {
    if (loadFavs().length) {
        favWrap.classList.remove('hidden');
        await renderFavorites();
    }
});

/* ---- Render Favorites (Glass Pastel) ---- */
async function renderFavorites() {
    const favs = loadFavs();
    if (!favs.length) {
        favWrap.classList.add('hidden');
        favContainer.innerHTML = '';
        return;
    }

    const cards = await Promise.all(
        favs.map(async (rawKey) => {
            try {
                const d = await fetchCurrent(rawKey);
                const icon = d.weather?.[0]?.icon;
                const desc = d.weather?.[0]?.description || '';
                const temp = Math.round(d.main?.temp);
                const place = `${d.name}${d.sys?.country ? ', ' + d.sys.country : ''}`;

                // data-city ใช้ชื่อสำหรับเปิดดู, data-remove ใช้ "ค่าดิบ" ที่อยู่ใน localStorage
                return `
          <div class="fav-card" data-city="${place}" role="button" tabindex="0" aria-label="ดูพยากรณ์ของ ${place}">
            <img class="fav-icon" src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" width="34" height="34">
            <div class="fav-info">
              <h3 class="fav-city">${place}</h3>
              <div class="fav-desc">${capFirst(desc)}</div>
            </div>
            <div class="fav-temp">${temp}°C</div>
            <button type="button" class="fav-remove" data-remove="${rawKey}" aria-label="ลบ ${place}">×</button>
          </div>
        `;
            } catch {
                return `
          <div class="fav-card" data-city="${rawKey}">
            <div class="fav-info">
              <h3 class="fav-city">${rawKey}</h3>
              <div class="fav-desc">โหลดข้อมูลไม่สำเร็จ</div>
            </div>
            <button type="button" class="fav-remove" data-remove="${rawKey}" aria-label="ลบ ${rawKey}">×</button>
          </div>
        `;
            }
        })
    );

    favContainer.innerHTML = cards.join('');
    favWrap.classList.remove('hidden');
}

/* ---- Delegation: ลบ/เปิดการ์ด จากรายการโปรด ---- */
favContainer.addEventListener('click', async (e) => {
    // ลบเมือง
    const removeBtn = e.target.closest('button.fav-remove');
    if (removeBtn) {
        e.stopPropagation();                  // อย่าให้ไปติดคลิกการ์ด
        const removeKey = removeBtn.getAttribute('data-remove');
        const next = loadFavs().filter(c => keyOf(c) !== keyOf(removeKey));
        saveFavs(next);
        renderFavorites();
        return;
    }

    // เปิดการ์ดหลักด้วยการคลิกการ์ด
    const card = e.target.closest('.fav-card');
    if (!card) return;

    const city = card.dataset.city || card.querySelector('.fav-city')?.textContent?.trim();
    if (!city) return;

    try {
        setStatus(`กำลังโหลดข้อมูลของ ${city} ...`);
        await renderAll(city);
        weatherCard.classList.remove('hidden');
        setStatus('');
        window.scrollTo({ top: weatherCard.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    } catch (err) {
        setStatus(err.message || 'ไม่สามารถโหลดข้อมูลเมืองนี้ได้');
    }
});

/* ---- รองรับกด Enter ที่การ์ดโปรด ---- */
favContainer.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const card = e.target.closest('.fav-card');
    if (!card) return;

    const city = card.dataset.city || card.querySelector('.fav-city')?.textContent?.trim();
    if (!city) return;

    setStatus(`กำลังโหลดข้อมูลของ ${city} ...`);
    await renderAll(city);
    weatherCard.classList.remove('hidden');
    setStatus('');
});

/* ---- Render การ์ดหลัก (ปัจจุบัน + สัปดาห์) ---- */
async function renderAll(city) {
    const cur = await fetchCurrent(city);
    const fc = await fetchForecast(cur.coord.lat, cur.coord.lon);

    const tz = fc.city.timezone ?? 0;
    refs.when.textContent = toLocalDateTime(Date.now(), tz);
    refs.desc.textContent = capFirst(cur.weather?.[0]?.description || '—');
    refs.temp.textContent = `${Math.round(cur.main.temp)}°C`;
    refs.place.textContent = `${cur.name}${cur.sys?.country ? ', ' + cur.sys.country : ''}`;
    refs.icon.src = `https://openweathermap.org/img/wn/${cur.weather?.[0]?.icon}@2x.png`;
    refs.icon.alt = cur.weather?.[0]?.description || '';

    const sr = cur.sys.sunrise * 1000, ss = cur.sys.sunset * 1000;
    refs.sunrise.textContent = toLocalTime(sr, tz);
    refs.sunset.textContent = toLocalTime(ss, tz);
    refs.dayLength.textContent = humanizeDuration(ss - sr);

    const next = fc.list[0];
    const pop = typeof next?.pop === 'number' ? Math.round(next.pop * 100) : 0;
    refs.rain.textContent = `${pop}%`;
    refs.humidity.textContent = `${cur.main.humidity}%`;
    refs.wind.textContent = `${Math.round(cur.wind.speed * 3.6)} km/h`;

    renderWeek(fc);
}

/* ---- Fetchers ---- */
async function fetchCurrent(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=th`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ไม่พบข้อมูลเมืองนี้');
    return res.json();
}
async function fetchForecast(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=th`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ดึงข้อมูลพยากรณ์ไม่ได้');
    return res.json();
}

/* ---- Week Grid ---- */
function renderWeek(fc) {
    const tz = fc.city.timezone ?? 0;
    const byDay = {};
    for (const item of fc.list) {
        const key = toLocalDate(item.dt * 1000, tz);
        (byDay[key] ||= []).push(item);
    }
    const days = Object.keys(byDay).slice(0, 7).map(d => {
        const arr = byDay[d];
        const max = Math.round(Math.max(...arr.map(x => x.main.temp_max)));
        const min = Math.round(Math.min(...arr.map(x => x.main.temp_min)));
        const mid = pickAroundHour(arr, 12) || arr[Math.floor(arr.length / 2)];
        const icon = mid.weather[0].icon;
        const alt = mid.weather[0].description;
        return { name: dayName(d), max, min, icon, alt };
    });

    refs.week.innerHTML = days.map(d => `
    <div class="day">
      <div class="name">${d.name}</div>
      <img src="https://openweathermap.org/img/wn/${d.icon}.png" alt="${d.alt}">
      <div class="max">${d.max}°</div>
      <div class="min">${d.min}°</div>
    </div>
  `).join('');
}

/* ---- Utils ---- */
function setStatus(msg) { statusBox.textContent = msg || ''; }
function capFirst(s) { return (s || '').slice(0, 1).toUpperCase() + (s || '').slice(1); }
function toLocalTime(ms, tzOffsetSec) { const d = new Date(ms + tzOffsetSec * 1000); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function toLocalDateTime(ms, tzOffsetSec) { const d = new Date(ms + tzOffsetSec * 1000); const day = d.toLocaleDateString('en-GB', { weekday: 'long' }); const tm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return `${day}, ${tm}`; }
function toLocalDate(ms, tzOffsetSec) { const d = new Date(ms + tzOffsetSec * 1000); const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0'); return `${y}-${m}-${dd}`; }
function dayName(dateStr) { return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' }); }
function humanizeDuration(ms) { const m = Math.round(ms / 60000); const h = Math.floor(m / 60), mm = m % 60; return `${h} h ${mm} m`; }
function pickAroundHour(arr, hour) { let best = null, diff = 1e9; for (const it of arr) { const h = new Date(it.dt * 1000).getUTCHours(); const d = Math.abs(h - hour); if (d < diff) { diff = d; best = it; } } return best; }
/* ========== End of Script ========== */