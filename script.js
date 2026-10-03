function isLoggedIn() {
    return localStorage.getItem('campusconnect_loggedin') === 'true';
}

function isAdminUser() {
    return localStorage.getItem('campusconnect_selected_role') === 'admin';
}

function showDashboardChoice() {
    const modal = document.getElementById('dashboard-choice-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
}

function chooseDashboard(role) {
    localStorage.setItem('campusconnect_selected_role', role);
    const targetPage = role === 'admin' ? 'admin dashboard.html' : 'student dashboard.html';
    window.location.href = targetPage;
}

function protectProtectedPages() {
    const studentProtectedPages = [
        'code.html',
        'companies.html',
        'drives.html',
        'applications.html',
        'profile.html',
        'notifications.html',
        'student dashboard.html',
        'student-dashboard'
    ];

    const currentPage = window.location.pathname.split('/').pop();
    const normalizedPage = currentPage ? currentPage.toLowerCase() : '';

    if (normalizedPage.includes('admin') || isAdminUser()) {
        return;
    }

    const isStudentProtectedPage = studentProtectedPages.includes(currentPage);

    if (isStudentProtectedPage && !isLoggedIn()) {
        window.location.href = 'login.html';
    }
}

function logout() {
    localStorage.removeItem('campusconnect_loggedin');
    fetch('/api/logout', {
        method: 'POST'
    }).finally(() => {
        alert("You have been logged out.");
        window.location.href = "login.html";
    });
}


const APPLICATIONS_STORAGE_KEY = 'campusconnect_applications';
const ADMIN_COMPANIES_STORAGE_KEY = 'campusconnect_admin_companies';
const ADMIN_DRIVES_STORAGE_KEY = 'campusconnect_admin_drives';
const APPLICATION_STUDENT_NAMES = {
    tcs: 'XYZ',
    infosys: 'ABC',
    wipro: 'PQR',
    microsoft: 'UVW',
    google: 'RST'
};

function getAdminRecords(storageKey) {
    try {
        const records = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return Array.isArray(records) ? records : [];
    } catch (error) {
        return [];
    }
}

function saveAdminRecord(storageKey, record) {
    const records = getAdminRecords(storageKey);
    records.push(record);
    localStorage.setItem(storageKey, JSON.stringify(records));
}

function openAdminAction(action) {
    const dialog = document.getElementById('admin-action-dialog');
    const title = document.getElementById('admin-action-title');
    const content = document.getElementById('admin-action-content');
    if (!dialog || !title || !content) return;

    const views = {
        'add-company': {
            title: 'Add Company',
            content: `
                <form class="admin-action-form" onsubmit="saveAdminCompany(event)">
                    <label>Company name<input name="name" required maxlength="80"></label>
                    <label>Role<input name="role" required maxlength="80"></label>
                    <div class="admin-form-row">
                        <label>Package<input name="package" required maxlength="50" placeholder="e.g. 6-12 LPA"></label>
                        <label>Location<input name="location" required maxlength="80"></label>
                    </div>
                    <label>Skills<input name="skills" maxlength="160" placeholder="e.g. Java, SQL"></label>
                    <label>Eligibility<input name="eligibility" maxlength="160"></label>
                    <button type="submit">Save Company</button>
                </form>
            `
        },
        'create-drive': {
            title: 'Create Placement Drive',
            content: `
                <form class="admin-action-form" onsubmit="saveAdminDrive(event)">
                    <label>Company name<input name="company" required maxlength="80"></label>
                    <label>Role<input name="role" required maxlength="80"></label>
                    <label>Drive date<input name="date" type="date" required></label>
                    <button type="submit">Create Drive</button>
                </form>
            `
        },
        'manage-students': {
            title: 'Manage Students',
            content: '<p id="admin-students-status" role="status">Loading students...</p><div id="admin-students-results"></div>'
        }
    };

    const view = views[action];
    if (!view) return;
    title.textContent = view.title;
    content.innerHTML = view.content;
    dialog.showModal();

    if (action === 'manage-students') loadAdminStudents();
}

function closeAdminAction() {
    document.getElementById('admin-action-dialog')?.close();
}

function showAdminActionMessage(message) {
    const content = document.getElementById('admin-action-content');
    if (!content) return;
    content.replaceChildren();
    const status = document.createElement('p');
    status.className = 'admin-action-message';
    status.textContent = message;
    content.append(status);
    const doneButton = document.createElement('button');
    doneButton.type = 'button';
    doneButton.textContent = 'Done';
    doneButton.addEventListener('click', closeAdminAction);
    content.append(doneButton);
}

function saveAdminCompany(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const company = {
        name: values.get('name').trim(),
        role: values.get('role').trim(),
        package: values.get('package').trim(),
        location: values.get('location').trim(),
        skills: values.get('skills').trim(),
        eligibility: values.get('eligibility').trim()
    };

    saveAdminRecord(ADMIN_COMPANIES_STORAGE_KEY, company);
    renderAdminAddedCompanies();
    updateAdminSummaryCounts();
    showAdminActionMessage(`${company.name} was added to the companies list.`);
}

function saveAdminDrive(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const drive = {
        company: values.get('company').trim(),
        role: values.get('role').trim(),
        date: values.get('date')
    };

    saveAdminRecord(ADMIN_DRIVES_STORAGE_KEY, drive);
    renderAdminAddedDrives();
    updateAdminSummaryCounts();
    showAdminActionMessage(`${drive.company} placement drive was created.`);
}

async function loadAdminStudents() {
    const status = document.getElementById('admin-students-status');
    const results = document.getElementById('admin-students-results');
    if (!status || !results) return;

    try {
        const response = await fetch('/api/admin/students');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load students.');

        const students = data.students || [];
        status.textContent = students.length ? `${students.length} student accounts` : 'No student accounts found.';
        if (!students.length) return;

        const table = document.createElement('table');
        table.className = 'applications-table admin-students-table';
        const head = table.createTHead().insertRow();
        ['Student', 'Student ID', 'Email'].forEach((label) => {
            const cell = document.createElement('th');
            cell.textContent = label;
            head.append(cell);
        });
        const body = table.createTBody();
        students.forEach((student) => {
            const row = body.insertRow();
            [student.name, student.studentId || '—', student.email].forEach((value) => {
                const cell = row.insertCell();
                cell.textContent = value || '—';
            });
        });
        results.replaceChildren(table);
    } catch (error) {
        status.textContent = error.message || 'Unable to load students.';
    }
}

function renderAdminAddedCompanies() {
    const container = document.getElementById('admin-added-companies');
    if (!container) return;
    container.replaceChildren();
    const companies = getAdminRecords(ADMIN_COMPANIES_STORAGE_KEY);
    container.hidden = companies.length === 0;

    companies.forEach((company) => {
        const card = document.createElement('div');
        card.className = 'card company-card';
        const brand = document.createElement('div');
        brand.className = 'company-brand';
        const logo = document.createElement('span');
        logo.className = 'company-logo custom-company';
        logo.textContent = company.name.charAt(0).toUpperCase();
        const details = document.createElement('div');
        const name = document.createElement('h2');
        name.textContent = company.name;
        const role = document.createElement('small');
        role.textContent = company.role;
        details.append(name, role);
        brand.append(logo, details);
        const packageInfo = document.createElement('p');
        packageInfo.textContent = `Package: ${company.package}`;
        const locationInfo = document.createElement('p');
        locationInfo.textContent = `Location: ${company.location}`;
        const detailsButton = document.createElement('button');
        detailsButton.type = 'button';
        detailsButton.textContent = 'View Details';
        detailsButton.addEventListener('click', () => viewAdminCompanyDetails(company));
        card.append(brand, packageInfo, locationInfo, detailsButton);
        container.append(card);
    });
}

function viewAdminCompanyDetails(company) {
    const panel = document.getElementById('company-details-panel');
    if (!panel) return;

    const header = document.createElement('div');
    header.className = 'company-details-header';
    const title = document.createElement('h3');
    title.textContent = company.name;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'close-details';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', closeCompanyDetails);
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'company-details-body';
    [
        ['Role', company.role],
        ['Package', company.package],
        ['Location', company.location],
        ['Skills', company.skills],
        ['Eligibility', company.eligibility]
    ].forEach(([label, value]) => {
        const row = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        row.append(strong, document.createTextNode(value || 'Not provided'));
        body.append(row);
    });

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'save-btn';
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', () => apply(company.name, company.role));
    actions.append(applyButton);
    body.append(actions);

    panel.replaceChildren(header, body);
    panel.classList.remove('hidden');
    window.scrollTo({ top: panel.offsetTop - 20, behavior: 'smooth' });
}

function renderAdminAddedDrives() {
    const container = document.getElementById('admin-added-drives');
    if (!container) return;
    container.replaceChildren();
    const drives = getAdminRecords(ADMIN_DRIVES_STORAGE_KEY);
    container.hidden = drives.length === 0;

    drives.forEach((drive) => {
        const card = document.createElement('div');
        card.className = 'card';
        const brand = document.createElement('div');
        brand.className = 'company-brand';
        const logo = document.createElement('span');
        logo.className = 'company-logo custom-company';
        logo.textContent = drive.company.charAt(0).toUpperCase();
        const details = document.createElement('div');
        const name = document.createElement('h2');
        name.textContent = drive.company;
        const role = document.createElement('small');
        role.textContent = drive.role;
        details.append(name, role);
        brand.append(logo, details);
        const date = document.createElement('p');
        date.className = 'drive-date';
        const dateIcon = document.createElement('span');
        dateIcon.className = 'date-icon';
        dateIcon.textContent = '📅';
        date.append(dateIcon, document.createTextNode(new Date(`${drive.date}T00:00:00`).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        })));
        const applyButton = document.createElement('button');
        applyButton.className = 'drive-apply-btn';
        applyButton.type = 'button';
        applyButton.textContent = 'Apply Now';
        applyButton.addEventListener('click', () => apply(drive.company, drive.role));
        card.append(brand, date, applyButton);
        container.append(card);
    });
}

function updateAdminSummaryCounts() {
    const companyCount = document.getElementById('admin-company-count');
    const driveCount = document.getElementById('admin-drive-count');
    if (companyCount) companyCount.textContent = String(24 + getAdminRecords(ADMIN_COMPANIES_STORAGE_KEY).length);
    if (driveCount) driveCount.textContent = String(5 + getAdminRecords(ADMIN_DRIVES_STORAGE_KEY).length);
}

function getDefaultApplications() {
    return [
        { company: 'TCS', role: 'Software Engineer', status: 'Applied ✅' },
        { company: 'Infosys', role: 'System Engineer', status: 'Shortlisted 🎉' },
        { company: 'Wipro', role: 'IT Services', status: 'Under Review ⏳' },
        { company: 'Microsoft', role: 'Product Engineer', status: 'Applied ✅' },
        { company: 'Google', role: 'SDE Intern', status: 'Interview Tomorrow 🗓️' }
    ];
}

function getApplications() {
    const stored = localStorage.getItem(APPLICATIONS_STORAGE_KEY);

    if (!stored) {
        localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(getDefaultApplications()));
        return getDefaultApplications();
    }

    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length ? parsed : getDefaultApplications();
    } catch (error) {
        return getDefaultApplications();
    }
}

function saveApplications(applications) {
    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(applications));
}

function parseCompanyAndRole(company, fallbackRole = 'General') {
    const normalized = String(company || '').trim();
    const companyNames = ['TCS', 'Infosys', 'Wipro', 'Microsoft', 'Google'];

    const matchedCompany = companyNames.find((name) => normalized.toLowerCase().includes(name.toLowerCase()));

    if (matchedCompany) {
        return {
            company: matchedCompany,
            role: (normalized.replace(matchedCompany, '').trim() || fallbackRole).trim() || fallbackRole
        };
    }

    return {
        company: normalized || 'Company',
        role: fallbackRole
    };
}

function updateApplicationStatus(company, role, status) {
    const apps = getApplications();
    const normalizedCompany = String(company || '').trim();
    const target = apps.findIndex((app) => app.company.toLowerCase() === normalizedCompany.toLowerCase() && app.role.toLowerCase() === String(role || app.role).toLowerCase());

    if (target >= 0) {
        apps[target].status = status;
    } else {
        apps.push({ company: normalizedCompany, role: role || 'General', status });
    }

    saveApplications(apps);
    renderApplicationsTable();
}

function apply(company, roleInput = '') {
    const { company: companyName, role } = parseCompanyAndRole(company, roleInput || 'General');
    const status = 'Applied ✅';

    updateApplicationStatus(companyName, role, status);
    alert("Application submitted to " + companyName + " - " + role);
}

function markSelected(company, roleInput = '') {
    const { company: companyName, role } = parseCompanyAndRole(company, roleInput || 'General');
    const status = 'Selected 🎉';

    updateApplicationStatus(companyName, role, status);
    alert("Congratulations! You have been selected for " + companyName + " - " + role);
}


function viewDrive(company) {
    alert("Opening placement drive of " + company);
}

function viewCompanyDetails(company, role, packageRange, location, skills, eligibility, status = 'Hiring now') {
    const panel = document.getElementById('company-details-panel');
    if (!panel) return;

    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="company-details-header">
            <h3>${company}</h3>
            <button type="button" class="close-details" onclick="closeCompanyDetails()">Close</button>
        </div>
        <div class="company-details-body">
            <div><strong>Role:</strong> ${role}</div>
            <div><strong>Package:</strong> ${packageRange}</div>
            <div><strong>Location:</strong> ${location}</div>
            <div><strong>Skills:</strong> ${skills}</div>
            <div><strong>Eligibility:</strong> ${eligibility}</div>
            <div><strong>Status:</strong> ${status}</div>
            <div class="form-actions">
                <button class="save-btn" type="button" onclick="apply('${company}', '${role}')">Apply</button>
                <button class="secondary-btn" type="button" onclick="markSelected('${company}', '${role}')">Mark Selected</button>
            </div>
        </div>
    `;
    window.scrollTo({ top: panel.offsetTop - 20, behavior: 'smooth' });
}

function closeCompanyDetails() {
    const panel = document.getElementById('company-details-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.innerHTML = '';
}

function setupCompanySearch() {
    const searchInput = document.getElementById('companySearch');
    const cards = document.querySelectorAll('.company-card');

    if (!searchInput || !cards.length) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();

        cards.forEach((card) => {
            const companyName = card.querySelector('h2')?.textContent.toLowerCase() || '';
            const role = card.querySelector('small')?.textContent.toLowerCase() || '';
            const matches = companyName.includes(query) || role.includes(query);
            card.style.display = matches ? 'flex' : 'none';
        });
    });
}

function renderApplicationsTable() {
    const applicationsTableBody = document.getElementById('applications-table-body');
    const recentApplicationsTableBody = document.getElementById('recent-applications-table-body');
    const adminRecentApplicationsTableBody = document.getElementById('admin-recent-applications-table-body');
    if (!applicationsTableBody && !recentApplicationsTableBody && !adminRecentApplicationsTableBody) return;

    const applications = getApplications();

    if (!applications.length) {
        const emptyState = '<tr><td colspan="4">No applications yet.</td></tr>';
        if (applicationsTableBody) applicationsTableBody.innerHTML = emptyState;
        if (recentApplicationsTableBody) recentApplicationsTableBody.innerHTML = emptyState;
        if (adminRecentApplicationsTableBody) adminRecentApplicationsTableBody.innerHTML = emptyState;
        return;
    }

    const renderRows = (items) => items.map((application) => {
        const studentName = application.studentName || APPLICATION_STUDENT_NAMES[application.company.toLowerCase()];

        return `
        <tr>
            <td>${studentName || '—'}</td>
            <td>
                <div class="company-brand table-brand">
                    <span class="company-logo ${application.company.toLowerCase().includes('tcs') ? 'tcs' : application.company.toLowerCase().includes('infosys') ? 'infosys' : application.company.toLowerCase().includes('wipro') ? 'wipro' : application.company.toLowerCase().includes('microsoft') ? 'microsoft' : 'google'}">${application.company.charAt(0)}</span>
                    <div>
                        <h2>${application.company}</h2>
                    </div>
                </div>
            </td>
            <td>${application.role}</td>
            <td>${application.status}</td>
        </tr>
        `;
    }).join('');

    if (applicationsTableBody) applicationsTableBody.innerHTML = renderRows(applications);
    const recentApplications = renderRows(applications.slice(-3).reverse());
    if (recentApplicationsTableBody) recentApplicationsTableBody.innerHTML = recentApplications;
    if (adminRecentApplicationsTableBody) adminRecentApplicationsTableBody.innerHTML = recentApplications;
}

document.addEventListener('DOMContentLoaded', () => {
    protectProtectedPages();
    hydrateProfileFromStorage();
    loadRecommendations();
    renderApplicationsTable();
    renderAdminAddedCompanies();
    renderAdminAddedDrives();
    updateAdminSummaryCounts();
});

function toggleProfileEditor(show = true) {
    const panel = document.getElementById('edit-profile-panel');
    if (!panel) return;

    panel.hidden = !show;
    if (show) {
        window.scrollTo({ top: panel.offsetTop - 30, behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', setupCompanySearch);

function setupApplicationSearch() {
    const searchInput = document.getElementById('applicationSearch');
    const items = document.querySelectorAll('.application-item');

    if (!searchInput || !items.length) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();

        items.forEach((item) => {
            const companyName = item.querySelector('h2')?.textContent.toLowerCase() || '';
            const position = item.querySelector('p')?.textContent.toLowerCase() || '';
            const matches = companyName.includes(query) || position.includes(query);
            item.style.display = matches ? 'block' : 'none';
        });
    });
}

document.addEventListener('DOMContentLoaded', setupApplicationSearch);

function getStoredProfile() {
    const saved = localStorage.getItem('campusconnect_profile');
    if (!saved) {
        return {
            name: 'ABC',
            studentId: '2610000',
            branch: 'Information Technology',
            year: '2nd Year',
            email: 'student@college.edu',
            skills: 'C, Python, Java, HTML, CSS'
        };
    }

    try {
        return JSON.parse(saved);
    } catch (error) {
        return {
            name: 'ABC',
            studentId: '2610000',
            branch: 'Information Technology',
            year: '2nd Year',
            email: 'student@college.edu',
            skills: 'C, Python, Java, HTML, CSS'
        };
    }
}

function hydrateProfileFromStorage() {
    const values = getStoredProfile();

    const fieldMap = [
        ['edit-name', values.name],
        ['edit-student-id', values.studentId],
        ['edit-branch', values.branch],
        ['edit-year', values.year],
        ['edit-email', values.email],
        ['edit-skills', values.skills]
    ];

    fieldMap.forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
    });

    const profileName = document.getElementById('profile-name');
    const profileStudentId = document.getElementById('profile-student-id');
    const profileBranch = document.getElementById('profile-branch');
    const profileYear = document.getElementById('profile-year');
    const profileEmail = document.getElementById('profile-email');
    const profileSkills = document.getElementById('profile-skills');

    if (profileName) profileName.textContent = values.name;
    if (profileStudentId) profileStudentId.textContent = values.studentId;
    if (profileBranch) profileBranch.textContent = values.branch;
    if (profileYear) profileYear.textContent = values.year;
    if (profileEmail) profileEmail.textContent = values.email;
    if (profileSkills) profileSkills.textContent = values.skills;
}

function saveProfileChanges() {
    const values = {
        name: document.getElementById('edit-name')?.value || 'ABC',
        studentId: document.getElementById('edit-student-id')?.value || '2610000',
        branch: document.getElementById('edit-branch')?.value || 'Information Technology',
        year: document.getElementById('edit-year')?.value || '2nd Year',
        email: document.getElementById('edit-email')?.value || 'student@college.edu',
        skills: document.getElementById('edit-skills')?.value || 'C, Python, Java, HTML, CSS'
    };

    localStorage.setItem('campusconnect_profile', JSON.stringify(values));

    document.getElementById('profile-name').textContent = values.name;
    document.getElementById('profile-student-id').textContent = values.studentId;
    document.getElementById('profile-branch').textContent = values.branch;
    document.getElementById('profile-year').textContent = values.year;
    document.getElementById('profile-email').textContent = values.email;
    document.getElementById('profile-skills').textContent = values.skills;

    toggleProfileEditor(false);
    alert('Profile updated successfully.');
    loadRecommendations();
}

async function loadRecommendations() {
    const panel = document.getElementById('recommended-companies');
    if (!panel) return;

    const profile = getStoredProfile();
    const skills = (profile.skills || '').split(',').map((item) => item.trim()).filter(Boolean);

    try {
        const response = await fetch(`/api/recommendations?skills=${encodeURIComponent(skills.join(','))}`);
        const data = await response.json();
        const list = data.recommendations || [];

        if (!list.length) {
            panel.innerHTML = '<h3>Recommended for You</h3><p>No recommendation data available.</p>';
            return;
        }

        panel.innerHTML = `
            <h3>Recommended for You</h3>
            <div class="cards company-list">
                ${list.map((company) => `
                    <div class="card company-card">
                        <div class="company-brand">
                            <span class="company-logo ${company.name.toLowerCase().includes('tcs') ? 'tcs' : company.name.toLowerCase().includes('infosys') ? 'infosys' : company.name.toLowerCase().includes('wipro') ? 'wipro' : company.name.toLowerCase().includes('microsoft') ? 'microsoft' : 'google'}">${company.name.charAt(0)}</span>
                            <div>
                                <h2>${company.name}</h2>
                                <small>${company.role}</small>
                            </div>
                        </div>
                        <p>Match: ${company.match}%</p>
                        <p>Package: ${company.package}</p>
                        <p>Location: ${company.location}</p>
                        <button onclick="viewCompanyDetails('${company.name}', '${company.role}', '${company.package}', '${company.location}', '${company.skills.join(', ')}', 'Based on your skills and profile match')">View Details</button>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Recommendation load failed:', error);
        panel.innerHTML = '<h3>Recommended for You</h3><p>Recommendations will appear here once the server responds.</p>';
    }
}

