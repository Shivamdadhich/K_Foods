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
        document.querySelectorAll('#veh-table input').forEach(inp => inp.value = '');
        document.querySelectorAll('#veh-table select').forEach(sel => sel.selectedIndex = 0);
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
    // Static table in index.html, no need to dynamically append default rows.
    // We just reset all fields on the static rows to empty/defaults.
    const inputs = document.querySelectorAll('#fp-table input');
    inputs.forEach(inp => {
        if (inp.type === 'time') return; // Keep preset times
        inp.value = '';
        inp.parentElement.className = 'input-cell';
    });
    const selects = document.querySelectorAll('#fp-table select');
    selects.forEach(sel => {
        sel.selectedIndex = 0;
    });

    initFPJarTable();
}

function initFPJarTable() {
    const inputs = document.querySelectorAll('#fp-jar-table input');
    inputs.forEach(inp => {
        if (inp.type === 'time') return; // Keep preset times
        if (inp.className === 'fp-jar-chem' || inp.className === 'fp-jar-hot-chem') {
            inp.value = 'SU 120';
        } else if (inp.className === 'fp-jar-cleaning' || inp.className === 'fp-jar-align' || inp.className === 'fp-jar-func' || inp.className === 'fp-jar-interlock') {
            inp.value = 'OK';
        } else if (inp.className === 'fp-jar-scrub') {
            inp.value = 'Done';
        } else if (inp.className === 'fp-jar-prerinse-jets' || inp.className === 'fp-jar-hot-jets' || inp.className === 'fp-jar-pf1-jets' || inp.className === 'fp-jar-pf2-jets' || inp.className === 'fp-jar-pf3-jets') {
            inp.value = '2 Jets';
        } else if (inp.className === 'fp-jar-prerinse-press') {
            inp.value = '2kg';
        } else if (inp.className === 'fp-jar-hot-chem-pct') {
            inp.value = '0.5%';
        } else if (inp.className === 'fp-jar-hot-press') {
            inp.value = '2.2kg';
        } else if (inp.className === 'fp-jar-hot-temp') {
            inp.value = '55C';
        } else if (inp.className === 'fp-jar-pf1-press' || inp.className === 'fp-jar-pf2-press' || inp.className === 'fp-jar-pf3-press') {
            inp.value = '2.1kg';
        } else if (inp.className === 'fp-jar-stage-time' || inp.className === 'fp-jar-totaltime') {
            inp.value = '22';
        } else {
            inp.value = '';
        }
    });

    // Reset closure table as well
    const closureInputs = document.querySelectorAll('#fp-closure-table input');
    closureInputs.forEach(inp => {
        inp.value = '';
    });
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

    document.getElementById('wtp-chem-1').value = 'Chlorine';
    document.getElementById('wtp-supplier-1').value = '';
    document.getElementById('wtp-dates-1').value = '';
    document.getElementById('wtp-dosing-1').value = '';
    document.getElementById('wtp-bw-psf').value = '';
    document.getElementById('wtp-bw-acf').value = '';
}

function addWTPLogRow(timeVal = '') {
    if (typeof timeVal !== 'string' || !timeVal.match(/^\d{2}:\d{2}$/)) {
        timeVal = getCurrentTimeString();
    }
    const tbody = document.querySelector('#wtp-table-logs tbody');
    const idx = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align: center; font-weight: bold;">${idx}</td>
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
    addHygieneEmployeeRow("", 1);
}

function addHygieneEmployeeRow(nameVal = '', index = '') {
    const tbody = document.querySelector('#hyg-table tbody');
    const tr = document.createElement('tr');
    const idx = index || (tbody.querySelectorAll('tr').length + 1);
    tr.innerHTML = `
        <td style="text-align: center; font-weight: bold;">${idx}</td>
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

        const jarPreRinseJets = Array.from(document.querySelectorAll('.fp-jar-prerinse-jets')).map(el => el.value);
        const jarPreRinsePress = Array.from(document.querySelectorAll('.fp-jar-prerinse-press')).map(el => el.value);
        const jarHotJets = Array.from(document.querySelectorAll('.fp-jar-hot-jets')).map(el => el.value);
        const jarHotChem = Array.from(document.querySelectorAll('.fp-jar-hot-chem')).map(el => el.value);
        const jarHotChemPct = Array.from(document.querySelectorAll('.fp-jar-hot-chem-pct')).map(el => el.value);
        const jarHotPress = Array.from(document.querySelectorAll('.fp-jar-hot-press')).map(el => el.value);
        const jarHotTemp = Array.from(document.querySelectorAll('.fp-jar-hot-temp')).map(el => el.value);
        const jarPf1Jets = Array.from(document.querySelectorAll('.fp-jar-pf1-jets')).map(el => el.value);
        const jarPf1Press = Array.from(document.querySelectorAll('.fp-jar-pf1-press')).map(el => el.value);
        const jarPf2Jets = Array.from(document.querySelectorAll('.fp-jar-pf2-jets')).map(el => el.value);
        const jarPf2Press = Array.from(document.querySelectorAll('.fp-jar-pf2-press')).map(el => el.value);
        const jarPf3Jets = Array.from(document.querySelectorAll('.fp-jar-pf3-jets')).map(el => el.value);
        const jarPf3Press = Array.from(document.querySelectorAll('.fp-jar-pf3-press')).map(el => el.value);
        
        const jarStageTimes = Array.from(document.querySelectorAll('.fp-jar-stage-time')).map(el => el.value);
        const jarTotalTimes = Array.from(document.querySelectorAll('.fp-jar-totaltime')).map(el => el.value);
        
        const jarAligns = Array.from(document.querySelectorAll('.fp-jar-align')).map(el => el.value);
        const jarFuncs = Array.from(document.querySelectorAll('.fp-jar-func')).map(el => el.value);
        const jarInterlocks = Array.from(document.querySelectorAll('.fp-jar-interlock')).map(el => el.value);

        // Closure Table
        const closureSuppliers = Array.from(document.querySelectorAll('.fp-closure-supplier')).map(el => el.value);
        const closureMfgDates = Array.from(document.querySelectorAll('.fp-closure-mfg')).map(el => el.value);
        const closureLots = Array.from(document.querySelectorAll('.fp-closure-lot')).map(el => el.value);

        const safetyTank = document.getElementById('fp-safety-tank') ? document.getElementById('fp-safety-tank').checked : false;
        const safetyNozzles = document.getElementById('fp-safety-nozzles') ? document.getElementById('fp-safety-nozzles').checked : false;
        const safetyHopper = document.getElementById('fp-safety-hopper') ? document.getElementById('fp-safety-hopper').checked : false;
        const safetyChute = document.getElementById('fp-safety-chute') ? document.getElementById('fp-safety-chute').checked : false;

        payload = { 
            packSize, chemist, times, ozoneOz, ozoneProd, appearances, odours, tastes, 
            ph, tds, hardness, calciums, magnesiums, colors, finprods, alkalinities, 
            chlorides, sulphates, rfcs, netContents, codings, cableAligns, labelWrinkles, glueStatuses,
            jarTimes, jarChems, jarCleanings, jarScrubs, jarPreRinseJets, jarPreRinsePress, jarHotJets, jarHotChem, jarHotChemPct, jarHotPress, jarHotTemp,
            jarPf1Jets, jarPf1Press, jarPf2Jets, jarPf2Press, jarPf3Jets, jarPf3Press, jarStageTimes, jarTotalTimes, jarAligns, jarFuncs, jarInterlocks,
            closureSuppliers, closureMfgDates, closureLots,
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
        const nos = Array.from(document.querySelectorAll('.veh-no')).map(el => el.value);
        const dests = Array.from(document.querySelectorAll('.veh-dest')).map(el => el.value);
        const cleans = Array.from(document.querySelectorAll('.veh-clean')).map(el => el.value);
        const odours = Array.from(document.querySelectorAll('.veh-odour')).map(el => el.value);
        const tarps = Array.from(document.querySelectorAll('.veh-tarp')).map(el => el.value);
        const remarks = Array.from(document.querySelectorAll('.veh-remark')).map(el => el.value);
        const inspectedBys = Array.from(document.querySelectorAll('.veh-inspected-by')).map(el => el.value);
        const signs = Array.from(document.querySelectorAll('.veh-sign')).map(el => el.value);
        
        payload = { nos, dests, cleans, odours, tarps, remarks, inspectedBys, signs };
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
        
        const fpRows = document.querySelectorAll('#fp-table tbody tr');
        p.times.forEach((t, idx) => {
            const row = fpRows[idx];
            if (!row) return;
            row.querySelector('.fp-time').value = t || '';
            row.querySelector('.fp-ozone-oz').value = p.ozoneOz[idx] || '';
            row.querySelector('.fp-ozone-prod').value = p.ozoneProd[idx] || '';
            row.querySelector('.fp-appearance').value = p.appearances[idx] || 'Clear';
            row.querySelector('.fp-odour').value = p.odours[idx] || 'Agreeable';
            row.querySelector('.fp-taste').value = p.tastes[idx] || 'Agreeable';
            row.querySelector('.fp-ph').value = p.ph[idx] || '';
            row.querySelector('.fp-tds').value = p.tds[idx] || '';
            row.querySelector('.fp-hardness').value = p.hardness[idx] || '';
            row.querySelector('.fp-calcium').value = p.calciums[idx] || '';
            row.querySelector('.fp-magnesium').value = p.magnesiums[idx] || '';
            row.querySelector('.fp-color').value = p.colors[idx] || '';
            row.querySelector('.fp-finprod').value = p.finprods[idx] || '';
            row.querySelector('.fp-alkalinity').value = p.alkalinities[idx] || '';
            row.querySelector('.fp-chloride').value = p.chlorides[idx] || '';
            row.querySelector('.fp-sulphate').value = p.sulphates[idx] || '';
            row.querySelector('.fp-rfc').value = p.rfcs[idx] || '';
            row.querySelector('.fp-net-content').value = p.netContents[idx] || '';
            row.querySelector('.fp-coding').value = p.codings[idx] || 'Clear';
            row.querySelector('.fp-cable').value = p.cableAligns[idx] || 'OK';
            row.querySelector('.fp-wrinkle').value = p.labelWrinkles[idx] || 'No';
            row.querySelector('.fp-glue').value = p.glueStatuses[idx] || 'OK';
        });

        // Restore Jar washing logs
        const jarRows = document.querySelectorAll('#fp-jar-table tbody tr');
        if (p.jarTimes) {
            p.jarTimes.forEach((jt, idx) => {
                const row = jarRows[idx];
                if (!row) return;
                row.querySelector('.fp-jar-time').value = jt || '';
                row.querySelector('.fp-jar-chem').value = p.jarChems[idx] || '';
                row.querySelector('.fp-jar-cleaning').value = p.jarCleanings[idx] || '';
                row.querySelector('.fp-jar-scrub').value = p.jarScrubs[idx] || '';

                if (row.querySelector('.fp-jar-prerinse-jets')) row.querySelector('.fp-jar-prerinse-jets').value = p.jarPreRinseJets[idx] || '';
                if (row.querySelector('.fp-jar-prerinse-press')) row.querySelector('.fp-jar-prerinse-press').value = p.jarPreRinsePress[idx] || '';
                if (row.querySelector('.fp-jar-hot-jets')) row.querySelector('.fp-jar-hot-jets').value = p.jarHotJets[idx] || '';
                if (row.querySelector('.fp-jar-hot-chem')) row.querySelector('.fp-jar-hot-chem').value = p.jarHotChem[idx] || '';
                if (row.querySelector('.fp-jar-hot-chem-pct')) row.querySelector('.fp-jar-hot-chem-pct').value = p.jarHotChemPct[idx] || '';
                if (row.querySelector('.fp-jar-hot-press')) row.querySelector('.fp-jar-hot-press').value = p.jarHotPress[idx] || '';
                if (row.querySelector('.fp-jar-hot-temp')) row.querySelector('.fp-jar-hot-temp').value = p.jarHotTemp[idx] || '';
                if (row.querySelector('.fp-jar-pf1-jets')) row.querySelector('.fp-jar-pf1-jets').value = p.jarPf1Jets[idx] || '';
                if (row.querySelector('.fp-jar-pf1-press')) row.querySelector('.fp-jar-pf1-press').value = p.jarPf1Press[idx] || '';
                if (row.querySelector('.fp-jar-pf2-jets')) row.querySelector('.fp-jar-pf2-jets').value = p.jarPf2Jets[idx] || '';
                if (row.querySelector('.fp-jar-pf2-press')) row.querySelector('.fp-jar-pf2-press').value = p.jarPf2Press[idx] || '';
                if (row.querySelector('.fp-jar-pf3-jets')) row.querySelector('.fp-jar-pf3-jets').value = p.jarPf3Jets[idx] || '';
                if (row.querySelector('.fp-jar-pf3-press')) row.querySelector('.fp-jar-pf3-press').value = p.jarPf3Press[idx] || '';
                
                if (row.querySelector('.fp-jar-stage-time')) row.querySelector('.fp-jar-stage-time').value = p.jarStageTimes[idx] || '';
                row.querySelector('.fp-jar-totaltime').value = p.jarTotalTimes[idx] || '';

                if (row.querySelector('.fp-jar-align')) row.querySelector('.fp-jar-align').value = p.jarAligns[idx] || '';
                if (row.querySelector('.fp-jar-func')) row.querySelector('.fp-jar-func').value = p.jarFuncs[idx] || '';
                if (row.querySelector('.fp-jar-interlock')) row.querySelector('.fp-jar-interlock').value = p.jarInterlocks[idx] || '';
            });
        }

        // Restore Closure Details
        const closureRows = document.querySelectorAll('#fp-closure-table tbody tr');
        if (p.closureSuppliers) {
            p.closureSuppliers.forEach((cs, idx) => {
                const row = closureRows[idx];
                if (!row) return;
                row.querySelector('.fp-closure-supplier').value = cs || '';
                row.querySelector('.fp-closure-mfg').value = p.closureMfgDates[idx] || '';
                row.querySelector('.fp-closure-lot').value = p.closureLots[idx] || '';
            });
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
            validateWTP(latestRow.querySelector('.wtp-psf'), 1.0);
            validateWTP(latestRow.querySelector('.wtp-perm-tds'), 20);
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
        const nos = document.querySelectorAll('.veh-no');
        const dests = document.querySelectorAll('.veh-dest');
        const cleans = document.querySelectorAll('.veh-clean');
        const odours = document.querySelectorAll('.veh-odour');
        const tarps = document.querySelectorAll('.veh-tarp');
        const remarks = document.querySelectorAll('.veh-remark');
        const inspectedBys = document.querySelectorAll('.veh-inspected-by');
        const signs = document.querySelectorAll('.veh-sign');

        if (p.nos) {
            p.nos.forEach((n, idx) => {
                if (nos[idx]) nos[idx].value = n || '';
                if (dests[idx]) dests[idx].value = p.dests[idx] || '';
                if (cleans[idx]) cleans[idx].value = p.cleans[idx] || 'Yes';
                if (odours[idx]) odours[idx].value = p.odours[idx] || 'Yes';
                if (tarps[idx]) tarps[idx].value = p.tarps[idx] || 'Yes';
                if (remarks[idx]) remarks[idx].value = p.remarks[idx] || '';
                if (inspectedBys[idx]) inspectedBys[idx].value = p.inspectedBys[idx] || '';
                if (signs[idx]) signs[idx].value = p.signs[idx] || '';
            });
        }
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
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Online Quality Parameters (Finished Product)</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.65rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Time</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Oz Oz</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Oz Prod</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">App</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Odour</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Taste</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">pH</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">TDS</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Hard</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Ca</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Mg</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Col</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Fin</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Alk</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Chl</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Sul</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">RFC</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Net</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Coding</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Align</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Wrink</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px;">Glue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.times.map((t, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${t}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.ozoneOz[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.ozoneProd[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.appearances[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.odours[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.tastes[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.ph[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.tds[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.hardness[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.calciums[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.magnesiums[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.colors[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.finprods[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.alkalinities[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.chlorides[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.sulphates[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.rfcs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.netContents[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.codings[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.cableAligns[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.labelWrinkles[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.glueStatuses[idx] || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Jar Washing & Sanitation Logs</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.55rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 2px;">Time</th>
                            <th colspan="3" style="border: 1px solid #cbd5e1; padding: 2px;">External</th>
                            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 2px;">Pre Rinse</th>
                            <th colspan="4" style="border: 1px solid #cbd5e1; padding: 2px;">Hot Water & Chem</th>
                            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 2px;">PF 1</th>
                            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 2px;">PF 2</th>
                            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 2px;">PF 3</th>
                            <th style="border: 1px solid #cbd5e1; padding: 2px;">Stage</th>
                            <th style="border: 1px solid #cbd5e1; padding: 2px;">Total</th>
                            <th style="border: 1px solid #cbd5e1; padding: 2px;">Align</th>
                            <th style="border: 1px solid #cbd5e1; padding: 2px;">Func</th>
                            <th style="border: 1px solid #cbd5e1; padding: 2px;">Lock</th>
                        </tr>
                        <tr style="background: #f8fafc;">
                            <th>Chem</th>
                            <th>Clean</th>
                            <th>Scrub</th>
                            <th>Jets</th>
                            <th>Pres</th>
                            <th>Chem</th>
                            <th>%</th>
                            <th>Pres</th>
                            <th>Temp</th>
                            <th>Jets</th>
                            <th>Pres</th>
                            <th>Jets</th>
                            <th>Pres</th>
                            <th>Jets</th>
                            <th>Pres</th>
                            <th>Sec</th>
                            <th>Sec</th>
                            <th>Jet</th>
                            <th>Jets</th>
                            <th>Pres</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.jarTimes.map((jt, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${jt}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarChems[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarCleanings[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarScrubs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPreRinseJets[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPreRinsePress[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarHotChem[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarHotChemPct[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarHotPress[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarHotTemp[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf1Jets[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf1Press[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf2Jets[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf2Press[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf3Jets[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarPf3Press[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarStageTimes[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarTotalTimes[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarAligns[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarFuncs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 2px; text-align: center;">${p.jarInterlocks[idx] || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            if (p.closureSuppliers) {
                dynamicHtml += `
                    <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Closure / Material Details</h5>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Material</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Supplier</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Mfg Date</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px;">Lot No.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Closure</strong></td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureSuppliers[0] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureMfgDates[0] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureLots[0] || '-'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Jar</strong></td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureSuppliers[1] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureMfgDates[1] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureLots[1] || '-'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Shrink Film</strong></td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureSuppliers[2] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureMfgDates[2] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 4px;">${p.closureLots[2] || '-'}</td>
                            </tr>
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
        else if (log.type === 'vehicle') {
            dynamicHtml += `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.65rem; margin-top: 0.5rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 4px; width: 5%;">Sr. No.</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; width: 25%;">Checklist Parameter</th>
                            ${(p.nos || []).map((_, i) => `<th style="border: 1px solid #cbd5e1; padding: 4px;">Veh ${i+1}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">1</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Vehicle No.</strong></td>
                            ${(p.nos || []).map(n => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${n || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">2</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Destination</strong></td>
                            ${(p.dests || []).map(d => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${d || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">3</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Dry, Clean & Hygienic?</strong></td>
                            ${(p.cleans || []).map(c => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${c || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">4</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Free from obnoxious odour?</strong></td>
                            ${(p.odours || []).map(o => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${o || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">5</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Has Tarpaulin roof cover?</strong></td>
                            ${(p.tarps || []).map(t => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${t || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">-</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Remark (if any)</strong></td>
                            ${(p.remarks || []).map(r => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${r || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">-</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Vehicle Inspected by</strong></td>
                            ${(p.inspectedBys || []).map(ib => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${ib || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">-</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px;"><strong>Sign.</strong></td>
                            ${(p.signs || []).map(s => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${s || '-'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            `;
        }
        else if (log.type === 'wtp') {
            dynamicHtml += `
                <p><strong>WTP Operator:</strong> ${p.operator || '-'} | <strong>Line Chemist:</strong> ${p.chemist || '-'}</p>
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Source Water & RO Filtration Logs</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 5%;">Sr.</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 10%;">Time</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 10%;">Source pH</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">Source TDS</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 11%;">PSF Turbidity</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">ACF Inlet</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">ACF Outlet</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">RO Flow</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">RO Feed pH</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 9%;">RO Feed TDS</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; width: 11%;">RO Perm TDS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(p.times || []).map((t, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; font-weight: bold;">${idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${t || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.srcPhs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.srcTdss[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.psfs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.acfIns[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.acfOuts[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.roFlows[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.roPhs[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.roTdss[idx] || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.permTdss[idx] || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Back Wash & Chemical Dosing Activities</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Chemical Used</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Supplier Name</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Mfg/Exp Date</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Dosing Rate</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Backwash PSF</th>
                            <th style="border: 1px solid #cbd5e1; padding: 4px;">Backwash ACF</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.chem) || 'Chlorine'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.supplier) || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.dates) || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.dosing) || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.bwPsf) || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${(p.dosing && p.dosing.bwAcf) || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
        else if (log.type === 'hygiene') {
            dynamicHtml += `
                <p><strong>Supervisor Signature:</strong> ${p.supervisor || '-'}</p>
                <h5 style="margin-top: 0.5rem; margin-bottom: 0.2rem;">Employee Hygiene Checklist Logs</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.65rem; margin-top: 0.2rem; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; width: 5%;">Sr.</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; width: 25%;">Employee Name</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Fever?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Nose?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Mask?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Cap?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Trimmed?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Wounds?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Smoking?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Flowers?</th>
                            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">Jewell?</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(p.names || []).map((name, idx) => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center; font-weight: bold;">${idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px;">${name || '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.fevers[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.noses[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.masks[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.caps[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.trimmeds[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.wounds[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.smokings[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.flowers[idx] ? 'OK' : 'No'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: center;">${p.jewells[idx] ? 'OK' : 'No'}</td>
                            </tr>
                        `).join('')}
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
