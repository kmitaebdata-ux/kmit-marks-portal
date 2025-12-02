// ================== ADMIN.JS (Firebase v8 compat) ==================
console.log("Admin panel JS loaded");

// TODO: PUT YOUR REAL CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyC1Aa_mnq_0g7ZEuLbYVjN62iCMWemlKUc",
  authDomain: "kmit-marks-portal-9db76.firebaseapp.com",
  projectId: "kmit-marks-portal-9db76",
  storageBucket: "kmit-marks-portal-9db76.firebasestorage.app",
  messagingSenderId: "264909025742",
  appId: "1:264909025742:web:84de5216860219e6bc3b9f",
  measurementId: "G-JMZ564P8PJ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// DOM references
const navLinks    = document.querySelectorAll('.nav-link');
const contentArea = document.getElementById('contentArea');
const pageTitle   = document.getElementById('pageTitle');
const logoutBtn   = document.getElementById('logoutBtn');
const noticeBoard = document.getElementById('noticeBoard');
const topNotice   = document.getElementById('topNotice');
const adminEmail  = document.getElementById('adminEmail');
const adminRoleEl = document.getElementById('adminRole');

// ========== AUTH GUARD ==========
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Session expired. Please login again.");
    window.location.href = "index.html"; // change to your login page
    return;
  }

  adminEmail.textContent = user.email || "(no email)";

  try {
    // Check role from "roles" collection
    // AUTO-CREATE ADMIN ROLE IF MISSING
const roleRef = db.collection("roles").doc(user.uid);
let roleSnap = await roleRef.get();

if (!roleSnap.exists) {
  console.warn("No role found — creating ADMIN role automatically.");
  await roleRef.set({
    role: "ADMIN",
    email: user.email || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  roleSnap = await roleRef.get();
}

const role = (roleSnap.data().role || "").toUpperCase();
adminRoleEl.textContent = `Role: ${role}`;

if (role !== "ADMIN") {
  topNotice.textContent = "Access denied: You are not an ADMIN.";
  contentArea.innerHTML = `
    <div class="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      Your account does not have admin privileges.
    </div>`;
  return;
}

    adminRoleEl.textContent = `Role: ${role || "UNKNOWN"}`;

    if (role !== "ADMIN") {
      topNotice.textContent = "Access denied: You are not an ADMIN.";
      contentArea.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        Your account does not have admin privileges. Contact Exam Branch.
      </div>`;
      // Optionally sign out:
      // await auth.signOut();
      return;
    }

    // If admin, load default page
    attachNavHandlers();
    await loadNoticeTicker();
    await loadPage("overview");

  } catch (err) {
    console.error("Error checking admin role:", err);
    alert("Error verifying admin access. Check console.");
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await auth.signOut();
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    alert("Logout failed. Check console.");
  }
});

// ========== NAVIGATION ==========
function attachNavHandlers() {
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const page = link.dataset.page;
      loadPage(page);
    });
  });
}

async function loadPage(page) {
  pageTitle.textContent = formatTitle(page);
  contentArea.innerHTML = `<div class="text-gray-500">Loading ${page}...</div>`;

  try {
    switch (page) {
      case "overview":      await renderOverview(); break;
      case "students":      renderStudentsPage();   break;
      case "faculty":       renderFacultyPage();    break;
      case "subjects":      renderSubjectsPage();   break;
      case "assignments":   renderAssignmentsPage(); break;
      case "marks":         renderMarksPage();      break;
      case "roles":         renderRolesPage();      break;
      case "notices":       renderNoticesPage();    break;
      default:
        contentArea.innerHTML = `<div class="text-red-500">Unknown page: ${page}</div>`;
    }
  } catch (err) {
    console.error("Error loading page", page, err);
    contentArea.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      Error loading <b>${page}</b>. Check console.
    </div>`;
  }
}

function formatTitle(page) {
  return page
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ========== OVERVIEW ==========
async function renderOverview() {
  const cardsHtml = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" id="overviewCards">
      <div class="bg-white rounded shadow p-4">
        <div class="text-xs text-gray-500">Total Students</div>
        <div id="ovStudents" class="text-2xl font-bold mt-1">–</div>
      </div>
      <div class="bg-white rounded shadow p-4">
        <div class="text-xs text-gray-500">Total Faculty</div>
        <div id="ovFaculty" class="text-2xl font-bold mt-1">–</div>
      </div>
      <div class="bg-white rounded shadow p-4">
        <div class="text-xs text-gray-500">Subjects Offered</div>
        <div id="ovSubjects" class="text-2xl font-bold mt-1">–</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded shadow p-4">
        <div class="text-sm font-semibold mb-2">Marks Summary</div>
        <div id="ovMarks" class="text-gray-600 text-sm">Loading...</div>
      </div>
      <div class="bg-white rounded shadow p-4">
        <div class="text-sm font-semibold mb-2">Latest Notices</div>
        <ul id="ovNotices" class="text-xs text-gray-600 space-y-1"></ul>
      </div>
    </div>
  `;
  contentArea.innerHTML = cardsHtml;

  // Fetch counts
  const [studSnap, facSnap, subSnap, marksSnap, noticesSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("faculty").get(),
    db.collection("subjects").get(),
    db.collection("marks").limit(5).get(),
    db.collection("notices").orderBy("createdAt", "desc").limit(5).get()
  ]);

  document.getElementById("ovStudents").textContent = studSnap.size;
  document.getElementById("ovFaculty").textContent  = facSnap.size;
  document.getElementById("ovSubjects").textContent = subSnap.size;

  const ovMarks = document.getElementById("ovMarks");
  if (marksSnap.empty) {
    ovMarks.textContent = "No marks uploaded yet.";
  } else {
    ovMarks.textContent = `Recent marks entries: ${marksSnap.size} (showing last ${marksSnap.size}).`;
  }

  const ovNotices = document.getElementById("ovNotices");
  if (noticesSnap.empty) {
    ovNotices.innerHTML = `<li>No active notices.</li>`;
  } else {
    let html = "";
    noticesSnap.forEach(doc => {
      const n = doc.data();
      const text = n.title || n.message || "(no title)";
      html += `<li>• ${text}</li>`;
    });
    ovNotices.innerHTML = html;
  }
}

// ========== SMALL HELPERS ==========
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || "").trim();
    });
    records.push(obj);
  }
  return records;
}

// ================== STUDENTS PAGE ==================
function renderStudentsPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4 mb-4">
      <h3 class="font-semibold mb-2">Add Single Student</h3>
      <form id="studentForm" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <input required name="roll" class="border px-2 py-1 rounded" placeholder="Roll (e.g., 21BD1A0501)">
        <input required name="name" class="border px-2 py-1 rounded" placeholder="Name">
        <input required name="branch" class="border px-2 py-1 rounded" placeholder="Branch (e.g., CSE)">
        <input required name="semester" class="border px-2 py-1 rounded" placeholder="Semester (e.g., 3)">
        <input required name="section" class="border px-2 py-1 rounded" placeholder="Section (e.g., A)">
        <input name="phone" class="border px-2 py-1 rounded" placeholder="Phone">
        <input name="email" class="border px-2 py-1 rounded md:col-span-2" placeholder="Email">
        <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs mt-1 md:col-span-1">Save Student</button>
      </form>
      <div id="studentFormMsg" class="text-xs mt-2"></div>
    </div>

    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Students (CSV)</h3>
      <p class="text-xs text-gray-600 mb-2">Headers required:
        <code>roll,name,branch,semester,section,phone,email</code>
      </p>
      <input id="studentCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadStudentsBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="studentCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const form = document.getElementById("studentForm");
  const formMsg = document.getElementById("studentFormMsg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await db.collection("students").doc(data.roll).set({
        name: data.name,
        branch: data.branch,
        semester: data.semester,
        section: data.section,
        phone: data.phone || "",
        email: data.email || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      formMsg.textContent = "Student saved.";
      form.reset();
    } catch (err) {
      console.error(err);
      formMsg.textContent = "Error saving student.";
    }
  });

  const fileInput = document.getElementById("studentCsv");
  const uploadBtn = document.getElementById("uploadStudentsBtn");
  const csvMsg = document.getElementById("studentCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "students",
    transform: (r) => ({
      roll: r.roll,
      name: r.name,
      branch: r.branch,
      semester: r.semester,
      section: r.section,
      phone: r.phone || "",
      email: r.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => r.roll
  }));
}

// ================== FACULTY PAGE ==================
function renderFacultyPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4 mb-4">
      <h3 class="font-semibold mb-2">Add Single Faculty</h3>
      <form id="facultyForm" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <input required name="facultyId" class="border px-2 py-1 rounded" placeholder="Faculty ID">
        <input required name="name" class="border px-2 py-1 rounded" placeholder="Name">
        <input required name="branch" class="border px-2 py-1 rounded" placeholder="Branch">
        <input name="phone" class="border px-2 py-1 rounded" placeholder="Phone">
        <input name="email" class="border px-2 py-1 rounded md:col-span-2" placeholder="Email">
        <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs mt-1 md:col-span-1">Save Faculty</button>
      </form>
      <div id="facultyFormMsg" class="text-xs mt-2"></div>
    </div>

    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Faculty (CSV)</h3>
      <p class="text-xs text-gray-600 mb-2">
        Headers: <code>facultyId,name,branch,phone,email</code>
      </p>
      <input id="facultyCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadFacultyBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="facultyCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const form = document.getElementById("facultyForm");
  const formMsg = document.getElementById("facultyFormMsg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await db.collection("faculty").doc(data.facultyId).set({
        name: data.name,
        branch: data.branch,
        phone: data.phone || "",
        email: data.email || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      formMsg.textContent = "Faculty saved.";
      form.reset();
    } catch (err) {
      console.error(err);
      formMsg.textContent = "Error saving faculty.";
    }
  });

  const fileInput = document.getElementById("facultyCsv");
  const uploadBtn = document.getElementById("uploadFacultyBtn");
  const csvMsg = document.getElementById("facultyCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "faculty",
    transform: (r) => ({
      facultyId: r.facultyId,
      name: r.name,
      branch: r.branch,
      phone: r.phone || "",
      email: r.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => r.facultyId
  }));
}

// ================== SUBJECTS PAGE ==================
function renderSubjectsPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Subjects</h3>
      <p class="text-xs text-gray-600 mb-2">
        Headers:
        <code>subjectCode,subjectName,semester,branch,credits,subjectType</code>
      </p>
      <input id="subjectCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadSubjectsBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="subjectCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const fileInput = document.getElementById("subjectCsv");
  const uploadBtn = document.getElementById("uploadSubjectsBtn");
  const csvMsg = document.getElementById("subjectCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "subjects",
    transform: (r) => ({
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      semester: r.semester,
      branch: r.branch,
      credits: r.credits,
      subjectType: r.subjectType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => r.subjectCode
  }));
}

// ================== ASSIGNMENTS PAGE ==================
function renderAssignmentsPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Faculty–Subject Assignments</h3>
      <p class="text-xs text-gray-600 mb-2">
        Headers:
        <code>facultyId,facultyName,subjectCode,subjectName,semester,branch,section</code>
      </p>
      <input id="assignCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadAssignBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="assignCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const fileInput = document.getElementById("assignCsv");
  const uploadBtn = document.getElementById("uploadAssignBtn");
  const csvMsg = document.getElementById("assignCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "facultyAssignments",
    transform: (r) => ({
      facultyId: r.facultyId,
      facultyName: r.facultyName,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      semester: r.semester,
      branch: r.branch,
      section: r.section,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => `${r.facultyId}_${r.subjectCode}_${r.section}`
  }));
}

// ================== MARKS PAGE ==================
function renderMarksPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Marks</h3>
      <p class="text-xs text-gray-600 mb-2">
        Headers:
        <code>roll,subjectCode,subjectName,internalMarks,externalMarks,totalMarks,semester,branch,examType</code>
      </p>
      <input id="marksCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadMarksBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="marksCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const fileInput = document.getElementById("marksCsv");
  const uploadBtn = document.getElementById("uploadMarksBtn");
  const csvMsg = document.getElementById("marksCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "marks",
    transform: (r) => ({
      roll: r.roll,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      internalMarks: Number(r.internalMarks || 0),
      externalMarks: Number(r.externalMarks || 0),
      totalMarks: Number(r.totalMarks || 0),
      semester: r.semester,
      branch: r.branch,
      examType: r.examType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => `${r.roll}_${r.subjectCode}_${r.examType}`
  }));
}

// ================== ROLES PAGE ==================
function renderRolesPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4 mb-4">
      <h3 class="font-semibold mb-2">Assign Role to User</h3>
      <form id="roleForm" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <input required name="uid" class="border px-2 py-1 rounded" placeholder="Firebase UID">
        <input required name="email" class="border px-2 py-1 rounded" placeholder="User Email (info only)">
        <select required name="role" class="border px-2 py-1 rounded">
          <option value="ADMIN">ADMIN</option>
          <option value="FACULTY">FACULTY</option>
          <option value="STUDENT">STUDENT</option>
        </select>
        <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs mt-1 md:col-span-1">Save Role</button>
      </form>
      <div id="roleFormMsg" class="text-xs mt-2"></div>
      <p class="text-[11px] text-gray-500 mt-2">
        This writes into <code>roles</code> collection. If you also use Cloud Functions
        to set custom claims, trigger that function separately.
      </p>
    </div>

    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Bulk Upload Roles (CSV)</h3>
      <p class="text-xs text-gray-600 mb-2">
        Headers: <code>uid,role</code> (role = ADMIN/FACULTY/STUDENT)
      </p>
      <input id="rolesCsv" type="file" accept=".csv" class="text-xs mb-2">
      <button id="uploadRolesBtn"
              class="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
              disabled>Upload</button>
      <div id="rolesCsvMsg" class="text-xs mt-2"></div>
    </div>
  `;

  const form = document.getElementById("roleForm");
  const formMsg = document.getElementById("roleFormMsg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving role...";
    const data = Object.fromEntries(new FormData(form).entries());
    const role = data.role.toUpperCase();
    try {
      await db.collection("roles").doc(data.uid).set({
        role,
        email: data.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      formMsg.textContent = "Role saved.";
      form.reset();
    } catch (err) {
      console.error(err);
      formMsg.textContent = "Error saving role.";
    }
  });

  const fileInput = document.getElementById("rolesCsv");
  const uploadBtn = document.getElementById("uploadRolesBtn");
  const csvMsg = document.getElementById("rolesCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => handleCsvUpload({
    fileInput,
    msgEl: csvMsg,
    collection: "roles",
    transform: (r) => ({
      role: (r.role || "").toUpperCase(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    docId: (r) => r.uid
  }));
}

// ================== NOTICES PAGE ==================
function renderNoticesPage() {
  contentArea.innerHTML = `
    <div class="bg-white rounded shadow p-4 mb-4">
      <h3 class="font-semibold mb-2">Create Notice</h3>
      <form id="noticeForm" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <input required name="title" class="border px-2 py-1 rounded md:col-span-2" placeholder="Title">
        <select name="active" class="border px-2 py-1 rounded">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <textarea name="message" rows="3" class="border px-2 py-1 rounded md:col-span-3"
                  placeholder="Full notice text (optional)"></textarea>
        <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs mt-1 md:col-span-1">Save Notice</button>
      </form>
      <div id="noticeFormMsg" class="text-xs mt-2"></div>
    </div>

    <div class="bg-white rounded shadow p-4">
      <h3 class="font-semibold mb-2">Recent Notices</h3>
      <div id="noticesList" class="text-xs text-gray-700">Loading...</div>
    </div>
  `;

  const form = document.getElementById("noticeForm");
  const formMsg = document.getElementById("noticeFormMsg");
  const listEl  = document.getElementById("noticesList");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving notice...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await db.collection("notices").add({
        title: data.title,
        message: data.message || "",
        active: data.active === "true",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      formMsg.textContent = "Notice saved.";
      form.reset();
      await loadNoticesList(listEl);
      await loadNoticeTicker(); // refresh footer
    } catch (err) {
      console.error(err);
      formMsg.textContent = "Error saving notice.";
    }
  });

  loadNoticesList(listEl);
}

async function loadNoticesList(listEl) {
  const snap = await db.collection("notices")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (snap.empty) {
    listEl.textContent = "No notices yet.";
    return;
  }

  let html = `<ul class="space-y-1">`;
  snap.forEach(doc => {
    const n = doc.data();
    const active = n.active ? "ACTIVE" : "INACTIVE";
    html += `<li class="border-b py-1 flex justify-between">
      <div>
        <div class="font-semibold">${n.title || "(no title)"}</div>
        <div class="text-[11px] text-gray-500">${n.message || ""}</div>
      </div>
      <div class="text-[10px] mt-1 ${n.active ? "text-green-600" : "text-gray-400"}">${active}</div>
    </li>`;
  });
  html += `</ul>`;
  listEl.innerHTML = html;
}

// footer ticker
async function loadNoticeTicker() {
  noticeBoard.innerHTML = "Loading notices...";
  const snap = await db.collection("notices")
    .where("active", "==", true)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  if (snap.empty) {
    noticeBoard.textContent = "No active notices.";
    return;
  }

  let html = "";
  snap.forEach(doc => {
    const n = doc.data();
    html += `<span class="mr-6">• ${n.title || n.message}</span>`;
  });
  noticeBoard.innerHTML = html;
}

// ================== GENERIC CSV HANDLER ==================
function handleCsvUpload({ fileInput, msgEl, collection, transform, docId }) {
  const file = fileInput.files[0];
  if (!file) {
    msgEl.textContent = "Please choose a CSV file.";
    return;
  }
  msgEl.textContent = "Reading file...";

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const records = parseCsv(text);
      if (!records.length) {
        msgEl.textContent = "No valid rows found.";
        return;
      }

      msgEl.textContent = `Uploading ${records.length} rows...`;
      const batchSize = 400; // Firestore batch limit 500
      let processed = 0;

      while (processed < records.length) {
        const batch = db.batch();
        const slice = records.slice(processed, processed + batchSize);
        slice.forEach(r => {
          const data = transform(r);
          const id = docId(r);
          if (!id) return;
          const ref = db.collection(collection).doc(id);
          batch.set(ref, data, { merge: true });
        });
        await batch.commit();
        processed += slice.length;
        msgEl.textContent = `Uploaded ${processed}/${records.length} rows...`;
      }

      msgEl.textContent = `Done. Uploaded ${records.length} rows into "${collection}".`;
      fileInput.value = "";
    } catch (err) {
      console.error(err);
      msgEl.textContent = "Error uploading CSV. Check console.";
    }
  };
  reader.readAsText(file);
}
