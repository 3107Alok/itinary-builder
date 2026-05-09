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
        if (e.name === 'QuotaExceededError') {
            console.warn("Storage quota exceeded.");
        }
    }
}

function autoSave() {
    if (!appData.currentTripId) return;

    const state = {
        tripTitle: document.getElementById('tripTitleInput').value,
        routeSummary: document.getElementById('routeSummaryInput').value,
        duration: document.getElementById('durationInput').value,
        coverImage: document.getElementById('docHeaderBanner') ? document.getElementById('docHeaderBanner').style.backgroundImage : '',
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
    
    saveAppData();
    debouncedUpdatePreview();
}

let previewTimeout = null;
function debouncedUpdatePreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
        updatePreview();
    }, 300); // 300ms delay to prevent typing lag during DOM height calculations
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
    
    // We don't touch docHeaderBanner directly here because we rewrite the DOM in updatePreview
    // Just set the hidden input if needed.
    
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
        
        callback(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = base64Str;
}

function handleCoverImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImage(e.target.result, 1200, function(compressedStr) {
                if (appData.currentTripId) {
                    appData.trips[appData.currentTripId].coverImage = `url(${compressedStr})`;
                    saveAppData();
                    updatePreview(); // force update instantly for images
                }
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

// --- Pagination Preview & Export ---

function createNewPageElement() {
    const page = document.createElement('div');
    page.className = 'document-page';
    page.id = 'docPage_' + Math.random().toString(36).substr(2, 5);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-content-wrapper';
    page.appendChild(wrapper);
    
    return { page, wrapper };
}

function updatePreview() {
    const state = appData.trips[appData.currentTripId];
    if (!state) return;

    const titleVal = state.tripTitle || 'YOUR TRIP TITLE';
    const routeVal = state.routeSummary || 'Route Summary';
    const durationVal = state.duration || 'Duration Here';
    
    const exportContainer = document.getElementById('exportContainer');
    exportContainer.innerHTML = '';

    // Create first page
    let { page: currentPage, wrapper: currentWrapper } = createNewPageElement();
    exportContainer.appendChild(currentPage);

    // --- 1. Construct Header ---
    if (titleVal !== 'YOUR TRIP TITLE' || (state.coverImage && state.coverImage !== 'none')) {
        const docHeader = document.createElement('div');
        docHeader.className = 'doc-header';
        docHeader.id = 'docHeaderBanner';
        if (state.coverImage && state.coverImage !== 'none') {
            docHeader.style.backgroundImage = state.coverImage;
        }
        
        docHeader.innerHTML = `
            <div class="doc-header-overlay">
                <h1 id="docTripTitle">${titleVal}</h1>
                <p id="docRouteSummary" class="route-summary">${routeVal}</p>
            </div>
        `;
        currentPage.insertBefore(docHeader, currentWrapper);
    }

    // --- 2. Construct Trip Details ---
    const tripDetails = document.createElement('div');
    tripDetails.className = 'doc-section doc-trip-details';
    tripDetails.innerHTML = `
        <h2 class="section-title">Trip Details</h2>
        <table class="duration-table">
            <tr>
                <td class="dt-label">Total Duration</td>
                <td class="dt-value">${durationVal}</td>
            </tr>
        </table>
    `;
    currentWrapper.appendChild(tripDetails);

    // --- 3. Construct Days with Pagination ---
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

        // Append the day to current wrapper
        currentWrapper.appendChild(docClone);
        const appendedDay = currentWrapper.lastElementChild;

        // Check Pagination: Does this day make the page overflow?
        // Note: scrollHeight evaluates true height. clientHeight is exactly 297mm (1122px).
        if (currentPage.scrollHeight > currentPage.clientHeight) {
            // Only move to next page if it's NOT the only thing on this page
            // (If a day is just massively tall, moving it to an empty page won't help)
            if (currentWrapper.children.length > 1) {
                appendedDay.remove(); // remove from current page
                
                // Create new page
                const newPageObj = createNewPageElement();
                exportContainer.appendChild(newPageObj.page);
                
                // Append day to new page
                newPageObj.wrapper.appendChild(appendedDay);
                
                // Update pointers
                currentPage = newPageObj.page;
                currentWrapper = newPageObj.wrapper;
            }
        }
    });
}

function downloadPDF() {
    const exportContainer = document.getElementById('exportContainer');
    const titleVal = document.getElementById('tripTitleInput').value || 'Itinerary';
    const filename = titleVal.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    
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

    // html2pdf automatically handles multiple children of the container as continuous flow,
    // but because we set `page-break-after: always;` on .document-page in CSS, it splits perfectly!
    html2pdf().set(opt).from(exportContainer).save().then(() => {
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
