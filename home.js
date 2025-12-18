function selectRole(role) {
    localStorage.setItem('selectedRole', role);
    window.location.href = 'login.html';
}

function registerRole(role) {
    localStorage.setItem('selectedRole', role);
    window.location.href = 'register.html';
}
