const API = "/api/students";
const form = document.getElementById("student-form");
const tbody = document.getElementById("students-tbody");
const recentTbody = document.getElementById("recent-students-tbody");
const totalCountEl = document.getElementById("total-students-count");
const avgGpaEl = document.getElementById("avg-gpa");
const avgAttendanceEl = document.getElementById("avg-attendance");

const globalSearch = document.getElementById("global-search");
const directorySearch = document.getElementById("filter-search"); // Added for explicit target pairing
const filterDept = document.getElementById("filter-dept");
const filterYear = document.getElementById("filter-year");
const filterGpa = document.getElementById("filter-gpa");
const filterSort = document.getElementById("filter-sort");

const modalOverlay = document.getElementById("modal-overlay");
const modalConfirmBtn = document.getElementById("modal-confirm");
const modalCancelBtn = document.getElementById("modal-cancel");

let chartInstances = {};
let targetDeletionId = null;

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigationRailControls();
  setupFilterInputEventBindings();
  setupFileStreamingExportTriggers();
  synchronizeSystemMetricsData(); 
});

function initializeNavigationRailControls() {
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", (e) => {
      const targetViewName = button.getAttribute("data-view");
      
      document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
      
      const activeNavButton = document.querySelector(`[data-view="${targetViewName}"]`);
      if (activeNavButton) activeNavButton.classList.add("active");

      document.querySelectorAll(".view").forEach(view => {
        view.hidden = true;
        view.classList.remove("active");
      });

      const activeTargetPanelEl = document.getElementById(`view-${targetViewName}`);
      if (activeTargetPanelEl) {
        activeTargetPanelEl.hidden = false;
        activeTargetPanelEl.classList.add("active");
      }

      if (targetViewName === "add" && !document.getElementById("edit-id").value) {
        document.getElementById("form-title").innerText = "Add New Student";
        form.reset();
      }

      synchronizeSystemMetricsData();
    });
  });

  document.getElementById("cancel-btn").addEventListener("click", () => {
    const dashboardTab = document.querySelector('[data-view="dashboard"]');
    if (dashboardTab) dashboardTab.click();
  });
}

async function synchronizeSystemMetricsData() {
  try {
    let searchValue = "";
    if (globalSearch && globalSearch.value.trim()) {
      searchValue = globalSearch.value.trim();
    } else if (directorySearch && directorySearch.value.trim()) {
      searchValue = directorySearch.value.trim();
    }
    
    const queryParamsUrlString = new URLSearchParams({
      search: searchValue,
      department: filterDept ? filterDept.value : "",
      year: filterYear ? filterYear.value : "",
      minGPA: filterGpa ? filterGpa.value : "",
      sortBy: filterSort ? filterSort.value : ""
    }).toString();

    const response = await fetch(`${API}?${queryParamsUrlString}`);
    if (!response.ok) throw new Error("Could not pull data pack from server.");
    const dataPack = await response.json();

    if (dataPack.stats) {
      if (totalCountEl) totalCountEl.innerText = dataPack.stats.totalCount;
      if (avgGpaEl) avgGpaEl.innerText = Number(dataPack.stats.avgGpa || 0).toFixed(2);
      if (avgAttendanceEl) avgAttendanceEl.innerText = `${Number(dataPack.stats.avgAttendance || 0).toFixed(1)}%`;
    }

    renderDirectoryTableGridElements(dataPack.studentsList || []);
    renderRecentRegistrationsDashboardViewGrid(dataPack.allStudentsRaw ? dataPack.allStudentsRaw.slice(0, 5) : []);

    initializeOrRebuildAnalyticsChartsContexts(dataPack.deptDistribution || [], dataPack.allStudentsRaw || []);
  } catch (error) {
    emitSystemMicroToastNotification(error.message, "error");
  }
}

function setupFilterInputEventBindings() {
  const filterInputsArray = [globalSearch, directorySearch, filterDept, filterYear, filterGpa, filterSort];
  filterInputsArray.forEach(inputElement => {
    if (inputElement) {
      inputElement.addEventListener("input", synchronizeSystemMetricsData);
    }
  });
}

function renderDirectoryTableGridElements(dataset) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!dataset.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No records match parameters.</td></tr>`;
    return;
  }

  dataset.forEach(student => {
    const rowElementNode = document.createElement("tr");
    const parsedGpa = Number(student.gpa || 0);
    const gpaClass = parsedGpa >= 8.5 ? "gpa-high" : (parsedGpa < 6.5 ? "gpa-low" : "gpa-mid");

    rowElementNode.innerHTML = `
      <td><strong>${student.rollNo}</strong></td>
      <td>${student.name}</td>
      <td><span class="dept-tag">${student.department}</span></td>
      <td>Year ${student.year}</td>
      <td><span class="gpa-badge ${gpaClass}">${parsedGpa.toFixed(2)}</span></td>
      <td>${student.attendance}%</td>
      <td><a href="mailto:${student.email}" style="color:var(--accent);text-decoration:none;">${student.email}</a></td>
      <td>
        <div style="display:flex;gap:0.5rem;">
          ${student.photoUrl ? `<a href="${student.photoUrl}" target="_blank" style="text-decoration:none;">🖼️</a>` : "—"}
          ${student.docUrl ? `<a href="${student.docUrl}" target="_blank" style="text-decoration:none;">📁</a>` : ""}
        </div>
      </td>
      <td>
        <div class="action-btns">
          <button onclick="prepareProfileEditingContext('${student._id}')" style="background:var(--accent-dim);color:var(--accent);border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-weight:600;">Edit</button>
          <button onclick="displayPurgeConfirmationModal('${student._id}')" style="background:var(--red-dim);color:var(--red);border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-weight:600;">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(rowElementNode);
  });
}

function renderRecentRegistrationsDashboardViewGrid(recentDatasetArray) {
  if (!recentTbody) return;
  recentTbody.innerHTML = "";
  if (!recentDatasetArray || !recentDatasetArray.length) {
    recentTbody.innerHTML = `<tr><td colspan="5" class="empty-row">No records found.</td></tr>`;
    return;
  }
  
  recentDatasetArray.forEach(student => {
    const row = document.createElement("tr");
    const rawAttendance = student.attendance !== undefined ? student.attendance : 
                          (student.Attendance !== undefined ? student.Attendance : 
                          (student.attendanceRate !== undefined ? student.attendanceRate : null));
    
    const displayAttendance = rawAttendance !== null ? Number(rawAttendance).toFixed(1) : "0.0";
    const displayGpa = Number(student.gpa || 0).toFixed(2);

    row.innerHTML = `
      <td>${student.rollNo || "—"}</td>
      <td><strong>${student.name || "Unknown"}</strong></td>
      <td><span class="dept-tag">${student.department || "—"}</span></td>
      <td>${displayGpa}</td>
      <td>${displayAttendance}%</td>
    `;
    recentTbody.appendChild(row);
  });
}

function initializeOrRebuildAnalyticsChartsContexts(deptDistribution, rawTrends) {
  const chart1El = document.getElementById("deptDistributionChart");
  const chart2El = document.getElementById("performanceTrendChart");
  if (!chart1El || !chart2El) return;

  if (chartInstances.dept) chartInstances.dept.destroy();
  if (chartInstances.trends) chartInstances.trends.destroy();

  const deptLabels = deptDistribution.map(d => d._id || "Unknown");
  const deptCounts = deptDistribution.map(d => d.count);

  chartInstances.dept = new Chart(chart1El.getContext("2d"), {
    type: "bar",
    data: {
      labels: deptLabels,
      datasets: [{ label: "Students", data: deptCounts, backgroundColor: "#7c6af7", borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } } }
    }
  });

  const trendPoints = rawTrends.map(s => ({ x: s.attendance, y: s.gpa }));
  chartInstances.trends = new Chart(chart2El.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [{ label: "Attendance vs GPA", data: trendPoints, backgroundColor: "#3ecf8e" }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Attendance %" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { title: { display: true, text: "GPA" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
   if (!form.checkValidity()) {
    console.error("Form is invalid! Check these fields:");
    const invalidFields = form.querySelectorAll(':invalid');
    invalidFields.forEach(f => console.error("Invalid field:", f.id));
    return; 
  }

  const dataObj = {
    rollNo: document.getElementById("f-roll").value.trim(),
    name: document.getElementById("f-name").value.trim(),
    email: document.getElementById("f-email").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    department: document.getElementById("f-dept").value,
    year: parseInt(document.getElementById("f-year").value),
    gpa: parseFloat(document.getElementById("f-gpa").value),
    attendance: parseFloat(document.getElementById("f-attendance").value),
    dob: document.getElementById("f-dob").value || null,
    address: document.getElementById("f-address").value.trim(),
    photoUrl: document.getElementById("f-photo-url").value.trim() || null,
    docUrl: document.getElementById("f-doc-url").value.trim() || null
  };

  const editId = document.getElementById("edit-id").value;
  const url = editId ? `${API}/${editId}` : API;
  const method = editId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataObj)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Database update failed.");
    }

    emitSystemMicroToastNotification("Student saved successfully!", "success");
    form.reset();
    document.getElementById("edit-id").value = "";

    await synchronizeSystemMetricsData();
    
    const dashboardTab = document.querySelector('[data-view="dashboard"]');
    if (dashboardTab) dashboardTab.click();
    
  } catch (err) {
    console.error("Save error:", err);
    emitSystemMicroToastNotification(err.message, "error");
  }
});

window.prepareProfileEditingContext = async function(id) {
  try {
    const response = await fetch(`${API}/${id}`);
    if (!response.ok) throw new Error("Could not fetch student data.");
    const student = await response.json();

    document.getElementById("edit-id").value = student._id || "";
    document.getElementById("f-roll").value = student.rollNo || "";
    document.getElementById("f-name").value = student.name || "";
    document.getElementById("f-email").value = student.email || "";
    document.getElementById("f-phone").value = student.phone || "";
    document.getElementById("f-dept").value = student.department || "";
    document.getElementById("f-year").value = student.year || "";
    document.getElementById("f-gpa").value = student.gpa || "";
    document.getElementById("f-attendance").value = student.attendance || "";
    document.getElementById("f-dob").value = student.dob ? student.dob.split('T')[0] : ""; 
    document.getElementById("f-address").value = student.address || "";
    document.getElementById("f-photo-url").value = student.photoUrl || "";
    document.getElementById("f-doc-url").value = student.docUrl || "";
    document.getElementById("form-title").innerText = "Modify Student Configuration";
    document.querySelectorAll(".view").forEach(v => { v.hidden = true; v.classList.remove("active"); });
    
    const addView = document.getElementById("view-add");
    if (addView) {
        addView.hidden = false;
        addView.classList.add("active");
    }
  } catch (error) {
    console.error("Edit load error:", error);
    emitSystemMicroToastNotification("Error loading profile.", "error");
  }
};

window.displayPurgeConfirmationModal = function(id) {
  targetDeletionId = id; // Ensure this global variable is set
  if (modalOverlay) {
    modalOverlay.hidden = false;
    modalOverlay.style.display = "flex";
  }
};

if (modalCancelBtn) {
  modalCancelBtn.addEventListener("click", () => {
    if (modalOverlay) {
      modalOverlay.hidden = true;
      modalOverlay.style.display = "none";
    }
    targetDeletionId = null;
  });
}

if (modalConfirmBtn) {
  modalConfirmBtn.addEventListener("click", async () => {
    if (!targetDeletionId) return;
    try {
      const response = await fetch(`${API}/${targetDeletionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed.");

      emitSystemMicroToastNotification("Record deleted successfully.", "success");
      
      if (modalOverlay) {
        modalOverlay.hidden = true;
        modalOverlay.style.display = "none";
      }

      await synchronizeSystemMetricsData();
      targetDeletionId = null; 
    } catch (err) {
      emitSystemMicroToastNotification(err.message, "error");
    }
  });
}

function setupFileStreamingExportTriggers() {
  const excelBtn = document.getElementById("export-excel-btn");
  const pdfBtn = document.getElementById("export-pdf-btn");
  
  if (excelBtn) excelBtn.addEventListener("click", () => window.open(`${API}/export/excel`, "_blank"));
  if (pdfBtn) pdfBtn.addEventListener("click", () => window.open(`${API}/export/pdf`, "_blank"));
}

function emitSystemMicroToastNotification(messageContentString, systemToastNotificationThemeGroupType = "success") {
  const toastPlacementFrameTargetBoxElement = document.getElementById("toast-container");
  if (!toastPlacementFrameTargetBoxElement) return;
  
  const notificationToastWrapperBoxNodeItemEl = document.createElement("div");
  notificationToastWrapperBoxNodeItemEl.className = `toast ${systemToastNotificationThemeGroupType}`;
  notificationToastWrapperBoxNodeItemEl.innerText = messageContentString;
  
  toastPlacementFrameTargetBoxElement.appendChild(notificationToastWrapperBoxNodeItemEl);
  
  setTimeout(() => {
    notificationToastWrapperBoxNodeItemEl.style.opacity = "0";
    setTimeout(() => notificationToastWrapperBoxNodeItemEl.remove(), 400);
  }, 4000);
}