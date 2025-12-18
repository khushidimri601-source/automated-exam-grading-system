// Password Reset Functionality

function requestPasswordReset(email) {
    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        showAlert('Email not found!', 'error');
        return;
    }
    
    // Generate reset token (in real app, this would be sent via email)
    const resetToken = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(`resetToken_${user.id}`, resetToken);
    localStorage.setItem(`resetTokenExpiry_${user.id}`, (Date.now() + 3600000).toString()); // 1 hour
    
    showAlert('Password reset link would be sent to your email. For demo: Token = ' + resetToken, 'info');
}

function resetPassword(token, newPassword) {
    const users = getUsers();
    let userFound = null;
    
    // Find user with matching token
    for (let user of users) {
        const storedToken = localStorage.getItem(`resetToken_${user.id}`);
        const expiry = localStorage.getItem(`resetTokenExpiry_${user.id}`);
        
        if (storedToken === token && expiry && Date.now() < parseInt(expiry)) {
            userFound = user;
            break;
        }
    }
    
    if (!userFound) {
        showAlert('Invalid or expired reset token!', 'error');
        return false;
    }
    
    // Update password
    userFound.password = newPassword; // In real app, hash this
    const userIndex = users.findIndex(u => u.id === userFound.id);
    users[userIndex] = userFound;
    saveUsers(users);
    
    // Clear reset token
    localStorage.removeItem(`resetToken_${userFound.id}`);
    localStorage.removeItem(`resetTokenExpiry_${userFound.id}`);
    
    showAlert('Password reset successfully!', 'success');
    return true;
}

function changePassword(currentPassword, newPassword) {
    const user = getCurrentUser();
    if (!user) {
        showAlert('Not logged in!', 'error');
        return false;
    }
    
    if (user.password !== currentPassword) {
        showAlert('Current password is incorrect!', 'error');
        return false;
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    users[userIndex].password = newPassword; // In real app, hash this
    saveUsers(users);
    
    // Update current user
    user.password = newPassword;
    setCurrentUser(user);
    
    showAlert('Password changed successfully!', 'success');
    return true;
}

