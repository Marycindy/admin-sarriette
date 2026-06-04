// ============================================================
//   SARRIETTE – Admin Dashboard JavaScript
//   admin/admin.js
// ============================================================

let currentPage = 1;
let currentFilters = { status: '', search: '', date: '' };

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date
    const today = new Date();
    document.getElementById('todayDate').innerText = today.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('todayDateService').innerText = today.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Set time greeting
    const hour = today.getHours();
    const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
    document.getElementById('timeGreeting').innerText = greeting;
    
    // Set admin name from session
    const admin = JSON.parse(sessionStorage.getItem('sarriette_admin') || '{}');
    if (admin.name) document.getElementById('adminName').innerText = admin.name;
    
    // Load initial data
    loadStats();
    loadTodayReservations();
    loadReservations();
    
    // Setup navigation
    setupNavigation();
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
        });
    });
    
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
}

function navigateTo(page) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
    
    // Update visible page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    
    // Update title
    const titles = { dashboard: 'Dashboard', reservations: 'Reservations', checkin: 'Check In', today: 'Today\'s Service', upcoming: 'Upcoming' };
    document.getElementById('pageTitle').innerText = titles[page] || page;
    
    // Load page data
    if (page === 'dashboard') { loadStats(); loadTodayReservations(); }
    else if (page === 'reservations') loadReservations();
    else if (page === 'today') loadTodayService();
    else if (page === 'upcoming') loadUpcoming();
    else if (page === 'checkin') loadRecentCheckins();
}

// Load statistics for dashboard
async function loadStats() {
    try {
        const response = await fetch('api.php?action=stats');
        const result = await response.json();
        if (result.success) {
            document.getElementById('stat-today').innerText = result.data.today || 0;
            document.getElementById('stat-guests').innerText = result.data.total_guests_today || 0;
            document.getElementById('stat-pending').innerText = result.data.pending || 0;
            document.getElementById('stat-tomorrow').innerText = result.data.tomorrow || 0;
            document.getElementById('stat-seated').innerText = result.data.seated_today || 0;
            document.getElementById('stat-month').innerText = result.data.month_total || 0;
            document.getElementById('pendingBadge').innerText = result.data.pending || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load today's reservations for dashboard preview
async function loadTodayReservations() {
    try {
        const response = await fetch('api.php?action=list&date=' + new Date().toISOString().split('T')[0]);
        const result = await response.json();
        const tbody = document.getElementById('todayTableWrap');
        if (result.success && result.data.length > 0) {
            let html = '<table class="data-table"><thead><tr><th>Time</th><th>Guest</th><th>Guests</th><th>Status</th></tr></thead><tbody>';
            result.data.slice(0, 5).forEach(r => {
                html += `<tr>
                    <td>${r.time.substring(0,5)}</td>
                    <td>${escapeHtml(r.name)}</td>
                    <td>${r.guests}</td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<div class="loading-spinner">No reservations for today</div>';
        }
    } catch (error) {
        document.getElementById('todayTableWrap').innerHTML = '<div class="loading-spinner">Error loading data</div>';
    }
}

// Load all reservations (paginated)
async function loadReservations(page = 1) {
    currentPage = page;
    let url = `api.php?action=list&page=${page}`;
    if (currentFilters.status) url += `&status=${currentFilters.status}`;
    if (currentFilters.search) url += `&search=${encodeURIComponent(currentFilters.search)}`;
    if (currentFilters.date) url += `&date=${currentFilters.date}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        const tbody = document.getElementById('reservationsBody');
        
        if (result.success && result.data.length > 0) {
            let html = '';
            result.data.forEach(r => {
                html += `<tr>
                    <td><strong>${escapeHtml(r.reservation_code)}</strong></td>
                    <td>${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.email)}<br><small>${escapeHtml(r.phone)}</small></td>
                    <td>${r.date}</td>
                    <td>${r.time.substring(0,5)}</td>
                    <td>${r.guests}</td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                    <td class="action-btns">
                        <button class="act-btn act-view" onclick="viewReservation(${r.id})"><i class="fas fa-eye"></i></button>
                        <button class="act-btn act-confirm" onclick="updateStatus(${r.id}, 'confirmed')"><i class="fas fa-check"></i></button>
                        <button class="act-btn act-cancel" onclick="updateStatus(${r.id}, 'cancelled')"><i class="fas fa-times"></i></button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
            
            // Pagination
            const pagination = document.getElementById('pagination');
            let pagesHtml = '';
            for (let i = 1; i <= result.pages; i++) {
                pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="loadReservations(${i})">${i}</button>`;
            }
            pagination.innerHTML = pagesHtml;
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No reservations found</td></tr>';
            document.getElementById('pagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading reservations:', error);
    }
}

// Filter reservations
function filterReservations() {
    currentFilters = {
        status: document.getElementById('filterStatus')?.value || '',
        search: document.getElementById('searchInput')?.value || '',
        date: document.getElementById('filterDate')?.value || ''
    };
    loadReservations(1);
}

// Update reservation status
async function updateStatus(id, status) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', id: id, status: status })
        });
        const result = await response.json();
        if (result.success) {
            loadReservations(currentPage);
            loadStats();
        } else {
            alert('Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Check-in guest
async function doCheckin(inputId) {
    const code = document.getElementById(inputId).value.trim().toUpperCase();
    if (!code) {
        alert('Please enter a reservation code');
        return;
    }
    
    const resultDiv = document.getElementById(inputId === 'quickCode' ? 'quickCheckinResult' : 'checkinResult');
    resultDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Checking...</div>';
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkin', code: code })
        });
        const result = await response.json();
        
        if (result.success) {
            resultDiv.innerHTML = `<div class="result-success">
                <div class="result-title"><i class="fas fa-check-circle"></i> Check-in Successful!</div>
                <div class="result-detail">Guest: ${escapeHtml(result.data.name)}<br>Welcome to Sarriette!</div>
            </div>`;
            document.getElementById(inputId).value = '';
            loadStats();
            loadRecentCheckins();
            loadTodayReservations();
        } else {
            resultDiv.innerHTML = `<div class="result-error">
                <div class="result-title"><i class="fas fa-exclamation-triangle"></i> Check-in Failed</div>
                <div class="result-detail">${escapeHtml(result.message)}</div>
            </div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="result-error">Error: ${error.message}</div>`;
    }
}

// Load today's service page
async function loadTodayService() {
    try {
        const response = await fetch('api.php?action=list&date=' + new Date().toISOString().split('T')[0]);
        const result = await response.json();
        const tbody = document.getElementById('todayBody');
        
        if (result.success && result.data.length > 0) {
            let html = '';
            result.data.forEach(r => {
                html += `<tr>
                    <td><strong>${escapeHtml(r.reservation_code)}</strong></td>
                    <td>${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.phone)}</td>
                    <td>${r.time.substring(0,5)}</td>
                    <td>${r.guests}</td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                    <td class="action-btns">
                        <button class="act-btn act-view" onclick="viewReservation(${r.id})"><i class="fas fa-eye"></i></button>
                        ${r.status !== 'seated' ? `<button class="act-btn act-seat" onclick="updateStatus(${r.id}, 'seated')"><i class="fas fa-chair"></i></button>` : ''}
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
            document.getElementById('todaySummary').innerHTML = `<div class="today-badge"><strong>${result.data.length}</strong> <span>total bookings today</span></div>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No reservations for today</td></tr>';
        }
    } catch (error) {
        console.error('Error loading today service:', error);
    }
}

// Load upcoming reservations
async function loadUpcoming() {
    try {
        const response = await fetch('api.php?action=upcoming');
        const result = await response.json();
        const tbody = document.getElementById('upcomingBody');
        
        if (result.success && result.data.length > 0) {
            let html = '';
            result.data.forEach(day => {
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                html += `<tr>
                    <td>${day.date}</td>
                    <td>${dayName}</td>
                    <td>${day.count} bookings</td>
                    <td>${day.total_guests || 0} guests</td>
                    <td><span class="badge badge-confirmed">Upcoming</span></td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No upcoming reservations</td></tr>';
        }
    } catch (error) {
        console.error('Error loading upcoming:', error);
    }
}

// Load recent check-ins
async function loadRecentCheckins() {
    try {
        const response = await fetch('api.php?action=list&status=seated');
        const result = await response.json();
        const container = document.getElementById('recentCheckins');
        
        if (result.success && result.data.length > 0) {
            let html = '';
            result.data.slice(0, 5).forEach(r => {
                html += `<div class="recent-item">
                    <div><span class="recent-name">${escapeHtml(r.name)}</span><br><span class="recent-code">${r.reservation_code}</span></div>
                    <div class="recent-time">${r.time.substring(0,5)}</div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="loading-spinner">No recent check-ins</div>';
        }
    } catch (error) {
        console.error('Error loading recent check-ins:', error);
    }
}

// View reservation details in modal
async function viewReservation(id) {
    try {
        const response = await fetch(`api.php?action=list&page=1`);
        const result = await response.json();
        const reservation = result.data.find(r => r.id === id);
        
        if (reservation) {
            const modal = document.getElementById('detailModal');
            document.getElementById('modalBody').innerHTML = `
                <div class="res-code-display"><span>${escapeHtml(reservation.reservation_code)}</span></div>
                <div class="detail-grid">
                    <div class="detail-item"><label>Guest Name</label><p>${escapeHtml(reservation.name)}</p></div>
                    <div class="detail-item"><label>Phone</label><p>${escapeHtml(reservation.phone)}</p></div>
                    <div class="detail-item"><label>Email</label><p>${escapeHtml(reservation.email)}</p></div>
                    <div class="detail-item"><label>Guests</label><p>${reservation.guests}</p></div>
                    <div class="detail-item"><label>Date & Time</label><p>${reservation.date} at ${reservation.time.substring(0,5)}</p></div>
                    <div class="detail-item"><label>Status</label><p><span class="badge badge-${reservation.status}">${reservation.status}</span></p></div>
                </div>
                ${reservation.special_requests ? `<div class="special-req-box"><strong>Special Requests:</strong><br>${escapeHtml(reservation.special_requests)}</div>` : ''}
                <div class="modal-actions">
                    <button class="btn-gold" onclick="updateStatus(${reservation.id}, 'confirmed')"><i class="fas fa-check"></i> Confirm</button>
                    <button class="btn-sm" onclick="updateStatus(${reservation.id}, 'seated')"><i class="fas fa-chair"></i> Seat</button>
                    <button class="btn-sm" onclick="updateStatus(${reservation.id}, 'cancelled')"><i class="fas fa-times"></i> Cancel</button>
                </div>
            `;
            modal.classList.add('show');
        }
    } catch (error) {
        console.error('Error viewing reservation:', error);
    }
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}