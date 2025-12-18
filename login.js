const role = localStorage.getItem('selectedRole') || 'student';
document.getElementById('roleText').textContent = `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`;

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password && u.role === role);
    
    if (user) {
        setCurrentUser(user);
        showAlert('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            if (role === 'teacher') {
                window.location.href = 'teacher-dashboard.html';
            } else {
                window.location.href = 'student-dashboard.html';
            }
        }, 1000);
    } else {
        showAlert('Invalid email or password. Please try again.', 'error');
    }
});
