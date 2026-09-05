// 1. Kiểm tra nếu trang đang chạy dạng Tab riêng để gán class
if (true) {
    document.documentElement.classList.add('is-full-tab');
}

// 2. Sự kiện khi bấm nút mở Tab mới (Chỉ gán 1 lần duy nhất)
document.getElementById('btnOpenFullTab')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'popup.html?mode=tab' });
});
// Định nghĩa CSS
const styles = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .alert {
        margin-bottom: 1rem;
        display: none;
    }
`;
// Thêm style vào head
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

let isLocationSelectorsInitialized = false;
let adminFiltersInitialized = false; // THÊM MỚI

// ===== HỆ THỐNG NOTIFICATION =====
const NOTIFICATION_CONFIG = {
    EXTENSION_VERSION: '4.1',
    VERSION_KEY: 'extensionVersion',
    LAST_NOTIFICATION_KEY: 'lastNotificationDate'
};

// Hàm tạo notification
function showNotification(title, message, type = 'basic') {
    const notificationOptions = {
        type: type,
        iconUrl: 'icon128.png',
        title: title,
        message: message,
        priority: 2
    };

    chrome.notifications.create('', notificationOptions, function(notificationId) {
        // Tự động đóng notification sau 5 giây
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 5000);
    });
}

// Hàm kiểm tra và thông báo version mới
function checkForUpdates() {
    chrome.storage.local.get([NOTIFICATION_CONFIG.VERSION_KEY], function(result) {
        const savedVersion = result[NOTIFICATION_CONFIG.VERSION_KEY];
        
        if (!savedVersion || savedVersion !== NOTIFICATION_CONFIG.EXTENSION_VERSION) {
            // Có version mới hoặc lần đầu sử dụng
            showNotification(
                '🎉 Cập nhật thành công!',
                `Extension đã được cập nhật lên version ${NOTIFICATION_CONFIG.EXTENSION_VERSION}. Tính năng mới: Lưu bộ lọc tỉnh, Thông báo & To-Do List quản lý công việc!`,
                'basic'
            );
            
            // Lưu version hiện tại
            chrome.storage.local.set({ 
                [NOTIFICATION_CONFIG.VERSION_KEY]: NOTIFICATION_CONFIG.EXTENSION_VERSION 
            });
        }
    });
}

// Hàm thông báo thành công
function showSuccessNotification(message) {
    showNotification('✅ Thành công', message, 'basic');
}

// Hàm thông báo lỗi
function showErrorNotification(message) {
    showNotification('❌ Lỗi', message, 'basic');
}

// Hàm thông báo thông tin
function showInfoNotification(message) {
    showNotification('ℹ️ Thông tin', message, 'basic');
}
// ===== KẾT THÚC HỆ THỐNG NOTIFICATION =====


document.addEventListener('DOMContentLoaded', function() {
    createLoadingAndErrorUI();
    checkForUpdates(); // Kiểm tra cập nhật khi mở extension
    
    const tableSelector = document.getElementById('tableSelector');
    const tables = document.querySelectorAll('.table-container');
    let notesData = {};
  
    // Khôi phục bảng đã chọn lần cuối từ chrome.storage.local
    chrome.storage.local.get(['selectedTable', 'notesData'], function(result) {
        const selectedTable = result.selectedTable || 'table1';
        const locationSelectors = document.getElementById('locationSelectors');
        const adminFilters = document.getElementById('adminFilters');
        notesData = result.notesData || {};
        
        tableSelector.value = selectedTable;
        document.getElementById(selectedTable).classList.add('active');

        // Xử lý hiển thị selectors cho table7 và table9
        if (selectedTable === 'table7') {
            locationSelectors.style.display = 'block';
            adminFilters.style.display = 'none';
            if (!isLocationSelectorsInitialized) {
                initializeLocationSelectors();
            }
        } else if (selectedTable === 'table9') {
            locationSelectors.style.display = 'none';
            adminFilters.style.display = 'block';
            if (!adminFiltersInitialized) {
                initializeAdminFilters();
            }
        } else {
            locationSelectors.style.display = 'none';
            adminFilters.style.display = 'none';
        }

        updateSearchCount();
        const exportExcelBtn = document.getElementById('exportExcelBtn');
         if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
         }
         restoreData();
         restoreAdminData();
         initializeNoteListeners();
         initializeAdminNoteListeners();
    });

    // Xử lý sự kiện thay đổi bảng
    tableSelector.addEventListener('change', function() {
        const selectedTable = tableSelector.value;
        const locationSelectors = document.getElementById('locationSelectors');
        const adminFilters = document.getElementById('adminFilters');

        // Ẩn tất cả các bảng
        tables.forEach(table => table.classList.remove('active'));

        // Hiển thị bảng được chọn
        document.getElementById(selectedTable).classList.add('active');

        // Xử lý hiển thị selectors
        if (selectedTable === 'table7') {
            locationSelectors.style.display = 'block';
            adminFilters.style.display = 'none';
            if (!isLocationSelectorsInitialized) {
                initializeLocationSelectors();
            }
        } else if (selectedTable === 'table9') {
            locationSelectors.style.display = 'none';
            adminFilters.style.display = 'block';
            if (!adminFiltersInitialized) {
                initializeAdminFilters();
            }
        } else {
            locationSelectors.style.display = 'none';
            adminFilters.style.display = 'none';
        }

        // Clear search input khi chuyển bảng
        document.getElementById('searchInput').value = '';
        
        updateSearchCount();
        chrome.storage.local.set({ selectedTable: selectedTable });
    });

    // Thêm event listeners cho import/export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', importData);
    }

    // THÊM: Event listener cho nút To-Do List
    const toggleTodoBtn = document.getElementById('toggleTodoBtn');
    if (toggleTodoBtn) {
        toggleTodoBtn.addEventListener('click', toggleTodoList);
    }
    
    // ===== KHỞI TẠO TODO LIST NGAY KHI LOAD =====
    // Vì giờ dùng tab thay vì toggle button, cần khởi tạo todo list ngay
    console.log('Initializing Todo List...');
    initializeTodoList();
    
    // Khởi tạo Quick View Panel
    const viewFullTodoListBtn = document.getElementById('viewFullTodoList');
    const closeQuickViewBtn = document.getElementById('closeQuickView');
    
    if (viewFullTodoListBtn) {
        viewFullTodoListBtn.addEventListener('click', function() {
            // Chuyển sang tab tasks
            const tasksTab = document.querySelector('[data-tab="tasks"]');
            if (tasksTab) {
                tasksTab.click();
            }
        });
    }
    
    if (closeQuickViewBtn) {
        closeQuickViewBtn.addEventListener('click', function() {
            const quickViewPanel = document.getElementById('quickViewPanel');
            if (quickViewPanel) {
                quickViewPanel.style.display = 'none';
            }
        });
    }
    // ===== KẾT THÚC KHỞI TẠO TODO LIST =====

    // SỬA LẠI: Xử lý sự kiện tìm kiếm
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const activeTable = document.querySelector('.table-container.active');
            
            // Không tìm kiếm nếu đang ở To-Do List
            if (activeTable && activeTable.id === 'todoList') {
                return;
            }
        
        if (activeTable && activeTable.id === 'table9') {
            // Sử dụng hàm lọc riêng cho table9
            filterAdminTable();
        } else {
            // Logic tìm kiếm cho các bảng khác
            const searchTerm = this.value.toLowerCase();
            const tableRows = activeTable.querySelectorAll('tbody tr');

            tableRows.forEach(row => {
                let match = false;
                
                // Clear highlights trước
                row.querySelectorAll('td').forEach(cell => {
                    if (!cell.hasAttribute('contenteditable')) {
                        cell.innerHTML = cell.textContent;
                    }
                });

                if (searchTerm) {
                    row.querySelectorAll('td').forEach(cell => {
                    const cellText = cell.textContent.toLowerCase();
                    if (cellText.includes(searchTerm)) {
                        match = true;
                        const regex = new RegExp(`(${searchTerm})`, 'gi');
                        cell.innerHTML = cell.textContent.replace(regex, '<span class="highlight">$1</span>');
                    } else {
                        cell.innerHTML = cell.textContent;
                    }
                    });
                } else {
                    match = true;
                }

                row.style.display = match ? '' : 'none';
            });

            updateSearchCount();
        }
    }, 300));
    }
});

// Hàm khởi tạo bộ lọc cho table9
function initializeAdminFilters() {
    if (adminFiltersInitialized) return;

    const provinceFilter = document.getElementById('provinceFilter');
    const levelFilter = document.getElementById('levelFilter');

    // Tạo danh sách tỉnh từ dữ liệu có sẵn
    const provinces = [];
    document.querySelectorAll('#adminTableBody tr[data-level="province"]').forEach(row => {
        const code = row.dataset.province;
        const name = row.cells[1].textContent.replace('🏛️', '').replace('🏞️', '').trim();
        provinces.push({ code, name });
    });

    // Thêm các tỉnh vào select
    provinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province.code;
        option.textContent = `${province.code} - ${province.name}`;
        provinceFilter.appendChild(option);
    });

    // Event listeners cho bộ lọc
    provinceFilter.addEventListener('change', function() {
        // Lưu giá trị filter vào chrome.storage
        chrome.storage.local.set({ 
            'adminProvinceFilter': this.value 
        });
        filterAdminTable();
    });
    
    levelFilter.addEventListener('change', function() {
        // Lưu giá trị filter vào chrome.storage
        chrome.storage.local.set({ 
            'adminLevelFilter': this.value 
        });
        filterAdminTable();
    });

    // Khôi phục giá trị filter đã lưu
    chrome.storage.local.get(['adminProvinceFilter', 'adminLevelFilter'], function(result) {
        if (result.adminProvinceFilter) {
            provinceFilter.value = result.adminProvinceFilter;
        }
        if (result.adminLevelFilter) {
            levelFilter.value = result.adminLevelFilter;
        }
        // Áp dụng filter sau khi khôi phục
        filterAdminTable();
    });

    adminFiltersInitialized = true;
    updateAdminStats();
}

// SỬA LẠI: Hàm lọc bảng hành chính
function filterAdminTable() {
    const provinceFilter = document.getElementById('provinceFilter').value;
    const levelFilter = document.getElementById('levelFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const rows = document.querySelectorAll('#adminTableBody tr');

    rows.forEach(row => {
        let show = true;

        // Lọc theo tỉnh
        if (provinceFilter && row.dataset.province !== provinceFilter) {
            show = false;
        }

        // Lọc theo cấp
        if (levelFilter && row.dataset.level !== levelFilter) {
            show = false;
        }

        // Clear previous highlights trước
        row.querySelectorAll('td').forEach(cell => {
            //if (!cell.hasAttribute('contenteditable')) {
                cell.innerHTML = cell.textContent;
            //}
        });

        // Lọc theo từ khóa tìm kiếm
        if (searchTerm) {
            const text = row.textContent.toLowerCase();
            if (!text.includes(searchTerm)) {
                show = false;
            } else if (show) {
                // Chỉ highlight nếu row vẫn được hiển thị
                row.querySelectorAll('td').forEach(cell => {
                    //if (!cell.hasAttribute('contenteditable')) {
                        const cellText = cell.textContent;
                        if (cellText.toLowerCase().includes(searchTerm)) {
                            const regex = new RegExp(`(${searchTerm})`, 'gi');
                            cell.innerHTML = cellText.replace(regex, '<span class="highlight">$1</span>');
                        }
                    //}
                });
            }
        }

        row.style.display = show ? '' : 'none';
    });

    updateAdminStats();
}

// Hàm cập nhật thống kê cho table9
function updateAdminStats() {
    const allRows = document.querySelectorAll('#adminTableBody tr');
    const visibleRows = document.querySelectorAll('#adminTableBody tr:not([style*="display: none"])');
    const provinces = document.querySelectorAll('#adminTableBody tr[data-level="province"]:not([style*="display: none"])');
    const communes = document.querySelectorAll('#adminTableBody tr[data-level="commune"]:not([style*="display: none"])');

    // Safely update count elements if they exist
    const adminProvinceCountEl = document.getElementById('adminProvinceCount');
    const adminCommuneCountEl = document.getElementById('adminCommuneCount');
    const adminVisibleCountEl = document.getElementById('adminVisibleCount');
    const adminTotalCountEl = document.getElementById('adminTotalCount');
    const visibleCountEl = document.getElementById('visibleCount');
    const totalCountEl = document.getElementById('totalCount');
    
    if (adminProvinceCountEl) adminProvinceCountEl.textContent = provinces.length;
    if (adminCommuneCountEl) adminCommuneCountEl.textContent = communes.length;
    if (adminVisibleCountEl) adminVisibleCountEl.textContent = visibleRows.length;
    if (adminTotalCountEl) adminTotalCountEl.textContent = allRows.length;
    if (visibleCountEl) visibleCountEl.textContent = visibleRows.length;
    if (totalCountEl) totalCountEl.textContent = allRows.length;
}

// Cập nhật updateSearchCount để hỗ trợ table9
function updateSearchCount() {
    const activeTable = document.querySelector('.table-container.active');
    
    // Không update count nếu đang ở To-Do List
    if (activeTable && activeTable.id === 'todoList') {
        return;
    }
    
    if (activeTable && activeTable.id === 'table9') {
        updateAdminStats();
        
        return;
         
    }
    
    // Logic cũ cho các bảng khác
    const totalRows = activeTable.querySelectorAll('tbody tr').length;
    const visibleRows = activeTable.querySelectorAll('tbody tr:not([style*="display: none"])').length;
    
    // Safely update count elements if they exist
    const visibleCountEl = document.getElementById('visibleCount');
    const totalCountEl = document.getElementById('totalCount');
    
    if (visibleCountEl) {
        visibleCountEl.textContent = visibleRows;
    }
    if (totalCountEl) {
        totalCountEl.textContent = totalRows;
    }
    
}

// Event listener cho note cells trong table9
function initializeAdminNoteListeners() {
    document.querySelectorAll('#adminTableBody td.note').forEach(td => {
        td.addEventListener('input', saveAdminData);
    });
}

// Hàm lưu dữ liệu riêng cho table9
function saveAdminData() {
    const rows = Array.from(document.querySelectorAll('#adminTableBody tr'));
    const adminData = rows.map(row => ({
        code: row.cells[0].textContent.trim(),
        name: row.cells[1].textContent.trim(),
        reason: row.cells[2].textContent.trim(),
        level: row.dataset.level,
        province: row.dataset.province
    }));

    chrome.storage.local.set({ 'adminData': adminData }, function() {
        console.log('Admin data saved:', adminData);
    });
}

// Hàm khôi phục dữ liệu cho table9
function restoreAdminData() {
    chrome.storage.local.get('adminData', function(result) {
        const { adminData } = result;
        if (adminData) {
            adminData.forEach((rowData, index) => {
                const row = document.querySelector(`#adminTableBody tr:nth-child(${index + 1})`);
                if (row && row.cells[2]) {
                    row.cells[2].textContent = rowData.reason;
                }
            });
        }
    });
}

// Hàm lấy dữ liệu Excel cho table9
function getAdminExcelData() {
    const table = document.getElementById('adminTable');
    const rows = table.querySelectorAll('tbody tr');
    const data = [];

    // Thêm header
    data.push(['Mã', 'Tên đơn vị', 'Lý do sát nhập']);

    // Lấy dữ liệu từ các dòng hiển thị
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const rowData = [
                row.cells[0].textContent.trim(),
                row.cells[1].textContent.trim().replace(/└─\s*/, '').replace(/🏛️|🏞️/g, '').trim(),
                row.cells[2].textContent.trim()
            ];
            data.push(rowData);
        }
    });

    return data;
}

// Cập nhật exportToExcel để hỗ trợ table9
function exportToExcel() {
    const activeTable = document.querySelector('.table-container.active');
    let data;
    let columnWidths;
    
    if (activeTable.id === 'table9') {
        data = getAdminExcelData();
        columnWidths = [{ wch: 15 }, { wch: 40 }, { wch: 50 }];
    } else {
        data = getExcelData(activeTable.id);
        columnWidths = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = columnWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const tableSelect = document.getElementById('tableSelector');
    const selectedText = tableSelect.options[tableSelect.selectedIndex].text;
    const fileName = `${selectedText}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

// ===== CÁC HÀM CŨ GIỮ NGUYÊN =====

async function initializeLocationSelectors() {
    if (isLocationSelectorsInitialized) return;

    const provinceSelect = document.getElementById('provinceSelect');
    const districtSelect = document.getElementById('districtSelect');

    try {
        showLoading();
        
        const response = await fetch(API_URL.PROVINCES);
        const provinces = await response.json();

        provinceSelect.innerHTML = '<option value="">Chọn Tỉnh/TP</option>';
        districtSelect.innerHTML = '<option value="">Chọn Quận/Huyện</option>';

        provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province.code;
            const formattedCode = String(province.code).padStart(2, '0');
            option.textContent = `${formattedCode} - ${province.name}`;
            provinceSelect.appendChild(option);
        });

        // Thông báo load dữ liệu thành công
        // showInfoNotification(`Đã tải ${provinces.length} tỉnh/thành phố từ API!`);

        provinceSelect.addEventListener('change', handleProvinceChange);
        districtSelect.addEventListener('change', handleDistrictChange);

        chrome.storage.local.get(['selectedProvince', 'selectedDistrict'], async function(result) {
            if (result.selectedProvince) {
                provinceSelect.value = result.selectedProvince;
                await handleProvinceChange();
                
                if (result.selectedDistrict) {
                    districtSelect.value = result.selectedDistrict;
                    await handleDistrictChange();
                }
            }
        });

        isLocationSelectorsInitialized = true;
        
    } catch (error) {
        console.error('Lỗi khởi tạo:', error);
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        showErrorNotification('Không thể kết nối API. Vui lòng kiểm tra kết nối mạng!');
    } finally {
        hideLoading();
    }
}

async function handleProvinceChange() {
    const provinceSelect = document.getElementById('provinceSelect');
    const districtSelect = document.getElementById('districtSelect');
    
    districtSelect.innerHTML = '<option value="">Chọn Quận/Huyện</option>';
    districtSelect.disabled = !provinceSelect.value;

    if (!provinceSelect.value) {
        chrome.storage.local.remove(['selectedProvince', 'selectedDistrict']);
        return;
    }

    try {
        showLoading();

        const response = await fetch(API_URL.getProvinceDetails(provinceSelect.value));
        if (!response.ok) throw new Error('Network response was not ok');
        
        const provinceData = await response.json();

        districtSelect.disabled = false;
        provinceData.districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district.code;
            const formattedCode = String(district.code).padStart(3, '0');
            option.textContent = `${formattedCode} - ${district.name}`;
            districtSelect.appendChild(option);
        });

        const tableData = [{
            code: provinceData.code,
            name: provinceData.name,
            level: 'Tỉnh/Thành phố'
        }];

        provinceData.districts.forEach(district => {
            tableData.push({
                code: district.code,
                name: district.name,
                level: 'Quận/Huyện'
            });

            if (district.wards) {
                district.wards.forEach(ward => {
                    tableData.push({
                        code: ward.code,
                        name: ward.name,
                        level: 'Phường/Xã'
                    });
                });
            }
        });

        updateLocationTable(tableData);
        
        chrome.storage.local.set({ 'selectedProvince': provinceSelect.value });

    } catch (error) {
        console.error('Lỗi khi tải dữ liệu tỉnh:', error);
        showError('Không thể tải dữ liệu tỉnh. Vui lòng thử lại sau.');
    } finally {
        hideLoading();
    }
}

async function handleDistrictChange() {
    const provinceSelect = document.getElementById('provinceSelect');
    const districtSelect = document.getElementById('districtSelect');
    
    if (!districtSelect.value) {
        return handleProvinceChange();
    }

    try {
        showLoading();
        
        const response = await fetch(API_URL.getProvinceDetails(provinceSelect.value));
        const provinceData = await response.json();
        
        const selectedDistrict = provinceData.districts.find(
            d => String(d.code) === districtSelect.value
        );

        if (selectedDistrict) {
            const tableData = [{
                code: selectedDistrict.code,
                name: selectedDistrict.name,
                level: 'Quận/Huyện'
            }];

            if (selectedDistrict.wards) {
                selectedDistrict.wards.forEach(ward => {
                    tableData.push({
                        code: ward.code,
                        name: ward.name,
                        level: 'Phường/Xã'
                    });
                });
            }

            updateLocationTable(tableData);
        }

        chrome.storage.local.set({ 
            'selectedProvince': provinceSelect.value,
            'selectedDistrict': districtSelect.value 
        });

    } catch (error) {
        console.error('Lỗi khi xử lý dữ liệu huyện:', error);
        showError('Không thể hiển thị dữ liệu huyện. Vui lòng thử lại sau.');
    } finally {
        hideLoading();
    }
}

function updateLocationTable(data) {
    const locationTableBody = document.getElementById('locationTableBody');
    locationTableBody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        const level = item.level || '';
        
        const levelClass = level.toLowerCase()
            .replace(/[áàảạãăắằẳẵặâấầẩẫậ]/g, 'a')
            .replace(/[éèẻẽẹêếềểễệ]/g, 'e')
            .replace(/[íìỉĩị]/g, 'i')
            .replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o')
            .replace(/[úùủũụưứừửữự]/g, 'u')
            .replace(/[ýỳỷỹỵ]/g, 'y')
            .replace(/đ/g, 'd')
            .replace(/\s+/g, '')
            .replace(/\//g, '')
            .replace(/[^a-z0-9]/g, '');
            
        row.setAttribute('data-level', levelClass);
        
        row.innerHTML = `
            <td>${formatLocationCode(item.code, level)}</td>
            <td>${item.name || ''}</td>
            <td>${level}</td>
        `;
        locationTableBody.appendChild(row);
    });
    
    updateSearchCount();
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function saveData() {
    const tableData = {};
    
    for (let i = 1; i <= 6; i++) {
        const rows = Array.from(document.querySelectorAll(`#tableBody${i} tr`));
        tableData[`table${i}`] = rows.map(row => ({
            name: row.cells[0].textContent.trim(),
            code: row.cells[1].textContent.trim(),
            detail: row.cells[2].textContent.trim(),
            note: row.cells[3].textContent.trim()
        }));
    }

    const locationRows = Array.from(document.querySelectorAll('#locationTableBody tr'));
    tableData.table7 = locationRows.map(row => ({
        code: row.cells[0].textContent.trim(),
        name: row.cells[1].textContent.trim(),
        level: row.cells[2].textContent.trim(),
    }));

    chrome.storage.local.set({ 'tableData': tableData }, function() {
        console.log('Data saved:', tableData);
    });
}

function restoreData() {
    chrome.storage.local.get('tableData', function(result) {
        const { tableData } = result;
        if (tableData) {
            for (let i = 1; i <= 6; i++) {
                if (tableData[`table${i}`]) {
                    tableData[`table${i}`].forEach((rowData, index) => {
                        const row = document.querySelector(`#tableBody${i} tr:nth-child(${index + 1})`);
                        if (row) {
                            row.cells[3].textContent = rowData.note;
                        }
                    });
                }
            }
        }
    });
}

function exportData() {
    chrome.storage.local.get('tableData', function(result) {
        const dataStr = JSON.stringify(result.tableData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'danhmuc_data.json';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        // Thông báo export thành công
        showSuccessNotification('Đã xuất dữ liệu ghi chú thành công!');
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            chrome.storage.local.set({ 'tableData': data }, function() {
                if (chrome.runtime.lastError) {
                    console.error('Lỗi khi lưu dữ liệu:', chrome.runtime.lastError);
                    showErrorNotification('Không thể lưu dữ liệu. Vui lòng thử lại!');
                    return;
                }
                console.log('Đã nhập dữ liệu thành công');
                restoreData();
                // Thông báo import thành công
                showSuccessNotification('Đã nhập dữ liệu ghi chú thành công!');
            });
        } catch (error) {
            console.error('Lỗi khi xử lý file JSON:', error);
            showErrorNotification('File JSON không hợp lệ. Vui lòng kiểm tra lại!');
        }
    };

    reader.readAsText(file);
}

function getExcelData(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tbody tr');
    const data = [];

    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    data.push(headers);

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const rowData = Array.from(row.querySelectorAll('td')).map(td => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = td.innerHTML;                
                return tempDiv.textContent.trim();
            });
            data.push(rowData);
        }
    });

    return data;
}

const API_URL = {
    BASE: 'https://provinces.open-api.vn/api/v1',
    get PROVINCES() { return `${this.BASE}/p` },
    getProvinceDetails(code) { return `${this.BASE}/p/${code}?depth=3` }
};

async function fetchAPI(url) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'fetchData',
            url: url
        });

        if (!response.success) {
            throw new Error(response.error);
        }

        return response.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function createLoadingAndErrorUI() {
  const loadingHtml = `
  <div id="loading" class="loading-overlay" style="display: none;">
      <div class="spinner-border text-success" role="status">
          <span class="visually-hidden">Đang tải...</span>
      </div>
  </div>
`;

document.body.insertAdjacentHTML('afterbegin', loadingHtml);
}

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 3000);
    }
}

function formatLocationCode(code, level) {
    if (!code) return '';
    code = String(code);
    
    switch(level) {
        case 'Tỉnh/Thành phố':
            return code.padStart(2, '0');
        case 'Quận/Huyện': 
            return code.padStart(3, '0');
        case 'Phường/Xã':
            return code.padStart(5, '0');
        default:
            return code;
    }
 }

function initializeNoteListeners() {
    // Cho các bảng 1-6
    for (let i = 1; i <= 6; i++) {
        document.querySelectorAll(`#tableBody${i} td.note`).forEach(td => {
            td.addEventListener('input', saveData);
        });
    }

    // Cho bảng hành chính
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                document.querySelectorAll('#locationTableBody td.note').forEach(td => {
                    td.addEventListener('input', saveData);
                });
            }
        });
    });

    const locationTableBody = document.getElementById('locationTableBody');
    if (locationTableBody) {
        observer.observe(locationTableBody, { childList: true, subtree: true });
    }
}

// ===== TO-DO LIST FUNCTIONS =====

let todos = [];
let editingTodoId = null;
let isTodoListVisible = false;
let isTodoListInitialized = false; // Biến kiểm tra đã khởi tạo chưa

// Toggle hiển thị To-Do List
function toggleTodoList() {
    const toggleBtn = document.getElementById('toggleTodoBtn');
    const todoContainer = document.getElementById('todoList');
    const tables = document.querySelectorAll('.table-container');
    const tableSelector = document.getElementById('tableSelector');
    const searchInput = document.getElementById('searchInput');
    const locationSelectors = document.getElementById('locationSelectors');
    const adminFilters = document.getElementById('adminFilters');
    
    isTodoListVisible = !isTodoListVisible;
    
    if (isTodoListVisible) {
        // Hiển thị To-Do List
        // Ẩn tất cả các bảng tra cứu
        tables.forEach(table => {
            if (table.id !== 'todoList') {
                table.classList.remove('active');
            }
        });
        
        // Hiển thị To-Do List
        todoContainer.classList.add('active');
        
        // Ẩn các controls không cần thiết
        tieude.style.display = 'none';
        tracuu.style.display = 'none';
        phandanhmuc.style.display = 'none';
        searchInput.style.display = 'none';
        locationSelectors.style.display = 'none';
        adminFilters.style.display = 'none';
        tableSelector.disabled = true;
        
        // Thêm class active cho nút
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '✓ ĐANG XEM TO-DO LIST - Click để đóng';
        
        // Khởi tạo To-Do List nếu chưa
        initializeTodoList();
        
        // ✅ Hiển thị thống kê deadline
        setTimeout(() => {
            const deadlineAlert = showDeadlineStats();
            if (deadlineAlert) {
                const todoHeader = document.querySelector('.todo-header');
                if (todoHeader) {
                    const oldAlert = todoHeader.querySelector('.alert-warning');
                    if (oldAlert) oldAlert.remove();
                    todoHeader.insertAdjacentHTML('beforeend', deadlineAlert);
                }
            }
        }, 100);
        
        // Notification
        showInfoNotification('Đã mở Danh sách công việc!');
    } else {
        // Ẩn To-Do List, hiển thị lại tra cứu
        todoContainer.classList.remove('active');
        
        // Hiển thị lại bảng đã chọn
        const selectedTable = tableSelector.value;
        document.getElementById(selectedTable).classList.add('active');
        
        // Hiển thị lại controls
        tieude.style.display = 'block';
        tracuu.style.display = 'block';
        phandanhmuc.style.display = 'block';
        searchInput.style.display = 'block';
        exportBtn.style.display = 'block';
        tableSelector.disabled = false;
        
        // Xử lý hiển thị selectors tùy theo table
        if (selectedTable === 'table7') {
            locationSelectors.style.display = 'block';
        } else if (selectedTable === 'table9') {
            adminFilters.style.display = 'block';
        }
        
        // Xóa class active khỏi nút
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '📝 DANH SÁCH CÔNG VIỆC (TO-DO LIST)';
    }
}

// Khởi tạo To-Do List
function initializeTodoList() {
    // Chỉ khởi tạo 1 lần duy nhất
    if (isTodoListInitialized) {
        // Chỉ cần load dữ liệu lại
        chrome.storage.local.get(['todos'], function(result) {
            todos = result.todos || [];
            renderTodoList();
            updateTodoStats();
        });
        return;
    }
    
    // Load todos từ storage
    chrome.storage.local.get(['todos'], function(result) {
        todos = result.todos || [];
        renderTodoList();
        updateTodoStats();
        checkTodayDeadlines(); // ✅ Kiểm tra deadline khi load
        
        // ===== HIỂN THỊ QUICK VIEW =====
        // Kiểm tra xem có Quick View Panel không
        const quickViewPanel = document.getElementById('quickViewPanel');
        if (quickViewPanel && todos.length > 0) {
            showQuickView(todos);
        } else if (quickViewPanel) {
            // Hiển thị panel rỗng nếu chưa có todos
            quickViewPanel.style.display = 'block';
        }
        // ===== KẾT THÚC QUICK VIEW =====
    });
    
    // Event listeners (chỉ thêm 1 lần)
    const addTodoBtn = document.getElementById('addTodoBtn');
    const cancelTodoBtn = document.getElementById('cancelTodoBtn');
    const todoForm = document.getElementById('todoForm');
    const todoStatusFilter = document.getElementById('todoStatusFilter');
    const exportTodoBtn = document.getElementById('exportTodoBtn');
    const importTodoBtn = document.getElementById('importTodoBtn');
    const importTodoFile = document.getElementById('importTodoFile');
    
    if (addTodoBtn) addTodoBtn.addEventListener('click', showTodoForm);
    if (cancelTodoBtn) cancelTodoBtn.addEventListener('click', hideTodoForm);
    if (todoForm) todoForm.addEventListener('submit', saveTodo);
    if (todoStatusFilter) todoStatusFilter.addEventListener('change', filterTodoList);
    if (exportTodoBtn) exportTodoBtn.addEventListener('click', exportTodos);
    if (importTodoBtn) {
        importTodoBtn.addEventListener('click', () => {
            if (importTodoFile) importTodoFile.click();
        });
    }
    if (importTodoFile) importTodoFile.addEventListener('change', importTodos);
    
    // ✅ SỬA LỖI CSP: Event delegation cho các button action
    const todoTableBody = document.getElementById('todoTableBody');
    if (todoTableBody) {
        todoTableBody.addEventListener('click', function(e) {
            const target = e.target;
            
            // Tìm button được click (có thể click vào emoji hoặc button)
            const button = target.closest('button');
            if (!button) return;
            
            const todoId = button.getAttribute('data-todo-id');
            const action = button.getAttribute('data-action');
            
            if (!todoId || !action) return;
            
            // Xử lý theo action
            switch(action) {
                case 'edit':
                    editTodo(todoId);
                    break;
                case 'delete':
                    deleteTodo(todoId);
                    break;
                case 'complete':
                    completeTodo(todoId);
                    break;
            }
        });
    }
    
    // Đánh dấu đã khởi tạo
    isTodoListInitialized = true;
}

// Hiển thị form thêm/sửa
function showTodoForm(todo = null) {
    const formContainer = document.getElementById('todoFormContainer');
    const formTitle = document.getElementById('todoFormTitle');
    
    // ✅ FIXED: Kiểm tra todo có thực sự có giá trị và có id không
    if (todo && todo.id) {
        // Edit mode
        formTitle.textContent = '✏️ Sửa công việc';
        document.getElementById('todoId').value = todo.id;
        document.getElementById('todoName').value = todo.name;
        document.getElementById('todoStartDate').value = todo.startDate || '';
        document.getElementById('todoEndDate').value = todo.endDate || '';
        document.getElementById('todoStatus').value = todo.status;
        document.getElementById('todoDescription').value = todo.description || '';
        editingTodoId = todo.id;
    } else {
        // Add mode
        formTitle.textContent = '➕ Thêm công việc mới';
        document.getElementById('todoForm').reset();
        document.getElementById('todoId').value = '';
        editingTodoId = null;
        
        // Set ngày bắt đầu là hôm nay
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('todoStartDate').value = today;
    }
    
    formContainer.style.display = 'block';
    document.getElementById('todoName').focus();
}

// Ẩn form
function hideTodoForm() {
    document.getElementById('todoFormContainer').style.display = 'none';
    document.getElementById('todoForm').reset();
    editingTodoId = null;
}

// Lưu todo
function saveTodo(e) {
    e.preventDefault();
    
    const name = document.getElementById('todoName').value.trim();
    const startDate = document.getElementById('todoStartDate').value;
    const endDate = document.getElementById('todoEndDate').value;
    const status = document.getElementById('todoStatus').value;
    const description = document.getElementById('todoDescription').value.trim();
    
    if (!name) {
        alert('Vui lòng nhập tên công việc!');
        return;
    }
    
    // Validate dates
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert('Ngày bắt đầu không thể sau ngày kết thúc!');
        return;
    }
    
    if (editingTodoId) {
        // Update existing todo
        const index = todos.findIndex(t => t.id === editingTodoId);
        if (index !== -1) {
            todos[index] = {
                ...todos[index],
                name,
                startDate,
                endDate,
                status,
                description,
                updatedAt: new Date().toISOString()
            };
            showSuccessNotification('Đã cập nhật công việc thành công!');
        }
    } else {
        // Add new todo
        const newTodo = {
            id: Date.now().toString(),
            name,
            startDate,
            endDate,
            status,
            description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        todos.push(newTodo);
        showSuccessNotification('Đã thêm công việc mới thành công!');
    }
    
    // Save to storage
    chrome.storage.local.set({ todos }, function() {
        renderTodoList();
        updateTodoStats();
        checkTodayDeadlines(); // ✅ Cập nhật badge sau khi thêm/sửa
        hideTodoForm();
    });
}

// Render danh sách todos
function renderTodoList() {
    const tbody = document.getElementById('todoTableBody');
    const filter = document.getElementById('todoStatusFilter').value;
    
    // Filter todos
    let filteredTodos = todos;
    if (filter) {
        filteredTodos = todos.filter(t => t.status === filter);
    }
    
    if (filteredTodos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    ${filter ? 'Không có công việc nào phù hợp với bộ lọc.' : 'Chưa có công việc nào. Click "➕ Thêm công việc" để bắt đầu!'}
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort by status priority and date
    const statusOrder = { upcoming: 1, inprogress: 2, completed: 3 };
    filteredTodos.sort((a, b) => {
        if (a.status !== b.status) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(a.startDate || 0) - new Date(b.startDate || 0);
    });
    
    tbody.innerHTML = filteredTodos.map((todo, index) => {
        const startDate = todo.startDate ? formatDate(todo.startDate) : '-';
        const endDate = todo.endDate ? formatDate(todo.endDate) : '-';
        const statusText = getStatusText(todo.status);
        const statusClass = todo.status;
        
        // Check if overdue
        let rowClass = '';
        if (todo.status !== 'completed' && todo.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const end = new Date(todo.endDate);
            end.setHours(0, 0, 0, 0);
            
            if (end < today) {
                rowClass = 'todo-overdue';
            } else if (end.getTime() === today.getTime()) {
                rowClass = 'todo-today';
            }
        }
        
        if (todo.status === 'completed') {
            rowClass = 'todo-completed-row';
        }
        
        return `
            <tr class="${rowClass}" data-todo-id="${todo.id}">
                <td class="text-center">${index + 1}</td>
                <td>
                    <strong>${escapeHtml(todo.name)}</strong>
                    ${todo.description ? `<br><small class="text-muted">${escapeHtml(todo.description)}</small>` : ''}
                </td>
                <td class="text-center">${startDate}</td>
                <td class="text-center">${endDate}</td>
                <td class="text-center">
                    <span class="todo-status ${statusClass}">${statusText}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-primary todo-action-btn" data-todo-id="${todo.id}" data-action="edit" title="Sửa">✏️</button>
                    <button class="btn btn-sm btn-danger todo-action-btn" data-todo-id="${todo.id}" data-action="delete" title="Xóa">🗑️</button>
                    ${todo.status !== 'completed' ? `<button class="btn btn-sm btn-success todo-action-btn" data-todo-id="${todo.id}" data-action="complete" title="Hoàn thành">✓</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        upcoming: '🔵 Sắp tiến hành',
        inprogress: '🟡 Đang làm',
        completed: '🟢 Đã hoàn thành'
    };
    return statusMap[status] || status;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit todo
function editTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        showTodoForm(todo);
    }
}

// Delete todo
function deleteTodo(id) {
    if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
        todos = todos.filter(t => t.id !== id);
        chrome.storage.local.set({ todos }, function() {
            renderTodoList();
            updateTodoStats();
            checkTodayDeadlines(); // ✅ Cập nhật badge sau khi xóa
            showSuccessNotification('Đã xóa công việc thành công!');
        });
    }
}

// Complete todo
function completeTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.status = 'completed';
        todo.updatedAt = new Date().toISOString();
        chrome.storage.local.set({ todos }, function() {
            renderTodoList();
            updateTodoStats();
            checkTodayDeadlines(); // ✅ Cập nhật badge sau khi hoàn thành
            showSuccessNotification('🎉 Chúc mừng! Bạn đã hoàn thành công việc: ' + todo.name);
        });
    }
}

// Filter todo list
function filterTodoList() {
    renderTodoList();
}

// Update stats
function updateTodoStats() {
    const upcoming = todos.filter(t => t.status === 'upcoming').length;
    const inprogress = todos.filter(t => t.status === 'inprogress').length;
    const completed = todos.filter(t => t.status === 'completed').length;
    const total = todos.length;
    
    document.getElementById('todoStatsUpcoming').textContent = `${upcoming} sắp tiến hành`;
    document.getElementById('todoStatsInProgress').textContent = `${inprogress} đang làm`;
    document.getElementById('todoStatsCompleted').textContent = `${completed} đã hoàn thành`;
    document.getElementById('todoStatsTotal').textContent = `${total} tổng cộng`;
}

// Export todos
function exportTodos() {
    const dataStr = JSON.stringify(todos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    downloadLink.download = `todo-list_${timestamp}.json`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    
    showSuccessNotification('Đã xuất danh sách công việc thành công!');
}

// Import todos
function importTodos(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedTodos = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedTodos)) {
                throw new Error('Dữ liệu không hợp lệ');
            }
            
            // Merge with existing todos
            if (confirm('Bạn muốn:\n- Nhấn OK để THAY THẾ tất cả công việc hiện tại\n- Nhấn Cancel để GỘP với công việc hiện tại')) {
                todos = importedTodos;
            } else {
                // Merge: add new todos with new IDs to avoid conflicts
                importedTodos.forEach(todo => {
                    todos.push({
                        ...todo,
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
                    });
                });
            }
            
            chrome.storage.local.set({ todos }, function() {
                renderTodoList();
                updateTodoStats();
                showSuccessNotification('Đã nhập danh sách công việc thành công!');
            });
        } catch (error) {
            showErrorNotification('File không hợp lệ. Vui lòng kiểm tra lại!');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}


// =====================================================================
// TÍNH NĂNG THÔNG BÁO DEADLINE
// =====================================================================

// Hàm kiểm tra và thông báo công việc có deadline hôm nay
function checkTodayDeadlines() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Lọc công việc chưa hoàn thành
    const incompleteTodos = todos.filter(t => t.status !== 'completed');
    
    // Công việc có deadline hôm nay
    const todayTodos = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime();
    });
    
    // Công việc quá hạn
    const overdueTodos = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today;
    });
    
    // Hiển thị thông báo
    if (overdueTodos.length > 0) {
        showNotification(
            '⚠️ Công việc quá hạn!',
            `Bạn có ${overdueTodos.length} công việc đã quá hạn. Hãy kiểm tra ngay!`,
            'basic'
        );
    }
    
    if (todayTodos.length > 0) {
        const todoNames = todayTodos.slice(0, 3).map(t => `• ${t.name}`).join('\n');
        const moreText = todayTodos.length > 3 ? `\n... và ${todayTodos.length - 3} công việc khác` : '';
        
        showNotification(
            '📅 Deadline hôm nay!',
            `Bạn có ${todayTodos.length} công việc cần hoàn thành hôm nay:\n${todoNames}${moreText}`,
            'basic'
        );
    }
    
    // Cập nhật badge
    updateDeadlineBadge(todayTodos.length, overdueTodos.length);
}

// Hàm cập nhật badge trên icon extension
function updateDeadlineBadge(todayCount, overdueCount) {
    const totalCount = todayCount + overdueCount;
    
    if (totalCount > 0) {
        chrome.action.setBadgeText({ text: totalCount.toString() });
        
        // Màu đỏ nếu có quá hạn, vàng nếu chỉ có deadline hôm nay
        const badgeColor = overdueCount > 0 ? '#dc3545' : '#ffc107';
        chrome.action.setBadgeBackgroundColor({ color: badgeColor });
        
        // Tooltip
        const tooltipText = overdueCount > 0 
            ? `${overdueCount} quá hạn, ${todayCount} deadline hôm nay`
            : `${todayCount} công việc cần làm hôm nay`;
        chrome.action.setTitle({ title: tooltipText });
    } else {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'Tra cứu thông tin' });
    }
}

// Hàm hiển thị thống kê deadline trong To-Do List
function showDeadlineStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const incompleteTodos = todos.filter(t => t.status !== 'completed');
    
    const todayCount = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime();
    }).length;
    
    const overdueCount = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today;
    }).length;
    
    let deadlineHtml = '';
    
    if (overdueCount > 0 || todayCount > 0) {
        deadlineHtml = `
            <div class="alert alert-warning" style="margin: 10px 0; padding: 10px; border-radius: 5px; background-color: #fff3cd; border: 1px solid #ffc107;">
                <strong>⏰ Nhắc nhở deadline:</strong><br>
                ${overdueCount > 0 ? `<span style="color: #dc3545;">⚠️ ${overdueCount} công việc quá hạn</span><br>` : ''}
                ${todayCount > 0 ? `<span style="color: #856404;">📅 ${todayCount} công việc deadline hôm nay</span>` : ''}
            </div>
        `;
    }
    
    return deadlineHtml;
}
// =====================================================================
// CODE MỚI CHO POPUP.JS - QUICK VIEW PANEL v5.0 - FIXED CSP VIOLATION
// =====================================================================
// HƯỚNG DẪN: Thêm code này vào cuối file popup.js hiện tại (sau dòng 1505)
// =====================================================================

// ===== QUICK VIEW PANEL - BIẾN TOÀN CỤC =====

let quickViewVisible = false;

// ===== KHỞI TẠO QUICK VIEW KHI MỞ EXTENSION =====

function initializeQuickView() {
    // Load todos và hiển thị Quick View
    chrome.storage.local.get(['todos', 'quickViewDismissed'], function(result) {
        const todos = result.todos || [];
        const dismissed = result.quickViewDismissed || false;
        
        // Kiểm tra xem có công việc quan trọng không
        const importantTasks = getImportantTasks(todos);
        
        // Chỉ hiển thị nếu có công việc quan trọng và chưa dismiss
        if (importantTasks.overdue.length > 0 || importantTasks.today.length > 0) {
            if (!dismissed) {
                showQuickView(todos);
            }
        }
    });
}

// ===== HÀM LẤY CÔNG VIỆC QUAN TRỌNG =====

function getImportantTasks(todos) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const next3Days = new Date(today);
    next3Days.setDate(next3Days.getDate() + 3);
    
    const incompleteTodos = todos.filter(t => t.status !== 'completed');
    
    // Công việc quá hạn
    const overdue = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today;
    });
    
    // Công việc deadline hôm nay
    const todayTasks = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime();
    });
    
    // Công việc sắp tới (trong 3 ngày)
    const upcoming = incompleteTodos.filter(t => {
        if (!t.endDate) return false;
        const endDate = new Date(t.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate > today && endDate <= next3Days;
    });
    
    return {
        overdue,
        today: todayTasks,
        upcoming,
        total: incompleteTodos.length
    };
}

// ===== HÀM HIỂN THỊ QUICK VIEW PANEL =====

function showQuickView(todos) {
    const quickViewPanel = document.getElementById('quickViewPanel');
    if (!quickViewPanel) {
        console.error('Quick View Panel không tồn tại trong HTML');
        return;
    }
    
    const tasks = getImportantTasks(todos);
    
    // Cập nhật số liệu thống kê
    document.getElementById('quickViewOverdueCount').textContent = tasks.overdue.length;
    document.getElementById('quickViewTodayCount').textContent = tasks.today.length;
    document.getElementById('quickViewUpcomingCount').textContent = tasks.upcoming.length;
    
    // Render danh sách công việc
    renderQuickViewTasks(tasks);
    
    // Hiển thị panel
    quickViewPanel.style.display = 'block';
    quickViewVisible = true;
    
    // Event listeners
    setupQuickViewEvents();
}

// ===== WRAPPER FUNCTION ĐỂ GỌI TỪ TAB-HANDLER =====
function renderQuickView() {
    // Load todos từ storage và hiển thị Quick View
    chrome.storage.local.get(['todos'], function(result) {
        const currentTodos = result.todos || [];
        if (currentTodos.length > 0) {
            showQuickView(currentTodos);
        } else {
            // Nếu không có todos, vẫn hiển thị panel rỗng
            const quickViewPanel = document.getElementById('quickViewPanel');
            if (quickViewPanel) {
                quickViewPanel.style.display = 'block';
            }
        }
    });
}

// ===== HÀM RENDER DANH SÁCH CÔNG VIỆC TRONG QUICK VIEW =====

function renderQuickViewTasks(tasks) {
    const taskListContainer = document.getElementById('quickViewTaskList');
    
    // Combine và sort tất cả công việc quan trọng
    const allImportantTasks = [
        ...tasks.overdue.map(t => ({ ...t, priority: 'overdue' })),
        ...tasks.today.map(t => ({ ...t, priority: 'today' })),
        ...tasks.upcoming.map(t => ({ ...t, priority: 'upcoming' }))
    ];
    
    if (allImportantTasks.length === 0) {
        taskListContainer.innerHTML = `
            <div class="quick-view-empty">
                <div class="quick-view-empty-icon">🎉</div>
                <div class="quick-view-empty-text">Tuyệt vời! Không có công việc khẩn cấp.</div>
            </div>
        `;
        return;
    }
    
    // Giới hạn hiển thị 5 công việc đầu tiên
    const displayTasks = allImportantTasks.slice(0, 5);
    
    // ✅ FIXED: Bỏ inline onclick, dùng data attributes
    taskListContainer.innerHTML = displayTasks.map(task => {
        const statusClass = task.priority;
        const statusText = task.priority === 'overdue' ? '⚠️ Quá hạn' : 
                          task.priority === 'today' ? '📅 Hôm nay' : 
                          '📌 Sắp tới';
        
        return `
            <div class="quick-task-item ${statusClass}" data-todo-id="${task.id}">
                <div class="quick-task-name">${escapeHtml(task.name)}</div>
                <div class="quick-task-meta">
                    <div class="quick-task-date">
                        ⏰ ${task.endDate ? formatDate(task.endDate) : 'Chưa đặt'}
                    </div>
                    <div class="quick-task-status ${statusClass}-status">
                        ${statusText}
                    </div>
                </div>
                <div class="quick-task-actions">
                    <button class="quick-task-btn complete" data-action="complete" data-todo-id="${task.id}">
                        ✓ Hoàn thành
                    </button>
                    <button class="quick-task-btn view" data-action="view" data-todo-id="${task.id}">
                        👁️ Xem
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Hiển thị thông báo nếu còn nhiều công việc hơn
    if (allImportantTasks.length > 5) {
        taskListContainer.innerHTML += `
            <div style="text-align: center; padding: 10px; color: #666; font-size: 13px;">
                ... và ${allImportantTasks.length - 5} công việc khác
            </div>
        `;
    }
    
    // ✅ FIXED: Thêm event delegation cho quick task actions
    setupQuickTaskActions();
}

// ===== SETUP EVENT LISTENERS CHO QUICK VIEW =====

function setupQuickViewEvents() {
    // Nút đóng Quick View
    const closeBtn = document.getElementById('closeQuickView');
    if (closeBtn) {
        // Remove old listener if exists
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        const newCloseBtn = document.getElementById('closeQuickView');
        
        newCloseBtn.addEventListener('click', function() {
            hideQuickView();
            // Lưu trạng thái đã dismiss (sẽ không hiện lại cho đến khi restart)
            chrome.storage.local.set({ quickViewDismissed: true });
        });
    }
    
    // Nút xem tất cả công việc
    const viewFullBtn = document.getElementById('viewFullTodoList');
    if (viewFullBtn) {
        // Remove old listener if exists
        viewFullBtn.replaceWith(viewFullBtn.cloneNode(true));
        const newViewFullBtn = document.getElementById('viewFullTodoList');
        
        newViewFullBtn.addEventListener('click', function() {
            hideQuickView();
            // Click vào nút To-Do List để mở
            const toggleBtn = document.getElementById('toggleTodoBtn');
            if (toggleBtn) {
                toggleBtn.click();
            }
        });
    }
}

// ===== SETUP EVENT DELEGATION CHO QUICK TASK ACTIONS =====

function setupQuickTaskActions() {
    const taskListContainer = document.getElementById('quickViewTaskList');
    if (!taskListContainer) return;
    
    // Remove old listener
    const newContainer = taskListContainer.cloneNode(true);
    taskListContainer.parentNode.replaceChild(newContainer, taskListContainer);
    
    // Add new event delegation
    const container = document.getElementById('quickViewTaskList');
    container.addEventListener('click', function(e) {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const todoId = button.getAttribute('data-todo-id');
        
        if (action === 'complete') {
            quickCompleteTask(todoId);
        } else if (action === 'view') {
            quickViewTask(todoId);
        }
    });
}

// ===== HÀM ẨN QUICK VIEW =====

function hideQuickView() {
    const quickViewPanel = document.getElementById('quickViewPanel');
    if (quickViewPanel) {
        quickViewPanel.style.display = 'none';
        quickViewVisible = false;
    }
}

// ===== QUICK ACTIONS TỪ QUICK VIEW =====

// Hoàn thành công việc nhanh
function quickCompleteTask(todoId) {
    chrome.storage.local.get(['todos'], function(result) {
        let todos = result.todos || [];
        const todo = todos.find(t => t.id === todoId);
        
        if (todo) {
            todo.status = 'completed';
            todo.updatedAt = new Date().toISOString();
            
            chrome.storage.local.set({ todos }, function() {
                // Cập nhật Quick View
                showQuickView(todos);
                
                // Cập nhật badge
                checkTodayDeadlines();
                
                // Refresh notification state
                chrome.runtime.sendMessage({ type: 'refreshNotificationState' });
                
                showSuccessNotification('🎉 Đã hoàn thành: ' + todo.name);
            });
        }
    });
}

// Xem chi tiết công việc
function quickViewTask(todoId) {
    // Ẩn Quick View
    hideQuickView();
    
    // Mở To-Do List
    const toggleBtn = document.getElementById('toggleTodoBtn');
    if (toggleBtn && !isTodoListVisible) {
        toggleBtn.click();
    }
    
    // Đợi một chút để To-Do List load xong
    setTimeout(() => {
        // Scroll đến task và highlight
        const taskRow = document.querySelector(`tr[data-todo-id="${todoId}"]`);
        if (taskRow) {
            taskRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            taskRow.style.background = '#fff3cd';
            setTimeout(() => {
                taskRow.style.background = '';
            }, 2000);
        }
    }, 300);
}

// ===== CẬP NHẬT HÀM TOGGLE TODO LIST =====

function toggleTodoList() {
    const toggleBtn = document.getElementById('toggleTodoBtn');
    const todoContainer = document.getElementById('todoList');
    const tables = document.querySelectorAll('.table-container');
    const tableSelector = document.getElementById('tableSelector');
    const searchInput = document.getElementById('searchInput');
    const locationSelectors = document.getElementById('locationSelectors');
    const adminFilters = document.getElementById('adminFilters');
    
    isTodoListVisible = !isTodoListVisible;
    
    if (isTodoListVisible) {
        // Ẩn Quick View khi mở To-Do List
        hideQuickView();
        
        // Hiển thị To-Do List
        tables.forEach(table => {
            if (table.id !== 'todoList') {
                table.classList.remove('active');
            }
        });
        
        todoContainer.classList.add('active');
        
        // Ẩn các controls không cần thiết
        tieude.style.display = 'none';
        tracuu.style.display = 'none';
        phandanhmuc.style.display = 'none';
        searchInput.style.display = 'none';
        locationSelectors.style.display = 'none';
        adminFilters.style.display = 'none';
        tableSelector.disabled = true;
        
        // Thêm class active cho nút
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '✓ ĐANG XEM TO-DO LIST - Click để đóng';
        
        // Khởi tạo To-Do List nếu chưa
        initializeTodoList();
        
        // Hiển thị thống kê deadline
        setTimeout(() => {
            const deadlineAlert = showDeadlineStats();
            if (deadlineAlert) {
                const todoHeader = document.querySelector('.todo-header');
                if (todoHeader) {
                    const oldAlert = todoHeader.querySelector('.alert-warning');
                    if (oldAlert) oldAlert.remove();
                    todoHeader.insertAdjacentHTML('beforeend', deadlineAlert);
                }
            }
        }, 100);
        
        showInfoNotification('Đã mở Danh sách công việc!');
    } else {
        // Ẩn To-Do List, hiển thị lại tra cứu
        todoContainer.classList.remove('active');
        
        // Hiển thị lại bảng đã chọn
        const selectedTable = tableSelector.value;
        document.getElementById(selectedTable).classList.add('active');
        
        // Hiển thị lại controls
        tieude.style.display = 'block';
        tracuu.style.display = 'block';
        phandanhmuc.style.display = 'block';
        searchInput.style.display = 'block';
        exportBtn.style.display = 'block';
        tableSelector.disabled = false;
        
        // Xử lý hiển thị selectors tùy theo table
        if (selectedTable === 'table7') {
            locationSelectors.style.display = 'block';
        } else if (selectedTable === 'table9') {
            adminFilters.style.display = 'block';
        }
        
        // Xóa class active khỏi nút
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '📝 DANH SÁCH CÔNG VIỆC (CLICK VÀO ĐỂ XEM)';
        
        // Hiển thị lại Quick View nếu có công việc quan trọng
        chrome.storage.local.get(['todos'], function(result) {
            const todos = result.todos || [];
            const tasks = getImportantTasks(todos);
            
            if (tasks.overdue.length > 0 || tasks.today.length > 0) {
                setTimeout(() => showQuickView(todos), 300);
            }
        });
    }
}

// ===== CẬP NHẬT HÀM checkTodayDeadlines() =====

function checkTodayDeadlines() {
    chrome.storage.local.get(['todos'], function(result) {
        const todos = result.todos || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const incompleteTodos = todos.filter(t => t.status !== 'completed');
        
        const todayTodos = incompleteTodos.filter(t => {
            if (!t.endDate) return false;
            const endDate = new Date(t.endDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate.getTime() === today.getTime();
        });
        
        const overdueTodos = incompleteTodos.filter(t => {
            if (!t.endDate) return false;
            const endDate = new Date(t.endDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate < today;
        });
        
        // Cập nhật badge
        updateDeadlineBadge(todayTodos.length, overdueTodos.length);
        
        // Cập nhật Quick View nếu đang hiển thị
        if (quickViewVisible) {
            showQuickView(todos);
        }
        
        // Gửi message đến background để refresh notification state
        chrome.runtime.sendMessage({ type: 'refreshNotificationState' });
    });
}

// =====================================================================
// LƯU Ý QUAN TRỌNG VỀ EVENT HANDLERS
// =====================================================================
// 
// Chrome Extension Manifest V3 KHÔNG CHO PHÉP inline event handlers
// như onclick="functionName()" vì lý do bảo mật (CSP).
// 
// ✅ ĐÚNG: Sử dụng addEventListener
// ❌ SAI: Sử dụng onclick="..." trong HTML
// 
// Để tránh lỗi CSP violation, luôn:
// 1. Sử dụng data attributes thay vì inline handlers
// 2. Attach event listeners qua JavaScript
// 3. Sử dụng event delegation cho dynamic content
// 
// =====================================================================