const STORAGE_KEY = 'tripSyncData_v2';
const OLD_STORAGE_KEY = 'tripSyncData';

let appData = {
    currentTripId: null,
    trips: {}
};

let dayCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    initData();
    if (!appData.currentTripId) {
        createNewTrip();
    } else {
        loadTripIntoBuilder(appData.currentTripId);
    }
});

// --- Data & Local Storage Management ---

function generateId() {
    return 'trip_' + Math.random().toString(36).substr(2, 9);
}

function initData() {
    const dataStr = localStorage.getItem(STORAGE_KEY);
    if (dataStr) {
        try {
            appData = JSON.parse(dataStr);
        } catch(e) {
            console.error("Parse error for v2 data", e);
        }
    } else {
        const oldDataStr = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldDataStr) {
            try {
                const oldTrip = JSON.parse(oldDataStr);
                const newId = generateId();
                appData.trips[newId] = oldTrip;
                appData.trips[newId].lastModified = Date.now();
                appData.currentTripId = newId;
                saveAppData();
                localStorage.removeItem(OLD_STORAGE_KEY);
            } catch(e) {}
        }
    }
}

function saveAppData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error("Failed to save to local storage (likely quota exceeded):", e);
        // We do not alert on every keystroke, but the catch prevents the app from breaking.
        if (e.name === 'QuotaExceededError') {
            console.warn("Storage quota exceeded. Some recent images may not be saved permanently.");
        }
    }
}

function autoSave() {
    if (!appData.currentTripId) return;

    const state = {
        tripTitle: document.getElementById('tripTitleInput').value,
        routeSummary: document.getElementById('routeSummaryInput').value,
        duration: document.getElementById('durationInput').value,
        coverImage: document.getElementById('docHeaderBanner').style.backgroundImage,
        lastModified: Date.now(),
        days: []
    };

    document.querySelectorAll('.day-panel').forEach(panel => {
        const dayId = panel.dataset.dayId;
        const route = panel.querySelector('.day-route-input').value;
        const transport = panel.querySelector('.day-transport-input').value;
        const date = panel.querySelector('.day-date-input').value;
        const stay = panel.querySelector('.day-stay-input').value;
        
        const images = [];
        panel.querySelectorAll('.thumb-container img').forEach(img => {
            images.push({ src: img.src, fit: img.dataset.fit || 'cover' });
        });

        const activities = [];
        panel.querySelectorAll('.activity-row').forEach(row => {
            activities.push({
                time: row.querySelector('.act-time').value,
                desc: row.querySelector('.act-desc').value,
                notes: row.querySelector('.act-notes').value
            });
        });

        state.days.push({ dayId, route, transport, date, stay, images, activities });
    });

    appData.trips[appData.currentTripId] = state;
    
    saveAppData(); // Safe to fail now due to try-catch
    updatePreview(); // Always run so the UI stays synced!
}

// --- Multi-Trip Actions ---

function createNewTrip() {
    const newId = generateId();
    appData.currentTripId = newId;
    appData.trips[newId] = {
        tripTitle: 'Untitled Trip',
        routeSummary: '',
        duration: '',
        coverImage: '',
        lastModified: Date.now(),
        days: []
    };
    saveAppData();
    loadTripIntoBuilder(newId);
    closeTripsModal();
}

function duplicateTrip() {
    if (!appData.currentTripId) return;
    autoSave();
    
    const currentData = JSON.parse(JSON.stringify(appData.trips[appData.currentTripId]));
    const newId = generateId();
    
    currentData.tripTitle = currentData.tripTitle ? currentData.tripTitle + ' (Copy)' : 'Untitled (Copy)';
    currentData.lastModified = Date.now();
    
    appData.trips[newId] = currentData;
    appData.currentTripId = newId;
    saveAppData();
    loadTripIntoBuilder(newId);
    alert("Trip duplicated! You are now editing the copy.");
}

function loadTripIntoBuilder(tripId) {
    appData.currentTripId = tripId;
    saveAppData();
    
    const state = appData.trips[tripId];
    if (!state) return;

    document.getElementById('tripTitleInput').value = state.tripTitle === 'Untitled Trip' ? '' : (state.tripTitle || '');
    document.getElementById('routeSummaryInput').value = state.routeSummary || '';
    document.getElementById('durationInput').value = state.duration || '';
    
    const docHeader = document.getElementById('docHeaderBanner');
    if (state.coverImage && state.coverImage !== 'none' && state.coverImage !== '') {
        docHeader.style.backgroundImage = state.coverImage;
        docHeader.style.display = 'block';
    } else {
        docHeader.style.backgroundImage = '';
        docHeader.style.display = 'none';
        document.getElementById('coverImageInput').value = '';
    }

    const daysManager = document.getElementById('daysManager');
    daysManager.innerHTML = '';
    dayCount = 0;

    if (state.days && state.days.length > 0) {
        state.days.forEach(day => {
            dayCount++;
            const clone = document.getElementById('dayBuilderTemplate').content.cloneNode(true);
            const panel = clone.querySelector('.day-panel');
            panel.dataset.dayId = dayCount;
            clone.querySelector('.day-number').textContent = dayCount;

            panel.querySelector('.day-route-input').value = day.route || '';
            panel.querySelector('.day-transport-input').value = day.transport || '';
            panel.querySelector('.day-date-input').value = day.date || '';
            panel.querySelector('.day-stay-input').value = day.stay || '';

            const thumbContainer = panel.querySelector('.day-thumbnails');
            if (day.images) {
                day.images.forEach(imgData => {
                    thumbContainer.appendChild(createThumbnailElement(imgData.src, imgData.fit));
                });
            }

            const activitiesList = panel.querySelector('.activities-list');
            if (day.activities && day.activities.length > 0) {
                day.activities.forEach(act => {
                    const actClone = document.getElementById('activityBuilderTemplate').content.cloneNode(true);
                    actClone.querySelector('.act-time').value = act.time || '';
                    actClone.querySelector('.act-desc').value = act.desc || '';
                    actClone.querySelector('.act-notes').value = act.notes || '';
                    activitiesList.appendChild(actClone);
                });
            } else {
                activitiesList.appendChild(document.getElementById('activityBuilderTemplate').content.cloneNode(true));
            }
            daysManager.appendChild(clone);
        });
    } else {
        addDay();
    }

    updatePreview();
    closeTripsModal();
}

function clearCurrentTrip() {
    if (confirm("Clear this trip entirely?")) {
        const id = appData.currentTripId;
        appData.trips[id] = { tripTitle: '', routeSummary: '', duration: '', coverImage: '', days: [], lastModified: Date.now() };
        loadTripIntoBuilder(id);
    }
}

// --- Modal Management ---

function openTripsModal() {
    autoSave();
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = '';
    
    const tripsArray = Object.entries(appData.trips).map(([id, data]) => ({ id, ...data }));
    tripsArray.sort((a, b) => b.lastModified - a.lastModified);

    if (tripsArray.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No saved trips found.</p>';
    } else {
        tripsArray.forEach(trip => {
            const dateStr = new Date(trip.lastModified).toLocaleString();
            const div = document.createElement('div');
            div.className = `trip-item ${trip.id === appData.currentTripId ? 'active-trip' : ''}`;
            div.onclick = () => loadTripIntoBuilder(trip.id);
            div.innerHTML = `
                <div class="trip-item-info">
                    <div class="trip-item-title">${trip.tripTitle || 'Untitled Trip'}</div>
                    <div class="trip-item-date">Last updated: ${dateStr}</div>
                </div>
                <button class="icon-btn" onclick="deleteTrip('${trip.id}', event)" title="Delete"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    }
    
    document.getElementById('tripsModal').classList.add('active');
}

function closeTripsModal() {
    document.getElementById('tripsModal').classList.remove('active');
}

function deleteTrip(id, event) {
    event.stopPropagation();
    if (confirm("Delete this trip permanently?")) {
        delete appData.trips[id];
        if (appData.currentTripId === id) {
            appData.currentTripId = null;
        }
        saveAppData();
        openTripsModal();
        if (!appData.currentTripId) {
            createNewTrip();
        }
    }
}

// --- DOM Builder Management ---

function addDay() {
    dayCount++;
    const daysManager = document.getElementById('daysManager');
    const clone = document.getElementById('dayBuilderTemplate').content.cloneNode(true);
    
    const dayPanel = clone.querySelector('.day-panel');
    dayPanel.dataset.dayId = dayCount;
    clone.querySelector('.day-number').textContent = dayCount;
    
    clone.querySelector('.activities-list').appendChild(document.getElementById('activityBuilderTemplate').content.cloneNode(true));
    daysManager.appendChild(clone);
    autoSave();
}

function removeDay(btn) {
    btn.closest('.day-panel').remove();
    reindexDays();
    autoSave();
}

function reindexDays() {
    dayCount = 0;
    document.querySelectorAll('.day-panel').forEach(panel => {
        dayCount++;
        panel.dataset.dayId = dayCount;
        panel.querySelector('.day-number').textContent = dayCount;
    });
}

function addActivity(btn) {
    btn.closest('.activities-manager').querySelector('.activities-list')
        .appendChild(document.getElementById('activityBuilderTemplate').content.cloneNode(true));
    autoSave();
}

function removeActivity(btn) {
    btn.closest('.activity-row').remove();
    autoSave();
}

// --- Image Handling & Compression ---

// Compress image to avoid LocalStorage 5MB quota errors
function compressImage(base64Str, maxWidth, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        callback(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality jpeg
    };
    img.src = base64Str;
}

function handleCoverImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImage(e.target.result, 1200, function(compressedStr) {
                const header = document.getElementById('docHeaderBanner');
                header.style.backgroundImage = `url(${compressedStr})`;
                header.style.display = 'block';
                autoSave();
            });
        }
        reader.readAsDataURL(file);
    }
}

function handleDayImagesUpload(input, event) {
    const thumbContainer = input.closest('.day-images-manager').querySelector('.day-thumbnails');
    const files = Array.from(event.target.files);
    
    const currentCount = thumbContainer.children.length;
    if (currentCount + files.length > 3) {
        alert("Maximum 3 images allowed per day!");
        return;
    }

    files.slice(0, 3 - currentCount).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImage(e.target.result, 600, function(compressedStr) {
                thumbContainer.appendChild(createThumbnailElement(compressedStr, 'cover'));
                autoSave();
            });
        }
        reader.readAsDataURL(file);
    });
}

function createThumbnailElement(src, fit) {
    const div = document.createElement('div');
    div.className = 'thumb-container';
    div.innerHTML = `
        <img src="${src}" data-fit="${fit}" title="Click to toggle Fit/Fill" onclick="toggleImageFit(this)">
        <button class="thumb-del-btn" onclick="removeImage(this, event)"><i class="fa-solid fa-times"></i></button>
    `;
    div.querySelector('img').style.objectFit = fit;
    return div;
}

function toggleImageFit(img) {
    const newFit = img.dataset.fit === 'cover' ? 'contain' : 'cover';
    img.dataset.fit = newFit;
    img.style.objectFit = newFit;
    autoSave();
}

function removeImage(btn, event) {
    event.stopPropagation();
    btn.closest('.thumb-container').remove();
    autoSave();
}

// --- Preview & Export ---

function updatePreview() {
    const titleVal = document.getElementById('tripTitleInput').value || 'YOUR TRIP TITLE';
    const routeVal = document.getElementById('routeSummaryInput').value || 'Route Summary';
    
    document.getElementById('docTripTitle').textContent = titleVal;
    document.getElementById('docRouteSummary').textContent = routeVal;
    document.getElementById('docDuration').textContent = document.getElementById('durationInput').value || 'Duration Here';

    const docHeader = document.getElementById('docHeaderBanner');
    if (titleVal !== 'YOUR TRIP TITLE' || docHeader.style.backgroundImage) {
        docHeader.style.display = 'block';
    } else {
        docHeader.style.display = 'none';
    }

    const docDaysContainer = document.getElementById('docDaysContainer');
    docDaysContainer.innerHTML = '';

    document.querySelectorAll('.day-panel').forEach(panel => {
        const dayId = panel.dataset.dayId;
        const route = panel.querySelector('.day-route-input').value || 'Route Summary';
        const transport = panel.querySelector('.day-transport-input').value || '';
        const date = panel.querySelector('.day-date-input').value || 'Date';
        const stay = panel.querySelector('.day-stay-input').value || 'Location';

        const docClone = document.getElementById('docDayTemplate').content.cloneNode(true);
        docClone.querySelector('.doc-day-num').textContent = dayId;
        docClone.querySelector('.doc-day-route').textContent = route;
        docClone.querySelector('.doc-day-transport').textContent = transport ? `(${transport})` : '';
        docClone.querySelector('.doc-date-val').textContent = date;
        docClone.querySelector('.doc-stay-val').textContent = stay;

        const docImagesContainer = docClone.querySelector('.doc-day-images');
        const thumbs = panel.querySelectorAll('.thumb-container img');
        if (thumbs.length > 0) {
            thumbs.forEach(thumb => {
                const img = document.createElement('img');
                img.src = thumb.src;
                img.style.objectFit = thumb.dataset.fit;
                docImagesContainer.appendChild(img);
            });
        } else {
            docImagesContainer.style.display = 'none';
        }

        const tbody = docClone.querySelector('.doc-activities-tbody');
        panel.querySelectorAll('.activity-row').forEach(row => {
            const time = row.querySelector('.act-time').value;
            const desc = row.querySelector('.act-desc').value;
            const notes = row.querySelector('.act-notes').value;
            
            if (time || desc || notes) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${time}</td><td>${desc}</td><td>${notes}</td>`;
                tbody.appendChild(tr);
            }
        });

        if (tbody.children.length === 0) {
            tbody.innerHTML = `<tr><td>&nbsp;</td><td></td><td></td></tr>`;
        }

        docDaysContainer.appendChild(docClone);
    });
}

function downloadPDF() {
    const element = document.getElementById('documentContent');
    const tripTitle = document.getElementById('tripTitleInput').value || 'Itinerary';
    const filename = tripTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    
    document.body.classList.add('is-printing');
    
    const opt = {
        margin:       0,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#111827' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const btn = document.querySelector('.success-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
    btn.disabled = true;

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.classList.remove('is-printing');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(err => {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. See console for details.");
        document.body.classList.remove('is-printing');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
