const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getToken = () => {
  try {
    return localStorage.getItem("studyflow-token") || "";
  } catch {
    return "";
  }
};

const setToken = (token) => {
  try {
    if (token) {
      localStorage.setItem("studyflow-token", token);
    } else {
      localStorage.removeItem("studyflow-token");
    }
  } catch (err) {
    console.warn("Storage error saving token:", err);
  }
};

const request = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message = data?.message || data?.error || `Request failed with status ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    // Distinguish network offline vs HTTP error
    if (!err.status) {
      err.status = 0;
      err.isNetworkError = true;
    }
    throw err;
  }
};

export const api = {
  getToken,
  setToken,

  health: {
    check: () => request("/health"),
  },

  auth: {
    signup: async ({ name, email, pin }) => {
      const res = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, pin }),
      });
      if (res?.token) setToken(res.token);
      return res;
    },
    login: async ({ email, pin }) => {
      const res = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, pin }),
      });
      if (res?.token) setToken(res.token);
      return res;
    },
    me: () => request("/auth/me"),
    updateProfile: (profileData) =>
      request("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(profileData),
      }),
  },

  tasks: {
    getAll: () => request("/tasks"),
    create: (taskData) =>
      request("/tasks", {
        method: "POST",
        body: JSON.stringify(taskData),
      }),
    update: (id, updates) =>
      request(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }),
    delete: (id) =>
      request(`/tasks/${id}`, {
        method: "DELETE",
      }),
    bulkSync: (tasks) =>
      request("/tasks/bulk-sync", {
        method: "POST",
        body: JSON.stringify({ tasks }),
      }),
  },

  notes: {
    getAll: () => request("/notes"),
    create: (folderData) =>
      request("/notes", {
        method: "POST",
        body: JSON.stringify(folderData),
      }),
    update: (id, updates) =>
      request(`/notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }),
    delete: (id) =>
      request(`/notes/${id}`, {
        method: "DELETE",
      }),
    bulkSync: (folders) =>
      request("/notes/bulk-sync", {
        method: "POST",
        body: JSON.stringify({ folders }),
      }),
  },

  goals: {
    getAll: () => request("/goals"),
    create: (goalData) =>
      request("/goals", {
        method: "POST",
        body: JSON.stringify(goalData),
      }),
    update: (id, updates) =>
      request(`/goals/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }),
    delete: (id) =>
      request(`/goals/${id}`, {
        method: "DELETE",
      }),
    bulkSync: (goals) =>
      request("/goals/bulk-sync", {
        method: "POST",
        body: JSON.stringify({ goals }),
      }),
  },

  pomodoro: {
    getAll: () => request("/pomodoro"),
    log: (sessionData) =>
      request("/pomodoro", {
        method: "POST",
        body: JSON.stringify(sessionData),
      }),
    bulkSync: (sessions) =>
      request("/pomodoro/bulk-sync", {
        method: "POST",
        body: JSON.stringify({ sessions }),
      }),
  },

  userData: {
    get: () => request("/user-data"),
    update: (data) =>
      request("/user-data", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  sync: {
    all: () => request("/sync/all"),
    migrateAll: (payload) =>
      request("/sync/migrate-all", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
};
