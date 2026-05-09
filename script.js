const STORAGE_KEY = 'tripSyncData';

let dayCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    if (dayCount === 0) {
        addDay(); // Add one day if empty
    }
    updatePreview();
});

// --- Local Storage Management ---

function autoSave() {
    const state = {
        tripTitle: document.getElementById('tripTitleInput').value,
        routeSummary: document.getElementById('routeSummaryInput').value,
        duration: document.getElementById('durationInput').value,
        coverImage: document.getElementById('docHeaderBanner').style.backgroundImage,
        days: []
    };

    document.querySelectorAll('.day-panel').forEach(panel => {
        const dayId = panel.dataset.dayId;
        const route = panel.querySelector('.day-route-input').value;
        const transport = panel.querySelector('.day-transport-input').value;
        const date = panel.querySelector('.day-date-input').value;
        const stay = panel.querySelector('.day-stay-input').value;
        
        // Gather images
        const images = [];
        panel.querySelectorAll('.thumb-container img').forEach(img => {
            images.push({
                src: img.src,
                fit: img.dataset.fit || 'cover'
            });
        });

        // Gather activities
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updatePreview();
}

function loadFromLocalStorage() {
    const dataStr = localStorage.getItem(STORAGE_KEY);
    if (!dataStr) return;

    try {
        const state = JSON.parse(dataStr);
        
        document.getElementById('tripTitleInput').value = state.tripTitle || '';
        document.getElementById('routeSummaryInput').value = state.routeSummary || '';
        document.getElementById('durationInput').value = state.duration || '';
        
        if (state.coverImage && state.coverImage !== 'none') {
            const docHeader = document.getElementById('docHeaderBanner');
            docHeader.style.backgroundImage = state.coverImage;
            docHeader.style.display = 'block';
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

                // Load images
                const thumbContainer = panel.querySelector('.day-thumbnails');
                if (day.images) {
                    day.images.forEach(imgData => {
                        thumbContainer.appendChild(createThumbnailElement(imgData.src, imgData.fit));
                    });
                }

                // Load activities
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
                    // add empty activity if none
                    activitiesList.appendChild(document.getElementById('activityBuilderTemplate').content.cloneNode(true));
                }
                
                daysManager.appendChild(clone);
            });
        }
    } catch (e) {
        console.error("Failed to parse local storage", e);
    }
}

function clearAllData() {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}


// --- DOM Management ---

function addDay() {
    dayCount++;
    const daysManager = document.getElementById('daysManager');
    const template = document.getElementById('dayBuilderTemplate');
    const clone = template.content.cloneNode(true);
    
    const dayPanel = clone.querySelector('.day-panel');
    dayPanel.dataset.dayId = dayCount;
    clone.querySelector('.day-number').textContent = dayCount;
    
    const activitiesList = clone.querySelector('.activities-list');
    const actTemplate = document.getElementById('activityBuilderTemplate');
    activitiesList.appendChild(actTemplate.content.cloneNode(true));

    daysManager.appendChild(clone);
    autoSave();
}

function removeDay(btn) {
    btn.closest('.day-panel').remove();
    reindexDays();
    autoSave();
}

function reindexDays() {
    const dayPanels = document.querySelectorAll('.day-panel');
    dayCount = 0;
    dayPanels.forEach(panel => {
        dayCount++;
        panel.dataset.dayId = dayCount;
        panel.querySelector('.day-number').textContent = dayCount;
    });
}

function addActivity(btn) {
    const activitiesList = btn.closest('.activities-manager').querySelector('.activities-list');
    const template = document.getElementById('activityBuilderTemplate');
    activitiesList.appendChild(template.content.cloneNode(true));
    autoSave();
}

function removeActivity(btn) {
    btn.closest('.activity-row').remove();
    autoSave();
}


// --- Image Handling ---

function handleCoverImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const header = document.getElementById('docHeaderBanner');
            header.style.backgroundImage = `url(${e.target.result})`;
            header.style.display = 'block';
            autoSave();
        }
        reader.readAsDataURL(file);
    }
}

function handleDayImagesUpload(input, event) {
    const thumbContainer = input.closest('.day-images-manager').querySelector('.day-thumbnails');
    const files = Array.from(event.target.files);
    
    // Check limit
    const currentCount = thumbContainer.children.length;
    if (currentCount + files.length > 3) {
        alert("Maximum 3 images allowed per day!");
        return;
    }

    files.slice(0, 3 - currentCount).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            thumbContainer.appendChild(createThumbnailElement(e.target.result, 'cover'));
            autoSave();
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
    // Initial style application
    div.querySelector('img').style.objectFit = fit;
    return div;
}

function toggleImageFit(img) {
    const currentFit = img.dataset.fit;
    const newFit = currentFit === 'cover' ? 'contain' : 'cover';
    img.dataset.fit = newFit;
    img.style.objectFit = newFit;
    autoSave();
}

function removeImage(btn, event) {
    event.stopPropagation(); // prevent triggering image toggle
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

    // Show header if title or cover image exists
    const docHeader = document.getElementById('docHeaderBanner');
    if (titleVal !== 'YOUR TRIP TITLE' || docHeader.style.backgroundImage) {
        docHeader.style.display = 'block';
    } else {
        docHeader.style.display = 'none';
    }

    const docDaysContainer = document.getElementById('docDaysContainer');
    docDaysContainer.innerHTML = '';

    const dayPanels = document.querySelectorAll('.day-panel');
    
    dayPanels.forEach(panel => {
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

        // Add Day Images
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

        // Process activities
        const tbody = docClone.querySelector('.doc-activities-tbody');
        const actRows = panel.querySelectorAll('.activity-row');
        
        actRows.forEach(row => {
            const time = row.querySelector('.act-time').value;
            const desc = row.querySelector('.act-desc').value;
            const notes = row.querySelector('.act-notes').value;
            
            if (time || desc || notes) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${time}</td>
                    <td>${desc}</td>
                    <td>${notes}</td>
                `;
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
    
    // Add specific print class to body just in case
    document.body.classList.add('is-printing');
    
    const opt = {
        margin:       0,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#111827' }, // ensure dark bg for canvas
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
