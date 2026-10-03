let selectedRole = 'student';

function setRole(role) {
    selectedRole = role;
    const studentIdLabel = document.getElementById('studentIdLabel');
    const studentIdInput = document.getElementById('studentId');

    if (role === 'student') {
        studentIdLabel.style.display = 'block';
        studentIdInput.style.display = 'block';
    } else {
        studentIdLabel.style.display = 'none';
        studentIdInput.style.display = 'none';
    }
}

async function registerUser() {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!name || !email || !password) {
        alert('Please fill in all required fields.');
        return;
    }

    if (selectedRole === 'student' && !studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                password,
                role: selectedRole,
                studentId: selectedRole === 'student' ? studentId : null
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            alert(data.message || 'Registration failed.');
            return;
        }

        alert(data.message);
        window.location.href = 'login.html';
    } catch (error) {
        console.error(error);
        alert('Registration failed. Please try again later.');
    }
}

setRole(selectedRole);
