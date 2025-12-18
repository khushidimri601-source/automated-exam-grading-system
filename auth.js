function initStorage() {
    if (!localStorage.getItem('users')) {
        localStorage.setItem('users', JSON.stringify([]));
    }
    if (!localStorage.getItem('exams')) {
        localStorage.setItem('exams', JSON.stringify([]));
    }
    if (!localStorage.getItem('results')) {
        localStorage.setItem('results', JSON.stringify([]));
    }
}

function getUsers() {
    initStorage();
    return JSON.parse(localStorage.getItem('users'));
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedRole');
    window.location.href = 'index.html';
}

function checkAuth(requiredRole) {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

initStorage();
