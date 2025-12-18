// Notification System

function createNotification(title, message, type = 'info', userId = null) {
    const notification = {
        id: Date.now().toString(),
        title: title,
        message: message,
        type: type, // info, success, warning, error
        userId: userId, // null for all users
        read: false,
        createdAt: new Date().toISOString()
    };
    
    addNotification(notification);
    
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico'
        });
    }
}

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showAlert('Notifications enabled!', 'success');
            }
        });
    }
}

function loadNotifications() {
    const user = getCurrentUser();
    const allNotifications = getNotifications();
    
    // Filter notifications for current user
    const userNotifications = allNotifications.filter(n => 
        !n.userId || n.userId === user.id
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    displayNotifications(userNotifications);
    updateNotificationBadge(userNotifications.filter(n => !n.read).length);
}

function displayNotifications(notifications) {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No notifications</p>';
        return;
    }
    
    let html = '';
    notifications.forEach(notification => {
        const typeClass = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'error': 'alert-error'
        }[notification.type] || 'alert-info';
        
        html += `
            <div class="card mb-2 ${notification.read ? '' : 'unread'}" style="border-left: 4px solid var(--primary-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="color: var(--primary-color); margin-bottom: 5px;">${notification.title}</h4>
                        <p style="color: var(--gray); margin-bottom: 10px;">${notification.message}</p>
                        <small style="color: var(--gray);">${new Date(notification.createdAt).toLocaleString()}</small>
                    </div>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteNotification('${notification.id}')">Delete</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function markAsRead(notificationId) {
    let notifications = getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        saveNotifications(notifications);
        loadNotifications();
    }
}

function deleteNotification(notificationId) {
    let notifications = getNotifications();
    notifications = notifications.filter(n => n.id !== notificationId);
    saveNotifications(notifications);
    loadNotifications();
}

function markAllAsRead() {
    const user = getCurrentUser();
    let notifications = getNotifications();
    notifications = notifications.map(n => {
        if ((!n.userId || n.userId === user.id) && !n.read) {
            n.read = true;
        }
        return n;
    });
    saveNotifications(notifications);
    loadNotifications();
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

// Auto-create notifications for new exams
function checkNewExamNotifications() {
    const user = getCurrentUser();
    if (user.role !== 'student') return;
    
    const exams = getExams();
    const notifications = getNotifications();
    const lastCheck = localStorage.getItem('lastNotificationCheck') || new Date(0).toISOString();
    
    exams.forEach(exam => {
        if (new Date(exam.createdAt) > new Date(lastCheck)) {
            createNotification(
                'New Exam Available',
                `A new exam "${exam.title}" is now available!`,
                'info',
                null // All students
            );
        }
    });
    
    localStorage.setItem('lastNotificationCheck', new Date().toISOString());
}

// Check for exam deadlines
function checkDeadlineNotifications() {
    const user = getCurrentUser();
    if (user.role !== 'student') return;
    
    const exams = getExams();
    const now = new Date();
    
    exams.forEach(exam => {
        if (exam.settings && exam.settings.endDate) {
            const endDate = new Date(exam.settings.endDate + (exam.settings.endTime ? 'T' + exam.settings.endTime : ''));
            const hoursUntilDeadline = (endDate - now) / (1000 * 60 * 60);
            
            if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 24) {
                createNotification(
                    'Exam Deadline Approaching',
                    `"${exam.title}" deadline is in ${Math.round(hoursUntilDeadline)} hours!`,
                    'warning',
                    null
                );
            }
        }
    });
}

