// ================== ADMIN.JS (Firebase v9 compat) ==================
// Full Admin Panel Logic + System Maintenance (Spark plan, manual purge only)

console.log("Admin panel JS loaded – full build");

// ---------- FIREBASE INIT ----------
var firebaseConfig = {
  apiKey: "AIzaSyC1Aa_mnq_0g7ZEuLbYVjN62iCMWemlKUc",
  authDomain: "kmit-marks-portal-9db76.firebaseapp.com",
  projectId: "kmit-marks-portal-9db76",
  storageBucket: "kmit-marks-portal-9db76.appspot.com",
  messagingSenderId: "264909025742",
  appId: "1:264909025742:web:84de5216860219e6bc3b9f"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var auth = firebase.auth();
var db   = firebase.firestore();
var functions = firebase.app().functions("asia-south1");

// ---------- DOM REFERENCES ----------
var navLinks    = document.querySelectorAll('.nav-link');
var contentArea = document.getElementById('contentArea');
var pageTitle   = document.getElementById('pageTitle');
var logoutBtn   = document.getElementById('logoutBtn');
var noticeBoard = document.getElementById('noticeBoard');
var topNotice   = document.getElementById('topNotice');
var adminEmail  = document.getElementById('adminEmail');
var adminRoleEl = document.getElementById('adminRole');

// Maintenance modal
var purgeModal      = document.getElementById('purgeModal');
var cancelPurgeBtn  = document.getElementById('cancelPurgeBtn');
var confirmPurgeBtn = document.getElementById('confirmPurgeBtn');

// ======================================================
// AUTH GUARD + ROLE CHECK
// ======================================================
auth.onAuthStateChanged(function(user) {
  if (!user) {
    alert("Session expired. Please login again.");
    window.location.href = "index.html";
    return;
  }

  adminEmail.textContent = user.email || "(no email)";

  db.collection("roles").doc(user.uid).get().then(function(roleSnap) {
    if (!roleSnap.exists) {
      console.warn("No role found – creating ADMIN role automatically for this user.");
      return db.collection("roles").doc(user.uid).set({
        role: "ADMIN",
        email: user.email || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function() {
        return db.collection("roles").doc(user.uid).get();
      });
    }
    return roleSnap;
  }).then(function(roleSnap2) {
    if (!roleSnap2) return;
    var role = (roleSnap2.data().role || "").toUpperCase();
    adminRoleEl.textContent = "Role: " + role;

    if (role !== "ADMIN") {
      topNotice.textContent = "Access denied: You are not an ADMIN.";
      contentArea.innerHTML = "" +
        "<div class=\"panel-card border border-red-400/40 bg-red-900/20 text-sm text-red-100\">" +
        "Your account does not have admin privileges. Please contact Exam Branch." +
        "</div>";
      return;
    }

    attachNavHandlers();
    loadNoticeTicker();
    loadPage("overview");
  }).catch(function(err) {
    console.error("Error checking admin role:", err);
    alert("Error verifying admin access. Check console.");
  });
});

// ---------- LOGOUT ----------
if (logoutBtn) {
  logoutBtn.addEventListener('click', function() {
    auth.signOut().then(function() {
      window.location.href = "index.html";
    }).catch(function(err) {
      console.error(err);
      alert("Logout failed. Check console.");
    });
  });
}

// ======================================================
// NAVIGATION
// ======================================================
function attachNavHandlers() {
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      var page = link.dataset.page;
      loadPage(page);
    });
  });
}

function loadPage(page) {
  if (!contentArea) return;
  pageTitle.textContent = formatTitle(page);
  contentArea.innerHTML = "<div class='text-slate-300'>Loading " + page + "...</div>";

  try {
    if (page === "overview") {
      renderOverview();
    } else if (page === "students") {
      renderStudentsPage();
    } else if (page === "faculty") {
      renderFacultyPage();
    } else if (page === "subjects") {
      renderSubjectsPage();
    } else if (page === "assignments") {
      renderAssignmentsPage();
    } else if (page === "marks") {
      renderMarksPage();
    } else if (page === "roles") {
      renderRolesPage();
    } else if (page === "notices") {
      renderNoticesPage();
    } else if (page === "maintenance") {
      renderMaintenancePage();
    } else {
      contentArea.innerHTML = "<div class='text-red-400'>Unknown page: " + page + "</div>";
    }
  } catch (e) {
    console.error("Error loading page", page, e);
    contentArea.innerHTML = "" +
      "<div class=\"panel-card border border-red-500/40 bg-red-900/30 text-sm text-red-100\">" +
      "Error loading <b>" + page + "</b>. Check console." +
      "</div>";
  }
}

function formatTitle(page) {
  return page.split(/[-_]/).map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

// ======================================================
// FOOTER NOTICE TICKER
// ======================================================
function loadNoticeTicker() {
  if (!noticeBoard) return;
  noticeBoard.innerHTML = "Loading notices...";

  db.collection("notices")
    .where("active", "==", true)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        noticeBoard.textContent = "No active notices.";
        return;
      }
      var html = "";
      snap.forEach(function(doc) {
        var n = doc.data();
        var text = n.title || n.message || "Notice";
        html += "<span class='mr-6'>• " + text + "</span>";
      });
      noticeBoard.innerHTML = html;
    }).catch(function(err) {
      console.error("Notice ticker error", err);
      noticeBoard.textContent = "Unable to load notices.";
    });
}

// ======================================================
// CSV HELPERS
// ======================================================
function parseCsv(text) {
  var lines = text.split(/
?
/).filter(function(l) { return l.trim() !== ""; });
  if (lines.length < 2) return [];
  var headers = lines[0].split(",").map(function(h) { return h.trim(); });
  var records = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    var obj = {};
    headers.forEach(function(h, idx) {
      obj[h] = (cols[idx] || "").trim();
    });
    records.push(obj);
  }
  return records;
}

function handleCsvUpload(opts) {
  var fileInput = opts.fileInput;
  var msgEl = opts.msgEl;
  var collection = opts.collection;
  var transform = opts.transform;
  var docId = opts.docId;

  var file = fileInput.files[0];
  if (!file) {
    msgEl.textContent = "Please choose a CSV file.";
    msgEl.className = "text-xs text-red-300 mt-2";
    return;
  }
  msgEl.className = "text-xs text-slate-200 mt-2";
  msgEl.textContent = "Reading file...";

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var text = e.target.result;
      var records = parseCsv(text);
      if (!records.length) {
        msgEl.textContent = "No valid rows found.";
        return;
      }

      msgEl.textContent = "Uploading " + records.length + " rows...";
      var batchSize = 400;
      var processed = 0;

      function runBatch() {
        if (processed >= records.length) {
          msgEl.textContent = "Done. Uploaded " + records.length + " rows into \"" + collection + "\".";
          fileInput.value = "";
          return;
        }
        var batch = db.batch();
        var slice = records.slice(processed, processed + batchSize);
        slice.forEach(function(r) {
          var data = transform(r);
          var id = docId(r);
          if (!id) return;
          var ref = db.collection(collection).doc(id);
          batch.set(ref, data, { merge: true });
        });
        batch.commit().then(function() {
          processed += slice.length;
          msgEl.textContent = "Uploaded " + processed + "/" + records.length + " rows...";
          runBatch();
        }).catch(function(err) {
          console.error(err);
          msgEl.textContent = "Error uploading CSV. Check console.";
          msgEl.className = "text-xs text-red-300 mt-2";
        });
      }

      runBatch();
    } catch (err) {
      console.error(err);
      msgEl.textContent = "Error uploading CSV. Check console.";
      msgEl.className = "text-xs text-red-300 mt-2";
    }
  };
  reader.readAsText(file);
}

// ======================================================
// STUDENTS PAGE
// ======================================================
function renderStudentsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Add Single Student</h3>" +
    "  <form id=\"studentForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"roll\" class=\"input\" placeholder=\"Roll (e.g., 21BD1A0501)\">" +
    "    <input required name=\"name\" class=\"input\" placeholder=\"Name\">" +
    "    <input required name=\"branch\" class=\"input\" placeholder=\"Branch (e.g., CSE)\">" +
    "    <input required name=\"semester\" class=\"input\" placeholder=\"Semester (e.g., 3)\">" +
    "    <input required name=\"section\" class=\"input\" placeholder=\"Section (e.g., A)\">" +
    "    <input name=\"phone\" class=\"input\" placeholder=\"Phone\">" +
    "    <input name=\"email\" class=\"input md:col-span-2\" placeholder=\"Email\">" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Student</button>" +
    "  </form>" +
    "  <div id=\"studentFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Students (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers required: <code>roll,name,branch,semester,section,phone,email</code>" +
    "  </p>" +
    "  <input id=\"studentCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadStudentsBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"studentCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("studentForm");
  var formMsg = document.getElementById("studentFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    var data = Object.fromEntries(new FormData(form).entries());
    db.collection("students").doc(data.roll).set({
      roll: data.roll,
      name: data.name,
      branch: data.branch,
      semester: data.semester,
      section: data.section,
      phone: data.phone || "",
      email: data.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      formMsg.textContent = "Student saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving student.";
    });
  });

  var fileInput = document.getElementById("studentCsv");
  var uploadBtn = document.getElementById("uploadStudentsBtn");
  var csvMsg = document.getElementById("studentCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "students",
      transform: function(r) {
        return {
          roll: r.roll,
          name: r.name,
          branch: r.branch,
          semester: r.semester,
          section: r.section,
          phone: r.phone || "",
          email: r.email || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.roll; }
    });
  });
}

// ======================================================
// FACULTY PAGE
// ======================================================
function renderFacultyPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Add Single Faculty</h3>" +
    "  <form id=\"facultyForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"facultyId\" class=\"input\" placeholder=\"Faculty ID (use UID or custom)\">" +
    "    <input required name=\"name\" class=\"input\" placeholder=\"Name\">" +
    "    <input required name=\"branch\" class=\"input\" placeholder=\"Branch\">" +
    "    <input name=\"phone\" class=\"input\" placeholder=\"Phone\">" +
    "    <input name=\"email\" class=\"input md:col-span-2\" placeholder=\"Email\">" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Faculty</button>" +
    "  </form>" +
    "  <div id=\"facultyFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Faculty (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">Headers: <code>facultyId,name,branch,phone,email</code></p>" +
    "  <input id=\"facultyCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadFacultyBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"facultyCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("facultyForm");
  var formMsg = document.getElementById("facultyFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    var data = Object.fromEntries(new FormData(form).entries());
    db.collection("faculty").doc(data.facultyId).set({
      facultyId: data.facultyId,
      name: data.name,
      branch: data.branch,
      phone: data.phone || "",
      email: data.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      formMsg.textContent = "Faculty saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving faculty.";
    });
  });

  var fileInput = document.getElementById("facultyCsv");
  var uploadBtn = document.getElementById("uploadFacultyBtn");
  var csvMsg = document.getElementById("facultyCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "faculty",
      transform: function(r) {
        return {
          facultyId: r.facultyId,
          name: r.name,
          branch: r.branch,
          phone: r.phone || "",
          email: r.email || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.facultyId; }
    });
  });
}

// ======================================================
// SUBJECTS PAGE
// ======================================================
function renderSubjectsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Subjects</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>subjectCode,subjectName,semester,branch,credits,subjectType</code>" +
    "  </p>" +
    "  <input id=\"subjectCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadSubjectsBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"subjectCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("subjectCsv");
  var uploadBtn = document.getElementById("uploadSubjectsBtn");
  var csvMsg = document.getElementById("subjectCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "subjects",
      transform: function(r) {
        return {
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          semester: r.semester,
          branch: r.branch,
          credits: r.credits,
          subjectType: r.subjectType,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.subjectCode; }
    });
  });
}

// ======================================================
// FACULTY–SUBJECT ASSIGNMENTS PAGE
// ======================================================
function renderAssignmentsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Faculty–Subject Assignments</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>facultyId,facultyName,subjectCode,subjectName,semester,branch,section</code>" +
    "  </p>" +
    "  <input id=\"assignCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadAssignBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"assignCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("assignCsv");
  var uploadBtn = document.getElementById("uploadAssignBtn");
  var csvMsg = document.getElementById("assignCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "facultyAssignments",
      transform: function(r) {
        return {
          facultyId: r.facultyId,
          facultyName: r.facultyName,
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          semester: r.semester,
          branch: r.branch,
          section: r.section,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.facultyId + "_" + r.subjectCode + "_" + r.section; }
    });
  });
}

// ======================================================
// MARKS PAGE
// ======================================================
function renderMarksPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Marks</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>roll,subjectCode,subjectName,internalMarks,externalMarks,totalMarks,semester,branch,section,examType</code>" +
    "  </p>" +
    "  <input id=\"marksCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadMarksBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"marksCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("marksCsv");
  var uploadBtn = document.getElementById("uploadMarksBtn");
  var csvMsg = document.getElementById("marksCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "marks",
      transform: function(r) {
        return {
          roll: r.roll,
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          internalMarks: Number(r.internalMarks || 0),
          externalMarks: Number(r.externalMarks || 0),
          totalMarks: Number(r.totalMarks || 0),
          semester: r.semester,
          branch: r.branch,
          section: r.section,
          examType: r.examType || "REGULAR",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.roll + "_" + r.subjectCode + "_" + (r.examType || "REGULAR"); }
    });
  });
}

// ======================================================
// ROLES PAGE
// ======================================================
function renderRolesPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Assign Role to User</h3>" +
    "  <form id=\"roleForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"uid\" class=\"input\" placeholder=\"Firebase UID\">" +
    "    <input required name=\"email\" class=\"input\" placeholder=\"User Email (info only)\">" +
    "    <select required name=\"role\" class=\"input\">" +
    "      <option value=\"ADMIN\">ADMIN</option>" +
    "      <option value=\"FACULTY\">FACULTY</option>" +
    "      <option value=\"STUDENT\">STUDENT</option>" +
    "    </select>" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Role</button>" +
    "  </form>" +
    "  <div id=\"roleFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "  <p class=\"text-[11px] text-slate-400 mt-2\">This writes into <code>roles</code> collection.</p>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Roles (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">Headers: <code>uid,role</code></p>" +
    "  <input id=\"rolesCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadRolesBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"rolesCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("roleForm");
  var formMsg = document.getElementById("roleFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving role...";
    var data = Object.fromEntries(new FormData(form).entries());
    var role = (data.role || "").toUpperCase();
    db.collection("roles").doc(data.uid).set({
      role: role,
      email: data.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      formMsg.textContent = "Role saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving role.";
    });
  });

  var fileInput = document.getElementById("rolesCsv");
  var uploadBtn = document.getElementById("uploadRolesBtn");
  var csvMsg = document.getElementById("rolesCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "roles",
      transform: function(r) {
        return {
          role: (r.role || "").toUpperCase(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
      },
      docId: function(r) { return r.uid; }
    });
  });
}

// ======================================================
// NOTICES PAGE
// ======================================================
function renderNoticesPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Create Notice</h3>" +
    "  <form id=\"noticeForm\" class=\"grid grid-cols-1 md:grid-cols-3 gap-3 text-xs\">" +
    "    <input required name=\"title\" class=\"input md:col-span-2\" placeholder=\"Title\">" +
    "    <select name=\"active\" class=\"input\">" +
    "      <option value=\"true\">Active</option>" +
    "      <option value=\"false\">Inactive</option>" +
    "    </select>" +
    "    <textarea name=\"message\" rows=\"3\" class=\"input md:col-span-3\" placeholder=\"Full notice text (optional)\"></textarea>" +
    "    <input name=\"expiresAt\" class=\"input md:col-span-1\" placeholder=\"Expiry date (YYYY-MM-DD) optional\">" +
    "    <label class=\"text-[11px] text-slate-400 md:col-span-2 flex items-center\">" +
    "      <input type=\"checkbox\" name=\"pinned\" class=\"mr-2\">Pinned / High Priority" +
    "    </label>" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Notice</button>" +
    "  </form>" +
    "  <div id=\"noticeFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Recent Notices</h3>" +
    "  <div id=\"noticesList\" class=\"text-xs text-slate-200\">Loading...</div>" +
    "</div>";

  var form = document.getElementById("noticeForm");
  var formMsg = document.getElementById("noticeFormMsg");
  var listEl  = document.getElementById("noticesList");

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving notice...";
    var fd = new FormData(form);
    var data = Object.fromEntries(fd.entries());

    var expiresAtTs = null;
    if (data.expiresAt) {
      var d = new Date(data.expiresAt + "T23:59:59");
      if (!isNaN(d.getTime())) {
        expiresAtTs = firebase.firestore.Timestamp.fromDate(d);
      }
    }

    db.collection("notices").add({
      title: data.title,
      message: data.message || "",
      active: data.active === "true",
      pinned: fd.get("pinned") === "on",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAtTs
    }).then(function() {
      formMsg.textContent = "Notice saved.";
      form.reset();
      loadNoticesList(listEl);
      loadNoticeTicker();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving notice.";
    });
  });

  loadNoticesList(listEl);
}

function loadNoticesList(listEl) {
  db.collection("notices").orderBy("createdAt", "desc").limit(20).get()
    .then(function(snap) {
      if (snap.empty) {
        listEl.textContent = "No notices yet.";
        return;
      }
      var html = "<ul class='space-y-1'>";
      snap.forEach(function(doc) {
        var n = doc.data();
        var active = n.active ? "ACTIVE" : "INACTIVE";
        var pinned = n.pinned ? "⭐ " : "";
        html += "<li class='border-b border-slate-700/60 py-1 flex justify-between'>" +
          "<div>" +
          "<div class='font-semibold'>" + pinned + (n.title || "(no title)") + "</div>" +
          "<div class='text-[11px] text-slate-400'>" + (n.message || "") + "</div>" +
          "</div>" +
          "<div class='text-[10px] mt-1 " + (n.active ? "text-emerald-300" : "text-slate-500") + "'>" + active + "</div>" +
          "</li>";
      });
      html += "</ul>";
      listEl.innerHTML = html;
    }).catch(function(err) {
      console.error("Notices list error", err);
      listEl.textContent = "Unable to load notices.";
    });
}

// ======================================================
// OVERVIEW PAGE
// ======================================================
function renderOverview() {
  var html = "" +
    "<div class='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Students</div>" +
    "    <div id='ovStudents' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Faculty</div>" +
    "    <div id='ovFaculty' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Subjects Offered</div>" +
    "    <div id='ovSubjects' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "</div>" +

    "<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Marks Summary</div>" +
    "    <div id='ovMarks' class='text-slate-300 text-sm'>Loading...</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Latest Notices</div>" +
    "    <ul id='ovNotices' class='text-xs text-slate-300 space-y-1'></ul>" +
    "  </div>" +
    "</div>";

  contentArea.innerHTML = html;

  Promise.all([
    db.collection("students").get(),
    db.collection("faculty").get(),
    db.collection("subjects").get(),
    db.collection("marks").limit(5).get(),
    db.collection("notices").orderBy("createdAt", "desc").limit(5).get()
  ]).then(function(res) {
    var studSnap = res[0];
    var facSnap  = res[1];
    var subSnap  = res[2];
    var marksSnap = res[3];
    var noticesSnap = res[4];

    document.getElementById("ovStudents").textContent = studSnap.size;
    document.getElementById("ovFaculty").textContent  = facSnap.size;
    document.getElementById("ovSubjects").textContent = subSnap.size;

    var ovMarks = document.getElementById("ovMarks");
    if (marksSnap.empty) {
      ovMarks.textContent = "No marks uploaded yet.";
    } else {
      ovMarks.textContent = "Recent marks entries: " + marksSnap.size + " (showing last " + marksSnap.size + ").";
    }

    var ovNotices = document.getElementById("ovNotices");
    if (noticesSnap.empty) {
      ovNotices.innerHTML = "<li>No active notices.</li>";
    } else {
      var listHtml = "";
      noticesSnap.forEach(function(doc) {
        var n = doc.data();
        var text = n.title || n.message || "(no title)";
        listHtml += "<li>• " + text + "</li>";
      });
      ovNotices.innerHTML = listHtml;
    }
  }).catch(function(err) {
    console.error("Overview load error", err);
  });
}

// ======================================================
// SYSTEM MAINTENANCE PAGE (MANUAL PURGE)
// ======================================================
function renderMaintenancePage() {
  contentArea.innerHTML = "" +
    "<div class='panel-card mb-4'>" +
    "  <h3 class='font-semibold mb-2'>System Maintenance</h3>" +
    "  <p class='text-xs text-slate-300 mb-3'>" +
    "    Notices auto-expire logically after 30 days or when expiresAt is past." +
    "  </p>" +
    "  <div id='maintSummary' class='text-xs mb-3'>Loading summary...</div>" +
    "  <button id='purgeNowBtn' class='btn-primary mt-2'>🗑 Purge Expired Notices Now</button>" +
    "</div>" +

    "<div class='panel-card'>" +
    "  <h3 class='font-semibold mb-2'>Purge Logs</h3>" +
    "  <div id='purgeLogs' class='text-xs text-slate-300'>Loading logs...</div>" +
    "</div>";

  var purgeNowBtn = document.getElementById("purgeNowBtn");
  if (purgeNowBtn) {
    purgeNowBtn.onclick = function() {
      if (purgeModal) {
        purgeModal.classList.remove("hidden");
      }
    };
  }
  if (cancelPurgeBtn) {
    cancelPurgeBtn.onclick = function() {
      purgeModal.classList.add("hidden");
    };
  }
  if (confirmPurgeBtn) {
    confirmPurgeBtn.onclick = runManualPurge;
  }

  loadMaintenanceSummary();
  loadPurgeLogs();
}

function loadMaintenanceSummary() {
  var summaryEl = document.getElementById("maintSummary");
  if (!summaryEl) return;

  var now = firebase.firestore.Timestamp.now();
  var ageLimit = Date.now() - 30 * 24 * 3600 * 1000;
  var ageTs = firebase.firestore.Timestamp.fromMillis(ageLimit);

  Promise.all([
    db.collection("notices").where("createdAt", "<", ageTs).get(),
    db.collection("notices").where("expiresAt", "<", now).get(),
    db.collection("notices").where("active", "==", true).get()
  ]).then(function(res) {
    var oldSnap = res[0];
    var expSnap = res[1];
    var activeSnap = res[2];

    summaryEl.innerHTML = "" +
      "<div>Expired by age (30 days): <b>" + oldSnap.size + "</b></div>" +
      "<div>Expired by expiresAt: <b>" + expSnap.size + "</b></div>" +
      "<div>Active notices: <b>" + activeSnap.size + "</b></div>";
  }).catch(function(err) {
    console.error("Summary load error", err);
    summaryEl.textContent = "Unable to load summary.";
  });
}

function loadPurgeLogs() {
  var logsEl = document.getElementById("purgeLogs");
  if (!logsEl) return;

  db.collection("purgeLogs").orderBy("ranAt", "desc").limit(50).get()
    .then(function(snap) {
      if (snap.empty) {
        logsEl.textContent = "No purge logs yet.";
        return;
      }
      var html = "" +
        "<table class='w-full text-left text-[11px]'>" +
        "  <tr class='text-slate-400'>" +
        "    <th class='py-1'>Date</th>" +
        "    <th>Deleted</th>" +
        "    <th>Mode</th>" +
        "    <th>Errors</th>" +
        "  </tr>";
      snap.forEach(function(doc) {
        var d = doc.data();
        var ran = d.ranAt && d.ranAt.toDate ? d.ranAt.toDate().toLocaleString() : "-";
        var hasErrors = d.errors && d.errors.length;
        html += "<tr class='border-t border-slate-700'>" +
          "<td class='py-1'>" + ran + "</td>" +
          "<td>" + d.deletedCount + "</td>" +
          "<td>" + d.mode + "</td>" +
          "<td>" + (hasErrors ? "Yes" : "No") + "</td>" +
          "</tr>";
      });
      html += "</table>";
      logsEl.innerHTML = html;
    }).catch(function(err) {
      console.error("Purge logs error", err);
      logsEl.textContent = "Unable to load logs.";
    });
}

function runManualPurge() {
  if (!confirmPurgeBtn) return;

  confirmPurgeBtn.disabled = true;
  confirmPurgeBtn.textContent = "Processing...";

  var purgeFn = functions.httpsCallable("runManualPurge");
  purgeFn().then(function(result) {
    var deleted = result.data && result.data.deleted ? result.data.deleted : 0;
    alert("Purge complete. Deleted " + deleted + " notices.");
    if (purgeModal) purgeModal.classList.add("hidden");
    confirmPurgeBtn.disabled = false;
    confirmPurgeBtn.textContent = "Delete";
    loadMaintenanceSummary();
    loadPurgeLogs();
    loadNoticeTicker();
  }).catch(function(err) {
    console.error("Manual purge failed", err);
    alert("Purge failed: " + (err.message || "Unknown error"));
    confirmPurgeBtn.disabled = false;
    confirmPurgeBtn.textContent = "Delete";
  });
}
