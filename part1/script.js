/* ===== WeatherNow — Part 1 (Search-only) ===== */
/* TODO: ใส่ API Key ของคุณที่นี่ (จาก OpenWeather) */
const apiKey = '476512a59cc1c78cb49b844c1a785be7';

/* DOM refs */
const form = document.getElementById('search-form');
const input = document.getElementById('city-input');
const statusBox = document.getElementById('status');

const $ = (id) => document.getElementById(id);
const refs = {
    when: $('when-text'),
    icon: $('cur-icon'),
    desc: $('cur-desc'),
    temp: $('cur-temp'),
    place: $('cur-place'),
    sunrise: $('sunrise'),
    sunset: $('sunset'),
    dayLength: $('day-length'),
    rain: $('rain'),
    humidity: $('humidity'),
    wind: $('wind'),
    week: $('week-grid'),
};

/* Submit -> ค้นหา */
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // เตือนถ้ายังไม่ได้ใส่ API key
    if (!apiKey || /YOUR_API_KEY_HERE/i.test(apiKey)) {
        setStatus('โปรดใส่ API Key ในไฟล์ script.js ก่อนใช้งาน');
        return;
    }

    const city = input.value.trim();
    if (!city) { setStatus('กรุณาพิมพ์ชื่อเมือง'); return; }

    setStatus('กำลังโหลดข้อมูล...');
    try {
        await renderAll(city);
        setStatus('');
    } catch (err) {
        setStatus(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

/* ===== Render Main Card ===== */
async function renderAll(city) {
    const cur = await fetchCurrent(city);
    const fc = await fetchForecast(cur.coord.lat, cur.coord.lon);

    // เวลา/เขตเวลา/ข้อความหลัก
    const tz = fc.city.timezone ?? 0;
    refs.when.textContent = toLocalDateTime(Date.now(), tz);
    refs.desc.textContent = capFirst(cur.weather?.[0]?.description || '—');
    refs.temp.textContent = `${Math.round(cur.main.temp)}°C`;
    refs.place.textContent = `${cur.name}${cur.sys?.country ? ', ' + cur.sys.country : ''}`;
    refs.icon.src = `https://openweathermap.org/img/wn/${cur.weather?.[0]?.icon}@2x.png`;
    refs.icon.alt = cur.weather?.[0]?.description || '';

    // พระอาทิตย์ / ความยาวกลางวัน
    const sr = cur.sys.sunrise * 1000, ss = cur.sys.sunset * 1000;
    refs.sunrise.textContent = toLocalTime(sr, tz);
    refs.sunset.textContent = toLocalTime(ss, tz);
    refs.dayLength.textContent = humanizeDuration(ss - sr);

    // Metrics
    const next = fc.list[0];
    const pop = typeof next?.pop === 'number' ? Math.round(next.pop * 100) : 0;
    refs.rain.textContent = `${pop}%`;
    refs.humidity.textContent = `${cur.main.humidity}%`;
    refs.wind.textContent = `${Math.round(cur.wind.speed * 3.6)} km/h`;

    // Week (5 วัน)
    renderWeek(fc);
}

/* ===== Fetchers ===== */
async function fetchCurrent(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=th`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('API Key ไม่ถูกต้อง หรือยังไม่ Active (ตรวจสอบใน OpenWeather)');
    if (res.status === 404) throw new Error(`ไม่พบเมือง "${city}"`);
    if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้');
    return res.json();
}
async function fetchForecast(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=th`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('API Key ไม่ถูกต้อง หรือยังไม่ Active (ตรวจสอบใน OpenWeather)');
    if (!res.ok) throw new Error('ดึงข้อมูลพยากรณ์ไม่ได้');
    return res.json();
}

/* ===== Week grid ===== */
function renderWeek(fc) {
    const tz = fc.city.timezone ?? 0;
    const byDay = {};
    for (const item of fc.list) {
        const key = toLocalDate(item.dt * 1000, tz);
        (byDay[key] ||= []).push(item);
    }
    const days = Object.keys(byDay).slice(0, 5).map(d => {
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

/* ===== Utils ===== */
function setStatus(msg) { statusBox.textContent = msg || '' }
function capFirst(s) { return (s || '').slice(0, 1).toUpperCase() + (s || '').slice(1) }
function toLocalTime(ms, tzOffsetSec) {
    const d = new Date(ms + tzOffsetSec * 1000);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function toLocalDateTime(ms, tzOffsetSec) {
    const d = new Date(ms + tzOffsetSec * 1000);
    const day = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const tm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}, ${tm}`;
}
function toLocalDate(ms, tzOffsetSec) {
    const d = new Date(ms + tzOffsetSec * 1000);
    const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function dayName(dateStr) { return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' }) }
function humanizeDuration(ms) {
    const m = Math.round(ms / 60000);
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h} h ${mm} m`;
}
function pickAroundHour(arr, hour) {
    let best = null, diff = 1e9;
    for (const it of arr) {
        const h = new Date(it.dt * 1000).getUTCHours();
        const d = Math.abs(h - hour);
        if (d < diff) { diff = d; best = it; }
    }
    return best;
}
/* ===== WeatherNow — Part 1  ===== */