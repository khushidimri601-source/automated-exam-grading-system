const role = localStorage.getItem('selectedRole') || 'student';
document.getElementById('roleText').textContent = `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`;

document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showAlert('Passwords do not match!', 'error');
        return;
    }
    
    const users = getUsers();
    
    if (users.find(u => u.email === email)) {
        showAlert('Email already registered. Please login instead.', 'error');
        return;
    }
    
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    showAlert('Registration successful! Redirecting to login...', 'success');
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
});
