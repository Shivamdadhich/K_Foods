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

// Time helper
function getCurrentTimeString() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = today);
    
    const globalDate = document.getElementById('global-working-date');
    if (globalDate) globalDate.value = today;

    const currentMonth = today.substring(0, 7);
    const mInput = document.getElementById('disp-month');
    if (mInput) mInput.value = currentMonth;

    if (sessionStorage.getItem('kf_logged_in') === 'true') {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('app-main-layout').style.display = 'flex';
    } else {
        document.getElementById('landing-page').style.display = 'flex';
        document.getElementById('app-main-layout').style.display = 'none';
    }

    if (localStorage.getItem('kf_sidebar_collapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
    }

    resetAllForms();
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

function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('kf_sidebar_collapsed', isCollapsed ? 'true' : 'false');
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
        if (document.getElementById('fp-safety-tank')) document.getElementById('fp-safety-tank').checked = true;
        if (document.getElementById('fp-safety-nozzles')) document.getElementById('fp-safety-nozzles').checked = true;
        if (document.getElementById('fp-safety-hopper')) document.getElementById('fp-safety-hopper').checked = true;
        if (document.getElementById('fp-safety-chute')) document.getElementById('fp-safety-chute').checked = true;
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
    initFPJarTable();
}

function initFPJarTable() {
    const tbody = document.querySelector('#fp-jar-table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        const defaultHours = ["08:00", "10:00", "12:00", "14:00", "16:00"];
        defaultHours.forEach(time => addFPJarRow(time));
    }
}

function addFPJarRow(timeVal = '') {
    if (typeof timeVal !== 'string' || !timeVal.match(/^\d{2}:\d{2}$/)) {
        timeVal = getCurrentTimeString();
    }
    const tbody = document.querySelector('#fp-jar-table tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
        <td class="input-cell"><input type="time" class="fp-jar-time" value="${timeVal}"></td>
        <td class="input-cell"><input type="text" class="fp-jar-chem" value="SU 120"></td>
        <td class="input-cell"><input type="text" class="fp-jar-cleaning" value="OK"></td>
        <td class="input-cell"><input type="text" class="fp-jar-scrub" value="Done"></td>
        <td class="input-cell"><input type="text" class="fp-jar-prerinse" value="2 Jets / 2kg"></td>
        <td class="input-cell"><input type="text" class="fp-jar-hotwater" value="55C / 0.5%"></td>
        <td class="input-cell"><input type="text" class="fp-jar-prefinal" value="OK"></td>
        <td class="input-cell"><input type="number" class="fp-jar-totaltime" value="22"></td>
    `;
    tbody.appendChild(tr);
}

function addFPHourlyRow(timeVal = '') {
    if (typeof timeVal !== 'string' || !timeVal.match(/^\d{2}:\d{2}$/)) {
        timeVal = getCurrentTimeString();
    }
    const tbody = document.querySelector('#fp-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
        <td class="input-cell"><input type="number" step="1" class="fp-calcium" placeholder="12" oninput="validateFP(this, 11, 200)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-magnesium" placeholder="8" oninput="validateFP(this, 6, 200)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-color" placeholder="1" oninput="validateFP(this, 0, 2)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-finprod" placeholder="1" oninput="validateFP(this, 0, 2)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-alkalinity" placeholder="150" oninput="validateFP(this, 0, 200)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-chloride" placeholder="120" oninput="validateFP(this, 0, 200)"></td>
        <td class="input-cell"><input type="number" step="1" class="fp-sulphate" placeholder="80" oninput="validateFP(this, 0, 200)"></td>
        <td class="input-cell"><input type="number" step="0.05" class="fp-rfc" placeholder="0.1" oninput="validateFP(this, 0, 0.2)"></td>
        <td class="input-cell"><input type="text" class="fp-net-content" placeholder="OK"></td>
        <td class="input-cell">
            <select class="fp-coding"><option value="Clear">Clear</option><option value="Smudged">Smudged</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-cable"><option value="OK">OK</option><option value="Misaligned">Misaligned</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-wrinkle"><option value="No">No</option><option value="Yes">Yes</option></select>
        </td>
        <td class="input-cell">
            <select class="fp-glue"><option value="OK">OK</option><option value="Bad">Bad</option></select>
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
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
}

// 4. Light Inspection Record
function initLightInspectionTable() {
    const tbody = document.querySelector('#li-table tbody');
    tbody.innerHTML = '';
    const hours = ["09:00", "11:00", "13:00", "15:00"];
    hours.forEach(time => addLightInspectionRow(time));
}

function addLightInspectionRow(timeVal = '') {
    if (typeof timeVal !== 'string' || !timeVal.match(/^\d{2}:\d{2}$/)) {
        timeVal = getCurrentTimeString();
    }
    const tbody = document.querySelector('#li-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
    if (typeof timeVal !== 'string' || !timeVal.match(/^\d{2}:\d{2}$/)) {
        timeVal = getCurrentTimeString();
    }
    const tbody = document.querySelector('#wtp-table-logs tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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

// 6. Minerals
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

// 7. Dispatch
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
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
        <td class="input-cell"><input type="text" class="disp-batch" placeholder="Lot A"></td>
        <td class="input-cell"><input type="text" class="disp-veh" placeholder="MH-12-..."></td>
        <td class="input-cell"><input type="text" class="disp-by" placeholder="Operator"></td>
    `;
    tbody.appendChild(tr);
}

// 8. Hygiene
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
        <td class="checkbox-cell">
            <button class="btn btn-danger" onclick="this.closest('tr').remove()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
        const appearances = Array.from(document.querySelectorAll('.fp-appearance')).map(el => el.value);
        const odours = Array.from(document.querySelectorAll('.fp-odour')).map(el => el.value);
        const tastes = Array.from(document.querySelectorAll('.fp-taste')).map(el => el.value);
        const ph = Array.from(document.querySelectorAll('.fp-ph')).map(el => el.value);
        const tds = Array.from(document.querySelectorAll('.fp-tds')).map(el => el.value);
        const hardness = Array.from(document.querySelectorAll('.fp-hardness')).map(el => el.value);
        const calciums = Array.from(document.querySelectorAll('.fp-calcium')).map(el => el.value);
        const magnesiums = Array.from(document.querySelectorAll('.fp-magnesium')).map(el => el.value);
        const colors = Array.from(document.querySelectorAll('.fp-color')).map(el => el.value);
        const finprods = Array.from(document.querySelectorAll('.fp-finprod')).map(el => el.value);
        const alkalinities = Array.from(document.querySelectorAll('.fp-alkalinity')).map(el => el.value);
        const chlorides = Array.from(document.querySelectorAll('.fp-chloride')).map(el => el.value);
        const sulphates = Array.from(document.querySelectorAll('.fp-sulphate')).map(el => el.value);
        const rfcs = Array.from(document.querySelectorAll('.fp-rfc')).map(el => el.value);
        const netContents = Array.from(document.querySelectorAll('.fp-net-content')).map(el => el.value);
        const codings = Array.from(document.querySelectorAll('.fp-coding')).map(el => el.value);
        const cableAligns = Array.from(document.querySelectorAll('.fp-cable')).map(el => el.value);
        const labelWrinkles = Array.from(document.querySelectorAll('.fp-wrinkle')).map(el => el.value);
        const glueStatuses = Array.from(document.querySelectorAll('.fp-glue')).map(el => el.value);
        
        const jarTimes = Array.from(document.querySelectorAll('.fp-jar-time')).map(el => el.value);
        const jarChems = Array.from(document.querySelectorAll('.fp-jar-chem')).map(el => el.value);
        const jarCleanings = Array.from(document.querySelectorAll('.fp-jar-cleaning')).map(el => el.value);
        const jarScrubs = Array.from(document.querySelectorAll('.fp-jar-scrub')).map(el => el.value);
        const jarPreRinses = Array.from(document.querySelectorAll('.fp-jar-prerinse')).map(el => el.value);
        const jarHotWaters = Array.from(document.querySelectorAll('.fp-jar-hotwater')).map(el => el.value);
        const jarPreFinals = Array.from(document.querySelectorAll('.fp-jar-prefinal')).map(el => el.value);
        const jarTotalTimes = Array.from(document.querySelectorAll('.fp-jar-totaltime')).map(el => el.value);

        const safetyTank = document.getElementById('fp-safety-tank') ? document.getElementById('fp-safety-tank').checked : false;
        const safetyNozzles = document.getElementById('fp-safety-nozzles') ? document.getElementById('fp-safety-nozzles').checked : false;
        const safetyHopper = document.getElementById('fp-safety-hopper') ? document.getElementById('fp-safety-hopper').checked : false;
        const safetyChute = document.getElementById('fp-safety-chute') ? document.getElementById('fp-safety-chute').checked : false;

        payload = { 
            packSize, chemist, times, ozoneOz, ozoneProd, appearances, odours, tastes, 
            ph, tds, hardness, calciums, magnesiums, colors, finprods, alkalinities, 
            chlorides, sulphates, rfcs, netContents, codings, cableAligns, labelWrinkles, glueStatuses,
            jarTimes, jarChems, jarCleanings, jarScrubs, jarPreRinses, jarHotWaters, jarPreFinals, jarTotalTimes,
            safetyTank, safetyNozzles, safetyHopper, safetyChute
        };
        summary = `Online Product Analysis (${status}) by ${chemist || 'Chemist'}`;
    }
    else if (sheetType === 'release') {
        const target = document.getElementById('rel-to').value;
        const packSizes = Array.from(document.querySelectorAll('.rel-pack-size')).map(el => el.value);
        const lotSizes = Array.from(document.querySelectorAll('.rel-lot-size')).map(el => el.value);
        const apps = Array.from(document.querySelectorAll('.rel-app')).map(el => el.value);
        const tastes = Array.from(document.querySelectorAll('.rel-taste')).map(el => el.value);
        const phs = Array.from(document.querySelectorAll('.rel-ph')).map(el => el.value);
        const tdss = Array.from(document.querySelectorAll('.rel-tds')).map(el => el.value);
        const tbcs = Array.from(document.querySelectorAll('.rel-tbc')).map(el => el.value);
        const yms = Array.from(document.querySelectorAll('.rel-ym')).map(el => el.value);
        const statuses = Array.from(document.querySelectorAll('.rel-status')).map(el => el.value);
        payload = { target, packSizes, lotSizes, apps, tastes, phs, tdss, tbcs, yms, statuses };
        summary = `Goods Release Auth (${status}) to ${target}`;
    }
    else if (sheetType === 'light') {
        const pack = document.getElementById('li-pack-size').value;
        const shift = document.getElementById('li-shift').value;
        const times = Array.from(document.querySelectorAll('.li-time')).map(el => el.value);
        const foreigns = Array.from(document.querySelectorAll('.li-foreign')).map(el => el.value);
        const crosses = Array.from(document.querySelectorAll('.li-cross')).map(el => el.value);
        const looses = Array.from(document.querySelectorAll('.li-loose')).map(el => el.value);
        const opens = Array.from(document.querySelectorAll('.li-open')).map(el => el.value);
        const lows = Array.from(document.querySelectorAll('.li-low')).map(el => el.value);
        const leaks = Array.from(document.querySelectorAll('.li-leak')).map(el => el.value);
        const milks = Array.from(document.querySelectorAll('.li-milk')).map(el => el.value);
        const inspectors = Array.from(document.querySelectorAll('.li-inspector')).map(el => el.value);
        const remarks = Array.from(document.querySelectorAll('.li-remarks')).map(el => el.value);
        payload = { pack, shift, times, foreigns, crosses, looses, opens, lows, leaks, milks, inspectors, remarks };
        summary = `Light Defect Inspection (${status}) [${shift}]`;
    }
    else if (sheetType === 'wtp') {
        const operator = document.getElementById('wtp-operator').value;
        const chemist = document.getElementById('wtp-chemist').value;
        const times = Array.from(document.querySelectorAll('.wtp-time')).map(el => el.value);
        const srcPhs = Array.from(document.querySelectorAll('.wtp-src-ph')).map(el => el.value);
        const srcTdss = Array.from(document.querySelectorAll('.wtp-src-tds')).map(el => el.value);
        const psfs = Array.from(document.querySelectorAll('.wtp-psf')).map(el => el.value);
        const acfIns = Array.from(document.querySelectorAll('.wtp-acf-in')).map(el => el.value);
        const acfOuts = Array.from(document.querySelectorAll('.wtp-acf-out')).map(el => el.value);
        const roFlows = Array.from(document.querySelectorAll('.wtp-ro-flow')).map(el => el.value);
        const roPhs = Array.from(document.querySelectorAll('.wtp-ro-ph')).map(el => el.value);
        const roTdss = Array.from(document.querySelectorAll('.wtp-ro-tds')).map(el => el.value);
        const permTdss = Array.from(document.querySelectorAll('.wtp-perm-tds')).map(el => el.value);
        const dosing = {
            chem: document.getElementById('wtp-chem-1').value,
            supplier: document.getElementById('wtp-supplier-1').value,
            dates: document.getElementById('wtp-dates-1').value,
            dosing: document.getElementById('wtp-dosing-1').value,
            bwPsf: document.getElementById('wtp-bw-psf').value,
            bwAcf: document.getElementById('wtp-bw-acf').value
        };
        payload = { operator, chemist, times, srcPhs, srcTdss, psfs, acfIns, acfOuts, roFlows, roPhs, roTdss, permTdss, dosing };
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
        const names = Array.from(document.querySelectorAll('.disp-name')).map(el => el.value);
        const locs = Array.from(document.querySelectorAll('.disp-loc')).map(el => el.value);
        const skus = Array.from(document.querySelectorAll('.disp-sku')).map(el => el.value);
        const qtys = Array.from(document.querySelectorAll('.disp-qty')).map(el => el.value);
        const batches = Array.from(document.querySelectorAll('.disp-batch')).map(el => el.value);
        const vehs = Array.from(document.querySelectorAll('.disp-veh')).map(el => el.value);
        const bys = Array.from(document.querySelectorAll('.disp-by')).map(el => el.value);
        payload = { names, locs, skus, qtys, batches, vehs, bys };
        summary = `Dispatch Log (${status})`;
    }
    else if (sheetType === 'vehicle') {
        payload = {
            vehNoA: document.getElementById('veh-no-a').value,
            vehNoB: document.getElementById('veh-no-b').value,
            vehNoC: document.getElementById('veh-no-c').value,
            vehNoD: document.getElementById('veh-no-d').value,
            destA: document.getElementById('veh-dest-a').value,
            destB: document.getElementById('veh-dest-b').value,
            destC: document.getElementById('veh-dest-c').value,
            destD: document.getElementById('veh-dest-d').value,
            cleanA: document.getElementById('veh-clean-a').value,
            cleanB: document.getElementById('veh-clean-b').value,
            cleanC: document.getElementById('veh-clean-c').value,
            cleanD: document.getElementById('veh-clean-d').value,
            odourA: document.getElementById('veh-odour-a').value,
            odourB: document.getElementById('veh-odour-b').value,
            odourC: document.getElementById('veh-odour-c').value,
            odourD: document.getElementById('veh-odour-d').value,
            tarpA: document.getElementById('veh-tarp-a').value,
            tarpB: document.getElementById('veh-tarp-b').value,
            tarpC: document.getElementById('veh-tarp-c').value,
            tarpD: document.getElementById('veh-tarp-d').value,
            remA: document.getElementById('veh-rem-a').value,
            remB: document.getElementById('veh-rem-b').value,
            remC: document.getElementById('veh-rem-c').value,
            remD: document.getElementById('veh-rem-d').value
        };
        summary = `Vehicle GMP Inspection (${status})`;
    }
    else if (sheetType === 'hygiene') {
        const names = Array.from(document.querySelectorAll('.hyg-name')).map(el => el.value);
        const supervisor = document.getElementById('hyg-supervisor').value;
        const fevers = Array.from(document.querySelectorAll('.hyg-fever')).map(el => el.checked);
        const noses = Array.from(document.querySelectorAll('.hyg-nose')).map(el => el.checked);
        const masks = Array.from(document.querySelectorAll('.hyg-mask')).map(el => el.checked);
        const caps = Array.from(document.querySelectorAll('.hyg-cap')).map(el => el.checked);
        const trimmeds = Array.from(document.querySelectorAll('.hyg-trimmed')).map(el => el.checked);
        const wounds = Array.from(document.querySelectorAll('.hyg-wounds')).map(el => el.checked);
        const smokings = Array.from(document.querySelectorAll('.hyg-smoking')).map(el => el.checked);
        const flowers = Array.from(document.querySelectorAll('.hyg-flowers')).map(el => el.checked);
        const jewells = Array.from(document.querySelectorAll('.hyg-jewell')).map(el => el.checked);
        payload = { supervisor, names, fevers, noses, masks, caps, trimmeds, wounds, smokings, flowers, jewells };
        summary = `Personal Hygiene Logs (${status})`;
    }

    const existingLogIdx = db.logs.findIndex(l => l.date === date && l.type === sheetType);

    if (existingLogIdx !== -1) {
        db.logs[existingLogIdx].status = status;
        db.logs[existingLogIdx].summary = summary;
        db.logs[existingLogIdx].payload = payload;
    } else {
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
            latestRow.querySelector('.fp-appearance').value = p.appearances[idx] || 'Clear';
            latestRow.querySelector('.fp-odour').value = p.odours[idx] || 'Agreeable';
            latestRow.querySelector('.fp-taste').value = p.tastes[idx] || 'Agreeable';
            latestRow.querySelector('.fp-ph').value = p.ph[idx] || '';
            latestRow.querySelector('.fp-tds').value = p.tds[idx] || '';
            latestRow.querySelector('.fp-hardness').value = p.hardness[idx] || '';
            latestRow.querySelector('.fp-calcium').value = p.calciums[idx] || '';
            latestRow.querySelector('.fp-magnesium').value = p.magnesiums[idx] || '';
            latestRow.querySelector('.fp-color').value = p.colors[idx] || '';
            latestRow.querySelector('.fp-finprod').value = p.finprods[idx] || '';
            latestRow.querySelector('.fp-alkalinity').value = p.alkalinities[idx] || '';
            latestRow.querySelector('.fp-chloride').value = p.chlorides[idx] || '';
            latestRow.querySelector('.fp-sulphate').value = p.sulphates[idx] || '';
            latestRow.querySelector('.fp-rfc').value = p.rfcs[idx] || '';
            latestRow.querySelector('.fp-net-content').value = p.netContents[idx] || '';
            latestRow.querySelector('.fp-coding').value = p.codings[idx] || 'Clear';
            latestRow.querySelector('.fp-cable').value = p.cableAligns[idx] || 'OK';
            latestRow.querySelector('.fp-wrinkle').value = p.labelWrinkles[idx] || 'No';
            latestRow.querySelector('.fp-glue').value = p.glueStatuses[idx] || 'OK';
        });

        // Restore Jar washing logs
        const jarTbody = document.querySelector('#fp-jar-table tbody');
        if (jarTbody) {
            jarTbody.innerHTML = '';
            if (p.jarTimes) {
                p.jarTimes.forEach((jt, idx) => {
                    addFPJarRow(jt);
                    const rows = jarTbody.querySelectorAll('tr');
                    const latestRow = rows[rows.length - 1];
                    latestRow.querySelector('.fp-jar-chem').value = p.jarChems[idx] || '';
                    latestRow.querySelector('.fp-jar-cleaning').value = p.jarCleanings[idx] || '';
                    latestRow.querySelector('.fp-jar-scrub').value = p.jarScrubs[idx] || '';
                    latestRow.querySelector('.fp-jar-prerinse').value = p.jarPreRinses[idx] || '';
                    latestRow.querySelector('.fp-jar-hotwater').value = p.jarHotWaters[idx] || '';
                    latestRow.querySelector('.fp-jar-prefinal').value = p.jarPreFinals[idx] || '';
                    latestRow.querySelector('.fp-jar-totaltime').value = p.jarTotalTimes[idx] || '';
                });
            } else {
                initFPJarTable();
            }
        }

        // Restore checkboxes
        if (document.getElementById('fp-safety-tank')) document.getElementById('fp-safety-tank').checked = p.safetyTank !== false;
        if (document.getElementById('fp-safety-nozzles')) document.getElementById('fp-safety-nozzles').checked = p.safetyNozzles !== false;
        if (document.getElementById('fp-safety-hopper')) document.getElementById('fp-safety-hopper').checked = p.safetyHopper !== false;
        if (document.getElementById('fp-safety-chute')) document.getElementById('fp-safety-chute').checked = p.safetyChute !== false;
    }
    else if (log.type === 'release') {
        document.getElementById('rel-to').value = p.target || '';
        const tbody = document.querySelector('#rel-table tbody');
        tbody.innerHTML = '';
        p.packSizes.forEach((ps, idx) => {
            addReleaseRow();
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.rel-pack-size').value = ps || '';
            latestRow.querySelector('.rel-lot-size').value = p.lotSizes[idx] || '';
            latestRow.querySelector('.rel-app').value = p.apps[idx] || '';
            latestRow.querySelector('.rel-taste').value = p.tastes[idx] || '';
            latestRow.querySelector('.rel-ph').value = p.phs[idx] || '';
            latestRow.querySelector('.rel-tds').value = p.tdss[idx] || '';
            latestRow.querySelector('.rel-tbc').value = p.tbcs[idx] || '';
            latestRow.querySelector('.rel-ym').value = p.yms[idx] || '';
            latestRow.querySelector('.rel-status').value = p.statuses[idx] || 'RELEASED';
        });
    }
    else if (log.type === 'light') {
        document.getElementById('li-pack-size').value = p.pack || '';
        document.getElementById('li-shift').value = p.shift || '';
        const tbody = document.querySelector('#li-table tbody');
        tbody.innerHTML = '';
        p.times.forEach((t, idx) => {
            addLightInspectionRow(t);
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.li-foreign').value = p.foreigns[idx] || 0;
            latestRow.querySelector('.li-cross').value = p.crosses[idx] || 0;
            latestRow.querySelector('.li-loose').value = p.looses[idx] || 0;
            latestRow.querySelector('.li-open').value = p.opens[idx] || 0;
            latestRow.querySelector('.li-low').value = p.lows[idx] || 0;
            latestRow.querySelector('.li-leak').value = p.leaks[idx] || 0;
            latestRow.querySelector('.li-milk').value = p.milks[idx] || 0;
            latestRow.querySelector('.li-inspector').value = p.inspectors[idx] || '';
            latestRow.querySelector('.li-remarks').value = p.remarks[idx] || '';
        });
    }
    else if (log.type === 'wtp') {
        document.getElementById('wtp-operator').value = p.operator || '';
        document.getElementById('wtp-chemist').value = p.chemist || '';
        const tbody = document.querySelector('#wtp-table-logs tbody');
        tbody.innerHTML = '';
        p.times.forEach((t, idx) => {
            addWTPLogRow(t);
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.wtp-src-ph').value = p.srcPhs[idx] || '';
            latestRow.querySelector('.wtp-src-tds').value = p.srcTdss[idx] || '';
            latestRow.querySelector('.wtp-psf').value = p.psfs[idx] || '';
            latestRow.querySelector('.wtp-acf-in').value = p.acfIns[idx] || '';
            latestRow.querySelector('.wtp-acf-out').value = p.acfOuts[idx] || '';
            latestRow.querySelector('.wtp-ro-flow').value = p.roFlows[idx] || '';
            latestRow.querySelector('.wtp-ro-ph').value = p.roPhs[idx] || '';
            latestRow.querySelector('.wtp-ro-tds').value = p.roTdss[idx] || '';
            latestRow.querySelector('.wtp-perm-tds').value = p.permTdss[idx] || '';
        });
        if (p.dosing) {
            document.getElementById('wtp-chem-1').value = p.dosing.chem || '';
            document.getElementById('wtp-supplier-1').value = p.dosing.supplier || '';
            document.getElementById('wtp-dates-1').value = p.dosing.dates || '';
            document.getElementById('wtp-dosing-1').value = p.dosing.dosing || '';
            document.getElementById('wtp-bw-psf').value = p.dosing.bwPsf || '';
            document.getElementById('wtp-bw-acf').value = p.dosing.bwAcf || '';
        }
    }
    else if (log.type === 'minerals') {
        document.getElementById('min-date').value = p.date || '';
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
    else if (log.type === 'dispatch') {
        const tbody = document.querySelector('#disp-table tbody');
        tbody.innerHTML = '';
        p.names.forEach((n, idx) => {
            addDispatchRow();
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.disp-name').value = n || '';
            latestRow.querySelector('.disp-loc').value = p.locs[idx] || '';
            latestRow.querySelector('.disp-sku').value = p.skus[idx] || '500ml';
            latestRow.querySelector('.disp-qty').value = p.qtys[idx] || '';
            latestRow.querySelector('.disp-batch').value = p.batches[idx] || '';
            latestRow.querySelector('.disp-veh').value = p.vehs[idx] || '';
            latestRow.querySelector('.disp-by').value = p.bys[idx] || '';
        });
    }
    else if (log.type === 'vehicle') {
        document.getElementById('veh-no-a').value = p.vehNoA || '';
        document.getElementById('veh-no-b').value = p.vehNoB || '';
        document.getElementById('veh-no-c').value = p.vehNoC || '';
        document.getElementById('veh-no-d').value = p.vehNoD || '';
        document.getElementById('veh-dest-a').value = p.destA || '';
        document.getElementById('veh-dest-b').value = p.destB || '';
        document.getElementById('veh-dest-c').value = p.destC || '';
        document.getElementById('veh-dest-d').value = p.destD || '';
        document.getElementById('veh-clean-a').value = p.cleanA || 'Yes';
        document.getElementById('veh-clean-b').value = p.cleanB || 'Yes';
        document.getElementById('veh-clean-c').value = p.cleanC || 'Yes';
        document.getElementById('veh-clean-d').value = p.cleanD || 'Yes';
        document.getElementById('veh-odour-a').value = p.odourA || 'Yes';
        document.getElementById('veh-odour-b').value = p.odourB || 'Yes';
        document.getElementById('veh-odour-c').value = p.odourC || 'Yes';
        document.getElementById('veh-odour-d').value = p.odourD || 'Yes';
        document.getElementById('veh-tarp-a').value = p.tarpA || 'Yes';
        document.getElementById('veh-tarp-b').value = p.tarpB || 'Yes';
        document.getElementById('veh-tarp-c').value = p.tarpC || 'Yes';
        document.getElementById('veh-tarp-d').value = p.tarpD || 'Yes';
        document.getElementById('veh-rem-a').value = p.remA || '';
        document.getElementById('veh-rem-b').value = p.remB || '';
        document.getElementById('veh-rem-c').value = p.remC || '';
        document.getElementById('veh-rem-d').value = p.remD || '';
    }
    else if (log.type === 'hygiene') {
        document.getElementById('hyg-supervisor').value = p.supervisor || '';
        const tbody = document.querySelector('#hyg-table tbody');
        tbody.innerHTML = '';
        p.names.forEach((name, idx) => {
            addHygieneEmployeeRow(name, idx + 1);
            const rows = tbody.querySelectorAll('tr');
            const latestRow = rows[rows.length - 1];
            latestRow.querySelector('.hyg-fever').checked = p.fevers[idx] !== false;
            latestRow.querySelector('.hyg-nose').checked = p.noses[idx] !== false;
            latestRow.querySelector('.hyg-mask').checked = p.masks[idx] !== false;
            latestRow.querySelector('.hyg-cap').checked = p.caps[idx] !== false;
            latestRow.querySelector('.hyg-trimmed').checked = p.trimmeds[idx] !== false;
            latestRow.querySelector('.hyg-wounds').checked = p.wounds[idx] !== false;
            latestRow.querySelector('.hyg-smoking').checked = p.smokings[idx] !== false;
            latestRow.querySelector('.hyg-flowers').checked = p.flowers[idx] !== false;
            latestRow.querySelector('.hyg-jewell').checked = p.jewells[idx] !== false;
        });
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
    
    document.getElementById('global-working-date').value = log.date;
    loadSavedLogIntoForm(log);
    switchView(log.type);
    setTimeout(() => {
        window.print();
    }, 300);
}

function deleteSavedLog(id) {
    if (confirm('Are you sure you want to delete this log entry?')) {
        db.logs = db.logs.filter(l => l.id !== id);
        localStorage.setItem('kf_qa_logs', JSON.stringify(db.logs));
        renderArchives();
        updateDashboardStats();
    }
}

// Consolidated Exporter Logic rendering actual PDF data
function generateConsolidatedReport() {
    const start = document.getElementById('export-start-date').value;
    const end = document.getElementById('export-end-date').value;
    const type = document.getElementById('export-type').value;

    if (!start || !end) {
        alert('Please select both Start and End dates.');
        return;
    }

    const logs = db.logs.filter(l => l.date >= start && l.date <= end && (type === 'all' || l.type === type));

    if (logs.length === 0) {
        alert('No quality records found in this date range.');
        return;
    }

    const printLayout = document.getElementById('consolidated-print-layout');
    let dynamicHtml = `
        <div style="font-family: Arial, sans-serif; padding: 1.5rem;">
            <h1 style="text-align: center; color: #0f172a; margin-bottom: 0.25rem;">K FOODS N BEVERAGES, CHIMBALI</h1>
            <h3 style="text-align: center; color: #475569; margin-top: 0; margin-bottom: 2rem;">Consolidated Quality Report Book</h3>
            <p style="text-align: center; font-size: 0.9rem;"><strong>Reporting Range:</strong> ${start} to ${end}</p>
            <hr style="margin-bottom: 2rem; border: 1px solid #cbd5e1;">
    `;

    logs.forEach(log => {
        const p = log.payload;
        dynamicHtml += `
            <div style="page-break-after: always; margin-bottom: 3rem;">
                <h3 style="background: #f1f5f9; padding: 0.5rem; border-left: 5px solid var(--primary);">
                    Date: ${log.date} - ${log.type.toUpperCase()} (${log.status || 'Final'})
                </h3>
        `;

        if (log.type === 'netcontent') {
            dynamicHtml += `
                <p><strong>SKU Size:</strong> ${p.sku}</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.5rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Valve No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Goods Wt (g)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Tare Wt (g)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Net Wt (g)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.goods.map((g, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">Valve ${idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${g}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.tares[idx]}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${(g - p.tares[idx]).toFixed(1)}</td>
                            </tr>
                        `).slice(0, 22).join('')}
                    </tbody>
                </table>
            `;
        } 
        else if (log.type === 'finishedproduct') {
            dynamicHtml += `
                <p><strong>Pack Size:</strong> ${p.packSize} | <strong>Line Chemist:</strong> ${p.chemist}</p>
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Online Quality Parameters</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Time</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Oz Oz</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Oz Prod</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">pH</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">TDS</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Ca</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Mg</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Alkalinity</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Chloride</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.times.map((t, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${t}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.ozoneOz[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.ozoneProd[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.ph[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.tds[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.calciums[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.magnesiums[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.alkalinities[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.chlorides[idx] || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            if (p.jarTimes) {
                dynamicHtml += `
                    <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Jar Washing & Sanitation Logs</h5>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 4px;">Time</th>
                                <th colspan="3" style="border: 1px solid #cbd5e1; padding: 4px;">Jar External Washing</th>
                                <th colspan="4" style="border: 1px solid #cbd5e1; padding: 4px;">Jar Internal Rinsing</th>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Chem</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Clean</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Scrub</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Pre-Rinse</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Hot Water</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Pre-Final</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Time (s)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.jarTimes.map((jt, idx) => `
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${jt}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarChems[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarCleanings[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarScrubs[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarPreRinses[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarHotWaters[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${p.jarPreFinals[idx] || '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.jarTotalTimes[idx] || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            dynamicHtml += `
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Start-up Safety Activities</h5>
                <p style="font-size: 0.75rem; margin-top: 0.2rem;">
                    Washer Tank: <strong>${p.safetyTank ? 'CLEANED' : 'NOT CLEANED'}</strong> | 
                    Jet Nozzles: <strong>${p.safetyNozzles ? 'CLEANED' : 'NOT CLEANED'}</strong> | 
                    Capper Hopper: <strong>${p.safetyHopper ? 'CLEANED' : 'NOT CLEANED'}</strong> | 
                    Capper Chute: <strong>${p.safetyChute ? 'CLEANED' : 'NOT CLEANED'}</strong>
                </p>
            `;
        }
        else if (log.type === 'minerals') {
            dynamicHtml += `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.5rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Mineral</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Opening (kg)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Prep Solution (kg)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Production (kg)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Wastage (kg)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px;">Receipts (kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Base 1</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.op1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.sol1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.prod1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.wast1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.rec1}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Base 2</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.op2}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.sol2}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.prod2}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.wast2}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${p.rec2}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
        else {
            dynamicHtml += `<p style="font-size: 0.85rem; color: #64748b;">${log.summary}</p>`;
        }

        dynamicHtml += `</div>`;
    });

    dynamicHtml += `</div>`;
    printLayout.innerHTML = dynamicHtml;

    document.body.classList.add('print-range-active');
    window.print();

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
