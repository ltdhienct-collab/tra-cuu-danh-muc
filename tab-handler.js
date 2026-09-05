// ===== TAB SWITCHING HANDLER =====
// File này xử lý chức năng chuyển tab giữa "Tra cứu" và "Công việc"

document.addEventListener('DOMContentLoaded', function() {
    console.log('Tab handler loaded');
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Function to switch tabs
    function switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        const targetContent = document.getElementById(tabName + '-tab');
        
        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetContent.classList.add('active');
            console.log('Tab switched successfully');
            
            // ===== REFRESH TODO LIST KHI CHUYỂN SANG TAB TASKS =====
            if (tabName === 'tasks') {
                console.log('Refreshing todo list and quick view...');
                
                // Refresh todo list nếu function tồn tại
                if (typeof renderTodoList === 'function') {
                    renderTodoList();
                }
                if (typeof updateTodoStats === 'function') {
                    updateTodoStats();
                }
                if (typeof renderQuickView === 'function') {
                    renderQuickView();
                }
                
                // Đảm bảo Quick View Panel hiển thị
                const quickViewPanel = document.getElementById('quickViewPanel');
                if (quickViewPanel) {
                    quickViewPanel.style.display = 'block';
                }
            }
            // ===== END REFRESH =====
            
        } else {
            console.error('Tab elements not found:', { targetButton, targetContent });
        }
        
        // Save active tab to storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ activeTab: tabName });
        }
    }
    
    // Add click event to tab buttons
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                if (tabName) {
                    switchTab(tabName);
                }
            });
        });
        console.log(`Added click handlers to ${tabButtons.length} tab buttons`);
    } else {
        console.warn('No tab buttons found');
    }
    
    // Restore last active tab from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['activeTab'], function(result) {
            if (result.activeTab) {
                console.log('Restoring tab:', result.activeTab);
                switchTab(result.activeTab);
            } else {
                // Default to first tab (lookup)
                switchTab('lookup');
            }
        });
    } else {
        // If no chrome.storage, default to first tab
        switchTab('lookup');
    }
});
