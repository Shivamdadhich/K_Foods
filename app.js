// State Store
let db = {
    logs: JSON.parse(localStorage.getItem('kf_qa_logs')) || []
};

let currentEditLogId = null;

// SKU standard specs (Target grams, tolerance +/- grams)
const SKU_SPECS = {
    '200ml': { target: 200, tolerance: 2 },
    '500ml': { target: 500, tolerance: 4 },
    '1L': { target: 1000, tolerance: 8 },
    '2L': { target: 2000, tolerance: 15 },
    '20L': { target: 20000, tolerance: 100 }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set all date inputs to today
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = today);
    
    // Set global working date
    const globalDate = document.getElementById('global-working-date');
    if (globalDate) globalDate.value = today;

    // Set monthly input to current month
    const currentMonth = today.substring(0, 7);
    const mInput = document.getElementById('disp-month');
    if (mInput) mInput.value = currentMonth;

    // Check Authentication state
    if (sessionStorage.getItem('kf_logged_in') === 'true') {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('app-main-layout').style.display = 'flex';
    } else {
        document.getElementById('landing-page').style.display = 'flex';
        document.getElementById('app-main-layout').style.display = 'none';
    }

    // Load initial form states
    resetAllForms();
    
    // Refresh dashboard stats and chart
    updateDashboardStats();
    initChart();
});

// Authentication Flow
function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('login-error').style.display = 'none';
}

function hideLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
}

function attemptLogin() {
    const pass = document.getElementById('login-password').value;
    if (pass === 'kfoods2026') {
        sessionStorage.setItem('kf_logged_in', 'true');
        hideLoginModal();
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('app-main-layout').style.display = 'flex';
        updateDashboardStats();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function logout() {
    sessionStorage.removeItem('kf_logged_in');
    document.getElementById('landing-page').style.display = 'flex';
    document.getElementById('app-main-layout').style.display = 'none';
}

// View Swapper
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) targetView.classList.add('active');

    const menuItems = document.querySelectorAll('.nav-item');
    menuItems.forEach(item => {
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active');
        }
    });

    const titleMap = {
        'dashboard': 'Dashboard Overview',
        'netcontent': 'Net Content Analysis (QA/011)',
        'finishedproduct': 'Finished Product Online Analysis (QA/002)',
        'release': 'Finished Goods Release Report (QA/021)',
        'light': 'Light Inspection Record (QA/018)',
        'wtp': 'WTP Operator Log (QA/003)',
        'minerals': 'Bailley Minerals Record (QA/004)',
        'dispatch': 'Finished Product Dispatch Record (QA/022)',
        'vehicle': 'Vehicle GMP Inspection (QA/020)',
        'hygiene': 'Personal Hygiene Checklist (QA/015)',
        'archives': 'Saved Quality Records & History'
    };
    document.getElementById('current-view-title').innerText = titleMap[viewId] || 'QA & Operations Suite';
    
    // Check if there is an existing log for this active date when switching views
    if (viewId !== 'dashboard' && viewId !== 'archives') {
        onGlobalDateChange();
    }

    if (viewId === 'archives') {
        renderArchives();
    }
}

// Global Working Date Listener
function onGlobalDateChange() {
    const workingDate = document.getElementById('global-working-date').value;
    const activeSection = document.querySelector('.view-section.active');
    if (!activeSection) return;
    
    const activeViewId = activeSection.id.replace('-view', '');
    if (activeViewId === 'dashboard' || activeViewId === 'archives') return;
    
    // Search if there is a logged entry for this exact date and type
    const existingLog = db.logs.find(l => l.date === workingDate && l.type === activeViewId);
    
    if (existingLog) {
        currentEditLogId = existingLog.id;
        loadSavedLogIntoForm(existingLog);
    } else {
        currentEditLogId = null;
        resetFormById(activeViewId);
    }
}

function resetFormById(type) {
    if (type === 'netcontent') {
        initNetContentTable();
    } else if (type === 'finishedproduct') {
        initFinishedProductTable();
    } else if (type === 'release') {
        initReleaseTable();
    } else if (type === 'light') {
        initLightInspectionTable();
    } else if (type === 'wtp') {
        initWTPTable();
    } else if (type === 'minerals') {
        document.getElementById('min-op-1').value = 50;
        document.getElementById('min-sol-1').value = 0;
        document.getElementById('min-prod-1').value = 0;
        document.getElementById('min-wast-1').value = 0;
        document.getElementById('min-rec-1').value = 0;
        document.getElementById('min-op-2').value = 40;
        document.getElementById('min-sol-2').value = 0;
        document.getElementById('min-prod-2').value = 0;
        document.getElementById('min-wast-2').value = 0;
        document.getElementById('min-rec-2').value = 0;
        calcClosingStock();
    } else if (type === 'dispatch') {
        initDispatchTable();
    } else if (type === 'vehicle') {
        document.getElementById('veh-no-a').value = '';
        document.getElementById('veh-dest-a').value = '';
        document.getElementById('veh-no-b').value = '';
        document.getElementById('veh-dest-b').value = '';
    } else if (type === 'hygiene') {
        initHygieneTable();
    }
}

function resetAllForms() {
    resetFormById('netcontent');
    resetFormById('finishedproduct');
    resetFormById('release');
    resetFormById('light');
    resetFormById('wtp');
    resetFormById('minerals');
    resetFormById('dispatch');
    resetFormById('vehicle');
    resetFormById('hygiene');
}

// 1. Net Content Analysis Setup
function initNetContentTable() {
    const tbody = document.querySelector('#nc-table tbody');
    tbody.innerHTML = '';
    
    for (let i = 1; i <= 22; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Filling Valve #${i}</td>
            <td class="input-cell"><input type="number" step="0.1" class="nc-goods" data-valve="${i}" oninput="calcNetContentRow(${i})" placeholder="0.0"></td>
            <td class="input-cell"><input type="number" step="0.1" class="nc-tare" data-valve="${i}" oninput="calcNetContentRow(${i})" value="18.5"></td>
            <td class="calc-cell" id="nc-wt-${i}">0.0</td>
            <td class="calc-cell" id="nc-ml-${i}">0.0</td>
            <td class="calc-cell" id="nc-status-${i}">-</td>
        `;
        tbody.appendChild(tr);
    }
}

function updateNCSkuSpec() {
    for (let i = 1; i <= 22; i++) {
        calcNetContentRow(i);
    }
}

function calcNetContentRow(valveNo) {
    const sku = document.getElementById('nc-sku').value;
    const spec = SKU_SPECS[sku];
    
    const goods = parseFloat(document.querySelector(`.nc-goods[data-valve="${valveNo}"]`).value) || 0;
    const tare = parseFloat(document.querySelector(`.nc-tare[data-valve="${valveNo}"]`).value) || 0;
    
    const netWtCell = document.getElementById(`nc-wt-${valveNo}`);
    const netMlCell = document.getElementById(`nc-ml-${valveNo}`);
    const statusCell = document.getElementById(`nc-status-${valveNo}`);
    
    if (goods === 0) {
        netWtCell.innerText = '0.0';
        netMlCell.innerText = '0.0';
        statusCell.innerText = '-';
        statusCell.className = 'calc-cell';
        return;
    }

    const netWt = goods - tare;
    const netMl = netWt; 
    
    netWtCell.innerText = netWt.toFixed(1);
    netMlCell.innerText = netMl.toFixed(1);

    const minAcceptable = spec.target - spec.tolerance;
    const maxAcceptable = spec.target + spec.tolerance;

    if (netWt >= minAcceptable && netWt <= maxAcceptable) {
        statusCell.innerText = 'PASS';
        statusCell.className = 'calc-cell flag-success';
    } else {
        statusCell.innerText = 'FAIL';
        statusCell.className = 'calc-cell flag-out-of-spec';
    }
}

// 2. Finished Product Online Analysis
function initFinishedProductTable() {
    const tbody = document.querySelector('#fp-table tbody');
    tbody.innerHTML = '';
    const defaultHours = ["08:00", "10:00", "12:00", "14:00", "16:00"];
    defaultHours.forEach(time => addFPHourlyRow(time));
}

function addFPHourlyRow(timeVal = '') {
    const tbody = document.querySelector('#fp-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="input-cell"><input type="time" class="fp-time" value="${timeVal}"></td>
        <td class="input-cell"><input type="number" step="0.01" class="fp-ozone-oz" placeholder="0.5" oninput="validateFP(this, 0.4, 0.6)"></td>
        <td class="input-cell"><input type="number" step="0.01" class="fp-ozone-prod" placeholder="0.3" oninput="validateFP(this, 0.2, 0.4)"></td>
        <td class="input-cell">
            <select class="fp-appearance"><option value="Clear">Clear</option><option value="Turbid">Turbid</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-odour"><option value="Agreeable">Agreeable</option><option value="Not Agreeable">Not Agreeable</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-taste"><option value="Agreeable">Agreeable</option><option value="Not Agreeable">Not Agreeable</option></select>
        </td>
        <td class="input-cell"><input type="number" step="0.1" class="fp-ph" placeholder="7.0" oninput="validateFP(this, 6.0, 8.5)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-tds" placeholder="110" oninput="validateFP(this, 100, 125)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-hardness" placeholder="15" oninput="validateFP(this, 11, 200)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-calcium" placeholder="8" oninput="validateFP(this, 6, 200)"></td>
        <td class="input-cell"><input type="text" class="fp-net-content" placeholder="OK"></td>
        <td class="input-cell">
            <select class="fp-coding"><option value="Clear">Clear</option><option value="Smudged">Smudged</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-label"><option value="OK">OK</option><option value="Wrinkles">Wrinkles</option></select>
        </td>
    `;
    tbody.appendChild(tr);
}

function validateFP(input, min, max) {
    const val = parseFloat(input.value);
    if (isNaN(val)) {
        input.parentElement.className = 'input-cell';
        return;
    }
    if (val < min || val > max) {
        input.parentElement.className = 'input-cell flag-out-of-spec';
    } else {
        input.parentElement.className = 'input-cell flag-success';
    }
}

// 3. Finished Goods Release Report (QA/021)
function initReleaseTable() {
    const tbody = document.querySelector('#rel-table tbody');
    tbody.innerHTML = '';
    addReleaseRow();
}

function addReleaseRow() {
    const tbody = document.querySelector('#rel-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="input-cell"><input type="date" class="rel-mfg-date"></td>
        <td class="input-cell"><input type="text" class="rel-pack-size" placeholder="1 Liter"></td>
        <td class="input-cell"><input type="text" class="rel-lot-size" placeholder="500 Cases"></td>
        <td class="input-cell"><input type="text" class="rel-app" value="Clear"></td>
        <td class="input-cell"><input type="text" class="rel-taste" value="Agreeable"></td>
        <td class="input-cell"><input type="number" step="0.1" class="rel-ph" value="7.2"></td>
        <td class="input-cell"><input type="number" step="1" class="rel-tds" value="112"></td>
        <td class="input-cell"><input type="text" class="rel-tbc" value="Nil"></td>
        <td class="input-cell"><input type="text" class="rel-ym" value="Nil"></td>
        <td class="input-cell">
            <select class="rel-status">
                <option value="RELEASED">RELEASED</option>
                <option value="ON HOLD">ON HOLD</option>
            </select>
        </td>
    `;
    tbody.appendChild(tr);
    const dateInput = tr.querySelector('.rel-mfg-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// 4. Light Inspection Record
function initLightInspectionTable() {
    const tbody = document.querySelector('#li-table tbody');
    tbody.innerHTML = '';
    const hours = ["09:00", "11:00", "13:00", "15:00"];
    hours.forEach(time => addLightInspectionRow(time));
}

function addLightInspectionRow(timeVal = '') {
    const tbody = document.querySelector('#li-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="input-cell"><input type="time" class="li-time" value="${timeVal}"></td>
        <td class="input-cell"><input type="number" class="li-foreign" value="0"></td>
        <td class="input-cell"><input type="number" class="li-cross" value="0"></td>
        <td class="input-cell"><input type="number" class="li-loose" value="0"></td>
        <td class="input-cell"><input type="number" class="li-open" value="0"></td>
        <td class="input-cell"><input type="number" class="li-low" value="0"></td>
        <td class="input-cell"><input type="number" class="li-leak" value="0"></td>
        <td class="input-cell"><input type="number" class="li-milk" value="0"></td>
        <td class="input-cell"><input type="text" class="li-inspector" placeholder="Name"></td>
        <td class="input-cell"><input type="text" class="li-remarks" placeholder="-"></td>
    `;
    tbody.appendChild(tr);
}

// 5. WTP Operator / Log Report
function initWTPTable() {
    const tbody = document.querySelector('#wtp-table-logs tbody');
    tbody.innerHTML = '';
    addWTPLogRow("08:00");
    addWTPLogRow("12:00");
}

function addWTPLogRow(timeVal = '') {
    const tbody = document.querySelector('#wtp-table-logs tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="input-cell"><input type="time" class="wtp-time" value="${timeVal}"></td>
        <td class="input-cell"><input type="number" step="0.1" class="wtp-src-ph" value="7.2"></td>
        <td class="input-cell"><input type="number" class="wtp-src-tds" value="350"></td>
        <td class="input-cell"><input type="number" step="0.1" class="wtp-psf" value="0.2" oninput="validateWTP(this, 1.0)"></td>
        <td class="input-cell"><input type="text" class="wtp-acf-in" value="2PPM"></td>
        <td class="input-cell"><input type="text" class="wtp-acf-out" value="NIL"></td>
        <td class="input-cell"><input type="number" class="wtp-ro-flow" value="12"></td>
        <td class="input-cell"><input type="number" step="0.1" class="wtp-ro-ph" value="7.1"></td>
        <td class="input-cell"><input type="number" class="wtp-ro-tds" value="110"></td>
        <td class="input-cell"><input type="number" class="wtp-perm-tds" value="12" oninput="validateWTP(this, 20)"></td>
    `;
    tbody.appendChild(tr);
}

function validateWTP(input, maxVal) {
    const val = parseFloat(input.value);
    if (isNaN(val)) return;
    if (val >= maxVal) {
        input.parentElement.className = 'input-cell flag-out-of-spec';
    } else {
        input.parentElement.className = 'input-cell flag-success';
    }
}

// 6. Bailley Minerals Record
function calcClosingStock() {
    for (let i = 1; i <= 2; i++) {
        const opening = parseFloat(document.getElementById(`min-op-${i}`).value) || 0;
        const sol = parseFloat(document.getElementById(`min-sol-${i}`).value) || 0;
        const prod = parseFloat(document.getElementById(`min-prod-${i}`).value) || 0;
        const wastage = parseFloat(document.getElementById(`min-wast-${i}`).value) || 0;
        const rec = parseFloat(document.getElementById(`min-rec-${i}`).value) || 0;

        const closing = opening + rec - (sol + prod + wastage);
        const cell = document.getElementById(`min-cls-${i}`);
        if (cell) {
            cell.innerText = closing.toFixed(2);
            if (closing < 10) {
                cell.className = 'calc-cell flag-out-of-spec';
            } else {
                cell.className = 'calc-cell flag-success';
            }
        }
    }
}

// 7. Dispatch Record
function initDispatchTable() {
    const tbody = document.querySelector('#disp-table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        addDispatchRow();
    }
}

function addDispatchRow() {
    const tbody = document.querySelector('#disp-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="input-cell"><input type="date" class="disp-date"></td>
        <td class="input-cell"><input type="text" class="disp-name" placeholder="Distributor name"></td>
        <td class="input-cell"><input type="text" class="disp-loc" placeholder="City"></td>
        <td class="input-cell">
            <select class="disp-sku">
                <option value="200ml">200ml</option>
                <option value="500ml" selected>500ml</option>
                <option value="1L">1L</option>
                <option value="2L">2L</option>
                <option value="20L">20L</option>
            </select>
        </td>
        <td class="input-cell"><input type="number" class="disp-qty" placeholder="100"></td>
        <td class="input-cell"><input type="date" class="disp-mfg"></td>
        <td class="input-cell"><input type="text" class="disp-batch" placeholder="Lot A"></td>
        <td class="input-cell"><input type="text" class="disp-veh" placeholder="MH-12-..."></td>
        <td class="input-cell"><input type="text" class="disp-by" placeholder="Operator"></td>
    `;
    tbody.appendChild(tr);

    const today = new Date().toISOString().split('T')[0];
    tr.querySelector('.disp-date').value = today;
    tr.querySelector('.disp-mfg').value = today;
}

// 8. Personal Hygiene Checklist
function initHygieneTable() {
    const tbody = document.querySelector('#hyg-table tbody');
    tbody.innerHTML = '';
    const initialStaff = ["Ramesh Kumar", "Suresh Patil", "Anil Shinde", "Sunil Pawar"];
    initialStaff.forEach((name, idx) => addHygieneEmployeeRow(name, idx + 1));
}

function addHygieneEmployeeRow(nameVal = '', index = '') {
    const tbody = document.querySelector('#hyg-table tbody');
    const tr = document.createElement('tr');
    const idx = index || (tbody.children.length + 1);
    tr.innerHTML = `
        <td>${idx}</td>
        <td class="input-cell"><input type="text" class="hyg-name" value="${nameVal}" placeholder="Employee Name"></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-fever" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-nose" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-mask" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-cap" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-trimmed" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-wounds" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-smoking" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-flowers" checked></td>
        <td class="checkbox-cell"><input type="checkbox" class="hyg-jewell" checked></td>
    `;
    tbody.appendChild(tr);
}

// Universal Save Flow
function saveActiveReport(sheetType, status) {
    let payload = {};
    let summary = '';
    const date = document.getElementById('global-working-date').value;

    if (sheetType === 'netcontent') {
        const sku = document.getElementById('nc-sku').value;
        const goods = Array.from(document.querySelectorAll('.nc-goods')).map(el => parseFloat(el.value) || 0);
        const tares = Array.from(document.querySelectorAll('.nc-tare')).map(el => parseFloat(el.value) || 0);
        payload = { sku, goods, tares };
        summary = `${sku} Valve Check (${status}). Entries: ${goods.filter(g => g > 0).length}`;
    } 
    else if (sheetType === 'finishedproduct') {
        const packSize = document.getElementById('fp-pack-size').value;
        const chemist = document.getElementById('fp-chemist').value;
        const times = Array.from(document.querySelectorAll('.fp-time')).map(el => el.value);
        const ozoneOz = Array.from(document.querySelectorAll('.fp-ozone-oz')).map(el => el.value);
        const ozoneProd = Array.from(document.querySelectorAll('.fp-ozone-prod')).map(el => el.value);
        const ph = Array.from(document.querySelectorAll('.fp-ph')).map(el => el.value);
        const tds = Array.from(document.querySelectorAll('.fp-tds')).map(el => el.value);
        
        payload = { packSize, chemist, times, ozoneOz, ozoneProd, ph, tds };
        summary = `Online Product Analysis (${status}) by ${chemist || 'Chemist'}`;
    }
    else if (sheetType === 'release') {
        const target = document.getElementById('rel-to').value;
        payload = { target };
        summary = `Goods Release Auth (${status}) to ${target}`;
    }
    else if (sheetType === 'light') {
        const pack = document.getElementById('li-pack-size').value;
        const shift = document.getElementById('li-shift').value;
        payload = { pack, shift };
        summary = `Light Defect Inspection (${status}) [${shift}]`;
    }
    else if (sheetType === 'wtp') {
        const operator = document.getElementById('wtp-operator').value;
        payload = { operator };
        summary = `WTP Operations Log (${status}) [${operator}]`;
    }
    else if (sheetType === 'minerals') {
        calcClosingStock();
        const base1Cls = document.getElementById('min-cls-1').innerText;
        const base2Cls = document.getElementById('min-cls-2').innerText;
        payload = {
            op1: document.getElementById('min-op-1').value,
            sol1: document.getElementById('min-sol-1').value,
            prod1: document.getElementById('min-prod-1').value,
            wast1: document.getElementById('min-wast-1').value,
            rec1: document.getElementById('min-rec-1').value,
            op2: document.getElementById('min-op-2').value,
            sol2: document.getElementById('min-sol-2').value,
            prod2: document.getElementById('min-prod-2').value,
            wast2: document.getElementById('min-wast-2').value,
            rec2: document.getElementById('min-rec-2').value
        };
        summary = `Bailley Mineral Record (${status}). Total: ${parseFloat(base1Cls) + parseFloat(base2Cls)} kg`;
    }
    else if (sheetType === 'dispatch') {
        summary = `Dispatch Log (${status})`;
    }
    else if (sheetType === 'vehicle') {
        summary = `Vehicle GMP Inspection (${status})`;
    }
    else if (sheetType === 'hygiene') {
        summary = `Personal Hygiene Logs (${status})`;
    }

    // Check if there is already a log for this exact date & type
    const existingLogIdx = db.logs.findIndex(l => l.date === date && l.type === sheetType);

    if (existingLogIdx !== -1) {
        // Overwrite/Update existing day's log
        db.logs[existingLogIdx].status = status;
        db.logs[existingLogIdx].summary = summary;
        db.logs[existingLogIdx].payload = payload;
    } else {
        // Create new day entry
        const newLog = {
            id: 'log_' + Date.now(),
            date: date,
            type: sheetType,
            status: status,
            summary: summary,
            payload: payload
        };
        db.logs.push(newLog);
    }

    localStorage.setItem('kf_qa_logs', JSON.stringify(db.logs));
    updateDashboardStats();
    
    alert(`Report saved as ${status.toUpperCase()}!`);
    
    if (status === 'Final') {
        window.print();
    }
    
    switchView('dashboard');
}

// Load draft data back into DOM
function loadSavedLogIntoForm(log) {
    const p = log.payload;
    if (log.type === 'netcontent') {
        document.getElementById('nc-sku').value = p.sku || '500ml';
        initNetContentTable();
        p.goods.forEach((g, idx) => {
            const rowIdx = idx + 1;
            const goodsInp = document.querySelector(`.nc-goods[data-valve="${rowIdx}"]`);
            const tareInp = document.querySelector(`.nc-tare[data-valve="${rowIdx}"]`);
            if (goodsInp) goodsInp.value = g;
            if (tareInp) tareInp.value = p.tares[idx];
            calcNetContentRow(rowIdx);
        });
    } 
    else if (log.type === 'finishedproduct') {
        document.getElementById('fp-pack-size').value = p.packSize || '';
        document.getElementById('fp-chemist').value = p.chemist || '';
        
        const tbody = document.querySelector('#fp-table tbody');
        tbody.innerHTML = '';
        p.times.forEach((t, idx) => {
            addFPHourlyRow(t);
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.fp-ozone-oz').value = p.ozoneOz[idx] || '';
            latestRow.querySelector('.fp-ozone-prod').value = p.ozoneProd[idx] || '';
            latestRow.querySelector('.fp-ph').value = p.ph[idx] || '';
            latestRow.querySelector('.fp-tds').value = p.tds[idx] || '';
        });
    }
    else if (log.type === 'minerals') {
        document.getElementById('min-op-1').value = p.op1 || 50;
        document.getElementById('min-sol-1').value = p.sol1 || 0;
        document.getElementById('min-prod-1').value = p.prod1 || 0;
        document.getElementById('min-wast-1').value = p.wast1 || 0;
        document.getElementById('min-rec-1').value = p.rec1 || 0;
        document.getElementById('min-op-2').value = p.op2 || 40;
        document.getElementById('min-sol-2').value = p.sol2 || 0;
        document.getElementById('min-prod-2').value = p.prod2 || 0;
        document.getElementById('min-wast-2').value = p.wast2 || 0;
        document.getElementById('min-rec-2').value = p.rec2 || 0;
        calcClosingStock();
    }
}

// Resume Editing Draft helper from UI
function resumeEditingLog(id) {
    const log = db.logs.find(l => l.id === id);
    if (!log) return;
    document.getElementById('global-working-date').value = log.date;
    currentEditLogId = log.id;
    switchView(log.type);
}

// Render Archives list
function renderArchives() {
    const tbody = document.getElementById('archives-list-tbody');
    tbody.innerHTML = '';
    
    const searchVal = document.getElementById('search-logs').value.toLowerCase();
    const typeFilter = document.getElementById('filter-sheet-type').value;

    const filtered = db.logs.filter(log => {
        const matchesSearch = log.date.includes(searchVal) || log.summary.toLowerCase().includes(searchVal);
        const matchesType = typeFilter === 'all' || log.type === typeFilter;
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No logs found matching criteria.</td></tr>`;
        return;
    }

    filtered.forEach(log => {
        const tr = document.createElement('tr');
        const badgeColor = log.status === 'Final' ? 'var(--success)' : 'var(--warning)';
        const badgeBg = log.status === 'Final' ? 'var(--success-light)' : 'var(--warning-light)';
        
        tr.innerHTML = `
            <td><strong>${log.date}</strong></td>
            <td><span class="system-status" style="background-color: var(--primary-light); color: var(--primary);">${log.type.toUpperCase()}</span></td>
            <td>${log.summary}</td>
            <td><span class="system-status" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 700;">${log.status || 'Final'}</span></td>
            <td>
                ${log.status === 'Draft' ? `<button class="btn btn-secondary btn-sm" onclick="resumeEditingLog('${log.id}')" style="background: var(--primary-light); color: var(--primary);">Resume Editing</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="printSavedLog('${log.id}')">Print / View</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSavedLog('${log.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function printSavedLog(id) {
    const log = db.logs.find(l => l.id === id);
    if (!log) return;
    alert(`Logged values: \n\n${JSON.stringify(log.payload, null, 2)}\n\n(Printing document formats)`);
    window.print();
}

function deleteSavedLog(id) {
    if (confirm('Are you sure you want to delete this log entry?')) {
        db.logs = db.logs.filter(l => l.id !== id);
        localStorage.setItem('kf_qa_logs', JSON.stringify(db.logs));
        renderArchives();
        updateDashboardStats();
    }
}

// Consolidated Exporter Logic
function generateConsolidatedReport() {
    const start = document.getElementById('export-start-date').value;
    const end = document.getElementById('export-end-date').value;
    const type = document.getElementById('export-type').value;

    if (!start || !end) {
        alert('Please select both Start and End dates.');
        return;
    }

    // Filter logs in range
    const logs = db.logs.filter(l => l.date >= start && l.date <= end && (type === 'all' || l.type === type));

    if (logs.length === 0) {
        alert('No finalized or draft records found in this date range.');
        return;
    }

    const printLayout = document.getElementById('consolidated-print-layout');
    printLayout.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 2rem;">
            <h1 style="text-align: center; color: #0f172a; margin-bottom: 0.25rem;">K FOODS N BEVERAGES, CHIMBALI</h1>
            <h3 style="text-align: center; color: #475569; margin-top: 0; margin-bottom: 2rem;">Consolidated Quality Assurance Report</h3>
            <p style="text-align: center; font-size: 0.9rem;"><strong>Reporting Period:</strong> ${start} to ${end}</p>
            <hr style="margin-bottom: 2rem; border: 1px solid #cbd5e1;">
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Date</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Report Type</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Summary Metrics</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>${log.date}</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600;">${log.type.toUpperCase()}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">${log.summary}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-transform: uppercase;">${log.status || 'Final'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top: 5rem; display: flex; justify-content: space-between;">
                <div>
                    <p style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;">Quality Inspector</p>
                </div>
                <div>
                    <p style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;">Plant Manager</p>
                </div>
            </div>
        </div>
    `;

    document.body.classList.add('print-range-active');
    window.print();

    // Clear layout after printer loads
    setTimeout(() => {
        printLayout.innerHTML = '';
        document.body.classList.remove('print-range-active');
    }, 1000);
}

// Update Dashboard Statistics
function updateDashboardStats() {
    document.getElementById('stat-total-logs').innerText = db.logs.filter(l => l.status === 'Final').length;
    document.getElementById('stat-pending-releases').innerText = db.logs.filter(l => l.status === 'Draft').length;

    calcClosingStock();
    const base1Cls = document.getElementById('min-cls-1') ? (parseFloat(document.getElementById('min-cls-1').innerText) || 0) : 0;
    const base2Cls = document.getElementById('min-cls-2') ? (parseFloat(document.getElementById('min-cls-2').innerText) || 0) : 0;
    document.getElementById('stat-minerals-stock').innerText = `${(base1Cls + base2Cls).toFixed(1)} kg`;
}

// Analytics Chart
let trendChart;
function initChart() {
    const ctx = document.getElementById('qaTrendsChart').getContext('2d');
    
    const mockTDS = [105, 112, 108, 114, 110, 115, 111];
    const mockPH = [7.2, 7.3, 7.1, 7.2, 7.0, 7.2, 7.4];
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
            datasets: [
                {
                    label: 'pH Level (Optimal: 6.5 - 8.5)',
                    data: mockPH,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    yAxisID: 'y-ph',
                    tension: 0.3
                },
                {
                    label: 'TDS (Optimal: 100 - 125 ppm)',
                    data: mockTDS,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    yAxisID: 'y-tds',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                'y-ph': {
                    type: 'linear',
                    position: 'left',
                    min: 5.5,
                    max: 9.0,
                    title: { display: true, text: 'pH' }
                },
                'y-tds': {
                    type: 'linear',
                    position: 'right',
                    min: 80,
                    max: 150,
                    title: { display: true, text: 'TDS (ppm)' }
                }
            }
        }
    });
}
