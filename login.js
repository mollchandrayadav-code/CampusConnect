function setRole(role) {
    const selectedRole = role === 'admin' ? 'admin' : 'student';
    localStorage.setItem('campusconnect_selected_role', selectedRole);

    if (selectedRole === 'admin') {
        document.getElementById("sid").style.display = "none";
        document.getElementById("student").style.display = "none";
    } else {
        document.getElementById("sid").style.display = "block";
        document.getElementById("student").style.display = "block";
    }
}

function student() {
    setRole('student');
}

function admin() {
    setRole('admin');
}

function getSelectedRole() {
    const savedRole = localStorage.getItem('campusconnect_selected_role');
    if (savedRole === 'admin') return 'admin';
    return 'student';
}

async function loginUser() {
    const role = getSelectedRole();

    if (role === 'admin') {
        localStorage.setItem('campusconnect_loggedin', 'true');
        localStorage.setItem('campusconnect_selected_role', 'admin');
        window.location.href = 'admin dashboard.html';
        return;
    }

    const studentId = document.getElementById("student").value.trim();

    if (!studentId) {
        alert("Please enter your Student ID");
        return;
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Please enter Email and Password");
        return;
    }

    try {
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? (window.location.port && window.location.port !== '3000' ? 'http://localhost:3000' : '')
            : (window.location.protocol === 'file:' ? 'http://localhost:3000' : '');
        const response = await fetch(`${apiBase}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, role, studentId })
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : { success: false, message: 'The login API was not found. Open the app at http://localhost:3000.' };

        if (!response.ok || !data.success) {
            alert(data.message || 'Login failed.');
            return;
        }

        localStorage.setItem('campusconnect_loggedin', 'true');
        localStorage.setItem('campusconnect_selected_role', data.role || role);
        alert(data.message);
        const redirectPath = data.redirect || '/student-dashboard';
        window.location.href = apiBase ? `${apiBase}${redirectPath}` : redirectPath;
    } catch (error) {
        console.error(error);
        alert('Cannot reach the login server. Start it with "npm start" and open http://localhost:3000.');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('login.html') && localStorage.getItem('campusconnect_loggedin') === 'true') {
        window.location.href = 'code.html';
    }

    const savedRole = localStorage.getItem('campusconnect_selected_role');
    if (savedRole === 'admin') {
        document.getElementById("sid").style.display = 'none';
        document.getElementById("student").style.display = 'none';
    } else {
        document.getElementById("sid").style.display = 'block';
        document.getElementById("student").style.display = 'block';
    }
});
