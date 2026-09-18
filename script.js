/* ============================================================================
   Supabase Configuration
   ============================================================================ */

const SUPABASE_URL = "https://cfdjsilmcomflleqhqii.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUL-eM8mbA8fgFYoUpXVFg_DTWaUKdf";

let supabaseClient = null;

/**
 * Initialize Supabase Client
 */
function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_')) {
        console.error('Supabase credentials not configured. Please update SUPABASE_URL and SUPABASE_ANON_KEY.');
        showError('Configuration Error', 'Supabase credentials are not set up. Please contact support.');
        return false;
    }
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
}

/* ============================================================================
   DOM Elements
   ============================================================================ */

const appContainer = document.getElementById('app-container');
const landingView = document.getElementById('landing-view');
const attendanceView = document.getElementById('attendance-view');
const phoneInput = document.getElementById('phone-input');
const searchButton = document.getElementById('search-button');
const backButton = document.getElementById('back-button');
const resultsContainer = document.getElementById('results-container');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const searchError = document.getElementById('search-error');
const studentHeader = document.getElementById('student-header');
const attendanceSection = document.getElementById('attendance-section');
const detailLoading = document.getElementById('detail-loading');
const detailError = document.getElementById('detail-error');

/* ============================================================================
   View Management
   ============================================================================ */

/**
 * Switch between landing and attendance views
 */
function switchView(viewName) {
    landingView.classList.remove('active');
    attendanceView.classList.remove('active');
    
    if (viewName === 'landing') {
        landingView.classList.add('active');
        window.history.replaceState(null, '', window.location.pathname);
    } else if (viewName === 'attendance') {
        attendanceView.classList.add('active');
    }
}

/**
 * Show/hide loading spinner
 */
function setLoading(isLoading, target = 'landing') {
    const spinner = target === 'landing' ? loadingSpinner : detailLoading;
    if (isLoading) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}

/**
 * Show error message
 */
function showErrorMessage(message, target = 'landing') {
    const errorEl = target === 'landing' ? searchError : detailError;
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

/**
 * Clear error message
 */
function clearErrorMessage(target = 'landing') {
    const errorEl = target === 'landing' ? searchError : detailError;
    errorEl.textContent = '';
    errorEl.classList.remove('show');
}

/* ============================================================================
   Phone Search & Student Lookup
   ============================================================================ */

/**
 * Fetch students by phone number
 */
async function searchStudentsByPhone(phoneNumber) {
    if (!supabaseClient) return null;
    
    try {
        const { data, error } = await supabaseClient.rpc('get_students_by_phone', {
            search_phone: phoneNumber
        });
        
        if (error) {
            console.error('RPC Error:', error);
            showErrorMessage(`Error: ${error.message}`);
            return null;
        }
        
        return data || [];
    } catch (err) {
        console.error('Search Error:', err);
        showErrorMessage('Failed to search students. Please try again.');
        return null;
    }
}

/**
 * Render search results as student cards
 */
function renderSearchResults(students) {
    resultsContainer.innerHTML = '';
    
    if (!students || students.length === 0) {
        resultsContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    resultsContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    students.forEach(student => {
        const expiryDate = new Date(student.expiry_date_raw);
        const today = new Date();
        const isExpired = expiryDate < today;
        const isExpiringSoon = !isExpired && (expiryDate - today) < (30 * 24 * 60 * 60 * 1000);
        
        const statusClass = isExpired ? 'expired' : isExpiringSoon ? 'expiring' : 'active';
        const statusText = isExpired ? 'Membership Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active';
        
        const formattedDate = expiryDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const card = document.createElement('div');
        card.className = 'student-card';
        card.innerHTML = `
            <div class="student-card-header">
                <div>
                    <h3 class="student-name">${escapeHtml(student.student_name)}</h3>
                    <p class="student-id">ID: ${escapeHtml(student.student_id)}</p>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <div class="student-details">
                <div class="detail-row">
                    <span class="detail-label">Center</span>
                    <span class="detail-value">${escapeHtml(student.center)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Parent Name</span>
                    <span class="detail-value">${escapeHtml(student.parents_name)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Membership Expiry</span>
                    <span class="detail-value">${formattedDate}</span>
                </div>
            </div>
            
            <div class="student-card-footer">
                <md-filled-button class="view-attendance-btn" data-student-id="${escapeHtml(student.student_id)}">
                    <md-icon slot="icon">school</md-icon>
                    View Attendance
                </md-filled-button>
                ${student.wa_link ? `
                    <md-text-button onclick="window.open('${escapeHtml(student.wa_link)}', '_blank')">
                        <md-icon slot="icon">chat</md-icon>
                    </md-text-button>
                ` : ''}
            </div>
        `;
        
        resultsContainer.appendChild(card);
        
        // Add event listener to View Attendance button
        card.querySelector('.view-attendance-btn').addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            navigateToAttendance(studentId);
        });
    });
}

/**
 * Handle search button click
 */
async function handleSearch() {
    clearErrorMessage();
    const phoneNumber = phoneInput.value.trim();
    
    if (!phoneNumber) {
        showErrorMessage('Please enter a phone number');
        return;
    }
    
    setLoading(true);
    resultsContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
    
    const students = await searchStudentsByPhone(phoneNumber);
    setLoading(false);
    
    if (students !== null) {
        renderSearchResults(students);
    }
}

/**
 * Handle phone input keydown (Enter to search)
 */
function handlePhoneKeydown(event) {
    if (event.key === 'Enter') {
        handleSearch();
    }
}

/* ============================================================================
   Attendance Detail View
   ============================================================================ */

/**
 * Navigate to attendance detail page
 */
function navigateToAttendance(studentId) {
    window.history.pushState(null, '', `?id=${encodeURIComponent(studentId)}`);
    switchView('attendance');
    clearErrorMessage('attendance');
    loadAttendanceDetail(studentId);
}

/**
 * Handle back to search button
 */
function handleBackToSearch() {
    switchView('landing');
    phoneInput.value = '';
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
    clearErrorMessage();
}

/**
 * Fetch student info by ID
 */
async function fetchStudentInfo(studentId) {
    if (!supabaseClient) return null;
    
    try {
        const { data, error } = await supabaseClient.rpc('get_student_by_id', {
            search_id: studentId
        });
        
        if (error) {
            console.error('RPC Error:', error);
            return null;
        }
        
        return data && data.length > 0 ? data[0] : null;
    } catch (err) {
        console.error('Fetch Error:', err);
        return null;
    }
}

/**
 * Fetch attendance records by student ID
 */
async function fetchAttendanceRecords(studentId) {
    if (!supabaseClient) return null;
    
    try {
        const { data, error } = await supabaseClient.rpc('get_attendance_by_student_id', {
            search_id: studentId
        });
        
        if (error) {
            console.error('RPC Error:', error);
            return null;
        }
        
        return data || [];
    } catch (err) {
        console.error('Fetch Error:', err);
        return null;
    }
}

/**
 * Render student header banner
 */
function renderStudentHeader(student) {
    if (!student) {
        studentHeader.innerHTML = '<p class="error-message">Student information not found.</p>';
        return;
    }
    
    const expiryDate = new Date(student.expiry_date_raw);
    const today = new Date();
    const isExpired = expiryDate < today;
    const statusClass = isExpired ? 'expired' : 'active';
    const statusText = isExpired ? 'Membership Expired' : 'Membership Active';
    
    const formattedDate = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    studentHeader.innerHTML = `
        <div class="header-top">
            <div>
                <h2 class="student-name-header">${escapeHtml(student.student_name)}</h2>
                <p style="margin: 4px 0 0 0; color: var(--md-on-surface-variant); font-size: 14px;">
                    Student ID: ${escapeHtml(student.student_id)}
                </p>
            </div>
            <span class="status-badge ${statusClass}" style="margin-top: 4px;">${statusText}</span>
        </div>
        
        <div class="header-meta">
            <div class="meta-item">
                <span class="meta-label">Center</span>
                <span class="meta-value">${escapeHtml(student.center)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Membership Expiry</span>
                <span class="meta-value">${formattedDate}</span>
            </div>
        </div>
        
        <div class="header-actions">
            ${student.wa_link ? `
                <md-filled-button onclick="window.open('${escapeHtml(student.wa_link)}', '_blank')">
                    <md-icon slot="icon">chat</md-icon>
                    WhatsApp Support
                </md-filled-button>
            ` : ''}
        </div>
    `;
}

/**
 * Render attendance records
 */
function renderAttendanceRecords(records) {
    attendanceSection.innerHTML = '';
    
    if (!records || records.length === 0) {
        attendanceSection.innerHTML = `
            <div class="empty-state" style="min-height: 200px;">
                <md-icon class="empty-state-icon">event_busy</md-icon>
                <h3>No Attendance Records</h3>
                <p>No attendance records found for this student.</p>
            </div>
        `;
        return;
    }
    
    // Sort records by date (most recent first)
    const sortedRecords = [...records].sort((a, b) => {
        return new Date(b.raw_date) - new Date(a.raw_date);
    });
    
    // Desktop Table View
    const tableHtml = `
        <h3 class="section-title">Attendance History</h3>
        <div class="attendance-table-wrapper">
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Class</th>
                        <th>Status</th>
                        <th>Term/Quarter</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedRecords.map(record => renderTableRow(record)).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Mobile Card View
    const cardsHtml = `
        <h3 class="section-title">Attendance History</h3>
        <div class="attendance-cards">
            ${sortedRecords.map(record => renderAttendanceCard(record)).join('')}
        </div>
    `;
    
    attendanceSection.innerHTML = tableHtml + cardsHtml;
}

/**
 * Render a table row for attendance record
 */
function renderTableRow(record) {
    const date = new Date(record.raw_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    const statusClass = getStatusClass(record.attendance);
    const statusText = formatAttendanceStatus(record.attendance);
    const notes = buildNotes(record);
    
    return `
        <tr>
            <td><span class="attendance-date">${date}</span></td>
            <td>${escapeHtml(record.class_ || '-')}</td>
            <td><span class="attendance-status ${statusClass}">${statusText}</span></td>
            <td>${escapeHtml(record.term ? `${record.term} ${record.quarter || ''}` : '-')}</td>
            <td>${notes ? `<em>${escapeHtml(notes)}</em>` : '-'}</td>
        </tr>
    `;
}

/**
 * Render an attendance card for mobile view
 */
function renderAttendanceCard(record) {
    const date = new Date(record.raw_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        weekday: 'short'
    });
    
    const statusClass = getStatusClass(record.attendance);
    const statusText = formatAttendanceStatus(record.attendance);
    const notes = buildNotes(record);
    
    return `
        <div class="attendance-card ${statusClass}">
            <div class="card-date">${date}</div>
            <div class="card-row">
                <span class="card-label">Class:</span>
                <span class="card-value">${escapeHtml(record.class_ || '-')}</span>
            </div>
            <div class="card-row">
                <span class="card-label">Status:</span>
                <span class="attendance-status ${statusClass}">${statusText}</span>
            </div>
            ${record.term ? `
                <div class="card-row">
                    <span class="card-label">Term:</span>
                    <span class="card-value">${escapeHtml(record.term)} ${escapeHtml(record.quarter || '')}</span>
                </div>
            ` : ''}
            ${notes ? `<div class="attendance-notes">${escapeHtml(notes)}</div>` : ''}
        </div>
    `;
}

/**
 * Get status class for attendance
 */
function getStatusClass(attendance) {
    if (!attendance) return 'absent';
    if (attendance.toLowerCase() === 'present') return 'present';
    if (attendance.toLowerCase() === 'makeup') return 'makeup';
    return 'absent';
}

/**
 * Format attendance status for display
 */
function formatAttendanceStatus(attendance) {
    if (!attendance) return 'Absent';
    if (attendance.toLowerCase() === 'present') return 'Present';
    if (attendance.toLowerCase() === 'makeup') return 'Make-up';
    return attendance;
}

/**
 * Build notes from makeup_reason and previous_class
 */
function buildNotes(record) {
    const notes = [];
    if (record.makeup_reason) notes.push(`Makeup: ${record.makeup_reason}`);
    if (record.previous_class) notes.push(`Previous Class: ${record.previous_class} (${record.previous_date_str})`);
    return notes.join(' | ');
}

/**
 * Load and render attendance detail page
 */
async function loadAttendanceDetail(studentId) {
    if (!studentId) {
        switchView('landing');
        showErrorMessage('Invalid student ID');
        return;
    }
    
    setLoading(true, 'attendance');
    clearErrorMessage('attendance');
    
    try {
        const [studentInfo, attendanceRecords] = await Promise.all([
            fetchStudentInfo(studentId),
            fetchAttendanceRecords(studentId)
        ]);
        
        setLoading(false, 'attendance');
        
        if (!studentInfo) {
            showErrorMessage('Student not found. Please search again.', 'attendance');
            setTimeout(() => handleBackToSearch(), 2000);
            return;
        }
        
        renderStudentHeader(studentInfo);
        renderAttendanceRecords(attendanceRecords);
        
    } catch (err) {
        setLoading(false, 'attendance');
        console.error('Load Error:', err);
        showErrorMessage('Failed to load attendance details. Please try again.', 'attendance');
    }
}

/* ============================================================================
   URL Parameter Handling
   ============================================================================ */

/**
 * Check URL parameters on page load
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const studentId = params.get('id');
    
    if (studentId) {
        switchView('attendance');
        loadAttendanceDetail(studentId);
    }
}

/* ============================================================================
   Utility Functions
   ============================================================================ */

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show error dialog (optional)
 */
function showError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 400px;
        text-align: center;
    `;
    errorDiv.innerHTML = `
        <h2 style="margin: 0 0 12px 0; color: #b3261e;">${title}</h2>
        <p style="margin: 0; color: #666;">${message}</p>
    `;
    document.body.appendChild(errorDiv);
}

/* ============================================================================
   Event Listeners
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase
    if (!initSupabase()) {
        return;
    }
    
    // Attach event listeners
    searchButton.addEventListener('click', handleSearch);
    phoneInput.addEventListener('keydown', handlePhoneKeydown);
    backButton.addEventListener('click', handleBackToSearch);
    
    // Check for URL parameters
    checkUrlParams();
});

// Handle browser back button
window.addEventListener('popstate', () => {
    checkUrlParams();
});
