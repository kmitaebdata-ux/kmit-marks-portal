// admin.js – KMIT Marks Portal Admin (Option A schema)
// Uses Firebase v10 modular SDK via CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* -----------------------------
   1. Firebase Init
------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyC1Aa_mnq_0g7ZEuLbYVjN62iCMWemlKUc",
  authDomain: "kmit-marks-portal-9db76.firebaseapp.com",
  projectId: "kmit-marks-portal-9db76",
  storageBucket: "kmit-marks-portal-9db76.appspot.com",
  messagingSenderId: "264909025742",
  appId: "1:264909025742:web:84de5216860219e6bc3b9f",
  measurementId: "G-JMZ564P8PJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -----------------------------
   2. UI Helpers
------------------------------- */

const loader = document.getElementById("loader");
const toastBox = document.getElementById("toast");

function setLoading(isLoading) {
  if (!loader) return;
  if (isLoading) loader.classList.remove("hidden");
  else loader.classList.add("hidden");
}

function showToast(msg, type = "info") {
  if (!toastBox) return;
  toastBox.textContent = msg;
  toastBox.classList.remove("hidden");
  toastBox.classList.remove("bg-red-600", "bg-emerald-600", "bg-slate-900");

  if (type === "error") toastBox.classList.add("bg-red-600");
  else if (type === "success") toastBox.classList.add("bg-emerald-600");
  else toastBox.classList.add("bg-slate-900");

  setTimeout(() => toastBox.classList.add("hidden"), 3500);
}

function setActiveNav(pageId) {
  document.querySelectorAll("[data-page]").forEach(btn => {
    if (btn.getAttribute("data-page") === pageId) {
      btn.classList.add("bg-slate-800");
    } else {
      btn.classList.remove("bg-slate-800");
    }
  });
}

/* -----------------------------
   3. Admin Auth & Role Check
------------------------------- */

const adminStatus = document.getElementById("adminStatus");
const adminEmailEl = document.getElementById("adminEmail");

async function isAdminUser(uid) {
  const roleRef = doc(db, "roles", uid);
  const snap = await getDoc(roleRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  return data.role === "ADMIN";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    setLoading(true);
    if (adminEmailEl) adminEmailEl.textContent = user.email || user.uid;

    const admin = await isAdminUser(user.uid);
    if (!admin) {
      showToast("You are not an Admin. Redirecting…", "error");
      setTimeout(() => {
        window.location.href = "student.html";
      }, 1500);
      return;
    }

    if (adminStatus) adminStatus.classList.remove("hidden");

    // Load default page
    loadPage("overview");
  } catch (err) {
    console.error("Admin check failed:", err);
    showToast("Failed to verify admin. Redirecting…", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  } finally {
    setLoading(false);
  }
});

/* -----------------------------
   4. Page Rendering Router
------------------------------- */

const contentEl = document.getElementById("adminContent");

async function loadPage(pageId) {
  if (!contentEl) return;
  setActiveNav(pageId);

  switch (pageId) {
    case "overview":
      renderOverview();
      break;
    case "userRoles":
      renderUserRoles();
      break;
    case "roleManager":
      renderRoleManager();
      break;
    case "notices":
      renderNotices();
      break;
    default:
      contentEl.innerHTML = `
        <div class="p-6">
          <h2 class="text-xl font-semibold text-red-600">Page not found</h2>
        </div>`;
  }
}

/* -----------------------------
   5. Overview Page
------------------------------- */

async function renderOverview() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-2xl font-bold mb-2">📊 Dashboard Overview</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-white rounded shadow">
          <h3 class="text-sm font-semibold text-gray-500">Total Users</h3>
          <p id="ovTotalUsers" class="text-3xl mt-2">—</p>
        </div>
        <div class="p-4 bg-white rounded shadow">
          <h3 class="text-sm font-semibold text-gray-500">Students</h3>
          <p id="ovStudents" class="text-3xl mt-2">—</p>
        </div>
        <div class="p-4 bg-white rounded shadow">
          <h3 class="text-sm font-semibold text-gray-500">Faculty</h3>
          <p id="ovFaculty" class="text-3xl mt-2">—</p>
        </div>
      </div>

      <div class="p-4 bg-white rounded shadow">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">Active Notices</h3>
        <ul id="ovNotices" class="text-sm text-gray-700 list-disc pl-5 space-y-1"></ul>
      </div>
    </div>
  `;

  try {
    setLoading(true);
    // Count roles
    const rolesSnap = await getDocs(collection(db, "roles"));
    let total = 0, students = 0, faculty = 0;
    rolesSnap.forEach(docSnap => {
      total++;
      const r = docSnap.data().role;
      if (r === "STUDENT") students++;
      else if (r === "FACULTY") faculty++;
    });

    const totalEl = document.getElementById("ovTotalUsers");
    const stuEl = document.getElementById("ovStudents");
    const facEl = document.getElementById("ovFaculty");

    if (totalEl) totalEl.textContent = String(total);
    if (stuEl) stuEl.textContent = String(students);
    if (facEl) facEl.textContent = String(faculty);

    // Load notices
    const noticesEl = document.getElementById("ovNotices");
    if (noticesEl) {
      const qNotices = query(
        collection(db, "notices"),
        where("active", "==", true)
      );
      const noticeSnap = await getDocs(qNotices);
      if (noticeSnap.empty) {
        noticesEl.innerHTML = `<li class="text-gray-400">No active notices</li>`;
      } else {
        noticesEl.innerHTML = "";
        noticeSnap.forEach(n => {
          const data = n.data();
          const li = document.createElement("li");
          li.textContent = data.title || data.message || "Notice";
          noticesEl.appendChild(li);
        });
      }
    }
  } catch (err) {
    console.error("Overview load error:", err);
    showToast("Failed to load dashboard overview.", "error");
  } finally {
    setLoading(false);
  }
}

/* -----------------------------
   6. User Roles Page (list)
------------------------------- */

async function renderUserRoles() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="p-6">
      <h2 class="text-2xl font-bold mb-4">👤 User Roles</h2>
      <p class="text-sm text-gray-500 mb-4">
        List of users and their assigned roles from <code>roles/{uid}</code>.
      </p>

      <div class="overflow-x-auto bg-white rounded shadow">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th class="px-4 py-2">UID</th>
              <th class="px-4 py-2">Role</th>
            </tr>
          </thead>
          <tbody id="rolesTableBody" class="divide-y divide-gray-100">
            <tr>
              <td class="px-4 py-3 text-gray-400" colspan="2">
                Loading…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const bodyEl = document.getElementById("rolesTableBody");
  if (!bodyEl) return;

  try {
    setLoading(true);
    const snap = await getDocs(collection(db, "roles"));
    if (snap.empty) {
      bodyEl.innerHTML = `
        <tr>
          <td class="px-4 py-3 text-gray-400" colspan="2">
            No roles found.
          </td>
        </tr>
      `;
      return;
    }

    bodyEl.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2 font-mono text-xs">${docSnap.id}</td>
        <td class="px-4 py-2">${data.role || "-"}</td>
      `;
      bodyEl.appendChild(tr);
    });
  } catch (err) {
    console.error("UserRoles load error:", err);
    showToast("Failed to load roles list.", "error");
  } finally {
    setLoading(false);
  }
}

/* -----------------------------
   7. Role Manager Page (edit)
------------------------------- */

function renderRoleManager() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-2xl font-bold mb-2">🎚 Role Manager</h2>
      <p class="text-sm text-gray-500">
        Set or change a user's role in <code>roles/{uid}</code>.
      </p>

      <form id="roleForm" class="space-y-3 max-w-md bg-white rounded shadow p-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">User UID</label>
          <input id="rmUid" type="text"
                 class="w-full border rounded px-3 py-2 text-sm"
                 placeholder="Firebase Auth UID…" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Role</label>
          <select id="rmRole" class="w-full border rounded px-3 py-2 text-sm">
            <option value="STUDENT">STUDENT</option>
            <option value="FACULTY">FACULTY</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <button
          type="submit"
          class="bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-800">
          Save Role
        </button>
      </form>

      <p class="text-xs text-gray-400">
        Note: To make these operations work, Firestore rules must allow
        admins to read/write <code>roles/{uid}</code> for all users.
      </p>
    </div>
  `;

  const form = document.getElementById("roleForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uidEl = document.getElementById("rmUid");
    const roleEl = document.getElementById("rmRole");
    if (!uidEl || !roleEl) return;

    const uid = uidEl.value.trim();
    const role = roleEl.value.trim();

    if (!uid || !role) {
      showToast("Please enter UID and select a role.", "error");
      return;
    }

    try {
      setLoading(true);
      await setDoc(doc(db, "roles", uid), { role });
      showToast(`Role set to ${role} for ${uid}`, "success");
    } catch (err) {
      console.error("RoleManager error:", err);
      showToast("Failed to update role. Check Firestore rules.", "error");
    } finally {
      setLoading(false);
    }
  });
}

/* -----------------------------
   8. Notices Page
------------------------------- */

async function renderNotices() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-2xl font-bold mb-2">📢 Notices</h2>

      <form id="noticeForm" class="space-y-3 max-w-xl bg-white rounded shadow p-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Title</label>
          <input id="ntTitle" type="text"
                 class="w-full border rounded px-3 py-2 text-sm"
                 placeholder="Short notice title…" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Message</label>
          <textarea id="ntMessage"
                    class="w-full border rounded px-3 py-2 text-sm"
                    rows="3"
                    placeholder="Notice message…"></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input id="ntActive" type="checkbox" class="h-4 w-4" checked />
          <label for="ntActive" class="text-xs text-gray-700">Active</label>
        </div>
        <button
          type="submit"
          class="bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-800">
          Add Notice
        </button>
      </form>

      <div class="bg-white rounded shadow p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">Existing Notices</h3>
        <ul id="noticesList" class="space-y-2 text-sm"></ul>
      </div>
    </div>
  `;

  const form = document.getElementById("noticeForm");
  const listEl = document.getElementById("noticesList");
  if (!form || !listEl) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleEl = document.getElementById("ntTitle");
    const msgEl = document.getElementById("ntMessage");
    const activeEl = document.getElementById("ntActive");
    if (!titleEl || !msgEl || !activeEl) return;

    const title = titleEl.value.trim();
    const message = msgEl.value.trim();
    const active = activeEl.checked;

    if (!title && !message) {
      showToast("Enter a title or message.", "error");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "notices"), {
        title,
        message,
        active,
        createdAt: new Date().toISOString()
      });
      titleEl.value = "";
      msgEl.value = "";
      activeEl.checked = true;
      showToast("Notice added.", "success");
      await loadNoticesList();
    } catch (err) {
      console.error("Add notice error:", err);
      showToast("Failed to add notice. Check Firestore rules.", "error");
    } finally {
      setLoading(false);
    }
  });

  await loadNoticesList();
}

async function loadNoticesList() {
  const listEl = document.getElementById("noticesList");
  if (!listEl) return;

  try {
    setLoading(true);
    const qSnap = await getDocs(query(collection(db, "notices"), orderBy("createdAt", "desc")));
    if (qSnap.empty) {
      listEl.innerHTML = `<li class="text-gray-400">No notices yet.</li>`;
      return;
    }

    listEl.innerHTML = "";
    qSnap.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.className = "border border-gray-200 rounded px-3 py-2 flex items-center justify-between gap-2";

      const info = document.createElement("div");
      info.innerHTML = `
        <div class="font-semibold">${data.title || "Untitled notice"}</div>
        <div class="text-xs text-gray-500">${data.message || ""}</div>
      `;

      const controls = document.createElement("div");
      controls.className = "flex items-center gap-2";

      const badge = document.createElement("span");
      badge.className = `text-xs px-2 py-1 rounded-full ${
        data.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`;
      badge.textContent = data.active ? "Active" : "Inactive";

      controls.appendChild(badge);

      li.appendChild(info);
      li.appendChild(controls);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Load notices list error:", err);
    showToast("Failed to load notices list.", "error");
  } finally {
    setLoading(false);
  }
}

/* -----------------------------
   9. Nav & Logout Events
------------------------------- */

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pageId = btn.getAttribute("data-page");
      loadPage(pageId);
    });
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Logout error", e);
      } finally {
        window.location.href = "index.html";
      }
    });
  }
});
