import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "./App.css";
import { api } from "./api.js";
import {
  saveMaterialBlob,
  getMaterialBlob,
  deleteMaterialBlob,
  clearAllMaterials,
} from "./studyMaterialsDb.js";

// --- Web Audio API Synthesizer (Dependency-Free, Safe) ---
class SoundController {
  constructor() {
    this.ctx = null;
    this.alarmInterval = null;
    this.isAlarmRunning = false;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // Sound A: Focus session completed (Rising chime D5 -> A5)
  playFocusComplete() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Note 1: D5 (587.33 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      // Note 2: A5 (880.00 Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn("Audio playFocusComplete error:", e);
    }
  }

  // Sound B: Break session completed (Descending mellow chime G5 -> C5)
  playBreakComplete() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Note 1: G5 (783.99 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: C5 (523.25 Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(523.25, now + 0.14);
      gain2.gain.setValueAtTime(0, now + 0.14);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn("Audio playBreakComplete error:", e);
    }
  }

  // Sound C: Final Pomodoro completed (Celebration fanfare arpeggio C5 -> E5 -> G5 -> C6)
  playCelebration() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [
        { f: 523.25, start: 0, dur: 0.2 },
        { f: 659.25, start: 0.12, dur: 0.2 },
        { f: 783.99, start: 0.24, dur: 0.25 },
        { f: 1046.5, start: 0.38, dur: 0.8 },
      ];

      notes.forEach(({ f, start, dur }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.28, now + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch (e) {
      console.warn("Audio playCelebration error:", e);
    }
  }

  // Sound D: Task reminder alarm (pulsing repeating alarm chime)
  startReminderAlarm() {
    if (this.isAlarmRunning) return;
    this.isAlarmRunning = true;

    const playBeepPair = () => {
      if (!this.isAlarmRunning) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Beep 1 (880 Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        // Beep 2 (1174.66 Hz - D6)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1174.66, now + 0.2);
        gain2.gain.setValueAtTime(0, now + 0.2);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.23);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.2);
        osc2.stop(now + 0.45);
      } catch (e) {
        console.warn("Audio reminder beep error:", e);
      }
    };

    playBeepPair();
    this.alarmInterval = setInterval(playBeepPair, 1400);
  }

  stopReminderAlarm() {
    this.isAlarmRunning = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }
}

const soundManager = new SoundController();

if (typeof window !== "undefined") {
  const unlockAudio = () => {
    soundManager.init();
    ["click", "keydown", "touchstart"].forEach((e) =>
      window.removeEventListener(e, unlockAudio)
    );
  };
  ["click", "keydown", "touchstart"].forEach((e) =>
    window.addEventListener(e, unlockAudio, { once: true })
  );
}

// Confetti pieces generation (deterministic, 45 pieces)
const CONFETTI_PIECES = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  left: Math.round((i * 2.2 + (i % 5) * 3) % 100),
  color: ["#8565d6", "#d8a9c5", "#ffd166", "#06d6a0", "#118ab2", "#ff4d6d", "#a0c4ff"][i % 7],
  delay: ((i * 0.08) % 1.5).toFixed(2),
  duration: (2.2 + (i % 4) * 0.4).toFixed(2),
  rotate: (i * 37) % 360,
  size: 8 + (i % 6) * 2,
}));

// Local time and reminder helpers
const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, "0");
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
};

const getTaskDueDateTime = (task) => {
  if (!task || !task.dueDate || !task.dueTime) return null;
  const dateParts = String(task.dueDate).split("-");
  const timeParts = String(task.dueTime).split(":");
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
  return new Date(year, month, day, hour, minute, 0, 0);
};

const getReminderDateTime = (task) => {
  const dueDateTime = getTaskDueDateTime(task);
  if (!dueDateTime) return null;
  if (task.reminder === null || task.reminder === undefined || task.reminder === "none" || task.reminder === -1) {
    return null;
  }
  const reminderMinutes = Number(task.reminder);
  if (isNaN(reminderMinutes) || reminderMinutes < 0) return null;
  return new Date(dueDateTime.getTime() - reminderMinutes * 60 * 1000);
};

const formatReminderDisplay = (reminder) => {
  if (reminder === null || reminder === undefined || reminder === "none" || reminder === -1) return null;
  const mins = Number(reminder);
  if (isNaN(mins) || mins < 0) return null;
  if (mins === 0) return "At task time";
  if (mins === 1440) return "1d before";
  if (mins === 60) return "1h before";
  return `${mins}m before`;
};

const FOCUS_SECONDS = 10;
const BREAK_SECONDS = 5;

const defaultProfile = {
  name: "Cherry",
  username: "Cherry_31",
  email: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  bio: "",
  course: "",
  college: "",
  branch: "",
  semester: "",
  graduationYear: "",
  avatarUrl: "",
};

// Academic folder emoji rules and detection (Part 6 & 7)
const ACADEMIC_EMOJI_RULES = [
  { keywords: ["network", "web", "internet", "html", "css", "frontend", "browser"], emoji: "🌐" },
  { keywords: ["code", "program", "software", "dev", "algo", "data structure", "dsa", "c++", "c#", "javascript", "js", "ts", "react", "programming"], emoji: "💻" },
  { keywords: ["java", "spring"], emoji: "☕" },
  { keywords: ["python", "django", "flask", "numpy", "pandas"], emoji: "🐍" },
  { keywords: ["database", "dbms", "sql", "mongo", "postgres", "data"], emoji: "🗄️" },
  { keywords: ["math", "calculus", "algebra", "discrete", "geometry", "statistic"], emoji: "📐" },
  { keywords: ["os", "operating system", "linux", "unix", "kernel", "system"], emoji: "⚙️" },
  { keywords: ["automata", "ai", "machine learning", "ml", "robot", "deep learning", "neural"], emoji: "🤖" },
  { keywords: ["security", "cyber", "crypto", "hack", "firewall"], emoji: "🔐" },
  { keywords: ["cloud", "aws", "azure", "docker", "devops", "kubernetes"], emoji: "☁️" },
  { keywords: ["electric", "electronic", "circuit", "hardware", "vlsi", "microprocessor"], emoji: "⚡" },
  { keywords: ["physics", "mechanic", "quantum", "optics", "thermo"], emoji: "🔬" },
  { keywords: ["chem", "organic", "bio", "inorganic"], emoji: "🧪" },
  { keywords: ["project", "capstone", "thesis"], emoji: "🚀" },
  { keywords: ["assignment", "homework", "task"], emoji: "📚" },
  { keywords: ["note", "lecture", "cheatsheet", "summary", "revision"], emoji: "📝" },
  { keywords: ["exam", "prep", "test", "gate", "gre", "quiz"], emoji: "🎯" },
];

const SUGGESTED_EMOJIS_LIST = [
  "📚", "💻", "🌐", "⚙️", "📐", "🗄️", "🤖", "🔬", "🧪", "☕", "🐍", "🔐", "☁️", "⚡", "🚀", "📝", "🎯", "📖", "🎨", "💡"
];

const getSuggestedFolderEmoji = (folderName) => {
  if (!folderName || !folderName.trim()) return "📚";
  const lower = folderName.toLowerCase().trim();
  for (const rule of ACADEMIC_EMOJI_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.emoji;
    }
  }
  return "📚";
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatFolderItemCounts = (folder) => {
  if (!folder) return "0 items";
  const notesCount = Array.isArray(folder.notesList)
    ? folder.notesList.length
    : (folder.materialsList?.length ? 0 : (folder.count || 0));
  const filesCount = Array.isArray(folder.materialsList) ? folder.materialsList.length : 0;
  if (notesCount > 0 && filesCount > 0) {
    return `${notesCount} ${notesCount === 1 ? "note" : "notes"} • ${filesCount} ${filesCount === 1 ? "file" : "files"}`;
  }
  if (filesCount > 0) {
    return `${filesCount} ${filesCount === 1 ? "file" : "files"}`;
  }
  return `${notesCount} ${notesCount === 1 ? "note" : "notes"}`;
};

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPreviousDateString = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return getLocalDateString(dt);
};

const getNextDateString = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return getLocalDateString(dt);
};

const defaultSettings = {
  profile: { name: "Shravani", email: "", phone: "", username: "Shravani" },
  themeMode: "Light",
  themeStyle: "Solid",
  primary: "#8B83E8",
  secondary: "#FCE4E8",
  notifications: { tasks: true, pomodoro: true, goals: true, motivation: false, streak: true },
  reminderTime: "15 minutes",
  calendarReminders: true,
  browserNotifications: false,
  startPage: "Dashboard",
  compactMode: false,
  showMotivation: true,
};

const THEME_PRESETS = [
  {
    id: "lavender-dream",
    name: "Lavender Dream",
    primary: "#8B83E8",
    secondary: "#FCE4E8",
    tag: "Lavender • Blush",
    desc: "Lavender, soft purple, cream, blush",
  },
  {
    id: "rose-garden",
    name: "Rose Garden",
    primary: "#E27396",
    secondary: "#FCE8D8",
    tag: "Soft Rose • Peach",
    desc: "Soft pink, rose, cream, light peach",
  },
  {
    id: "mint-study",
    name: "Mint Study",
    primary: "#48A999",
    secondary: "#E3F2EC",
    tag: "Mint • Sage",
    desc: "Soft mint, sage, cream, light green",
  },
  {
    id: "sky-study",
    name: "Sky Study",
    primary: "#5C7CFA",
    secondary: "#E3EEFF",
    tag: "Soft Blue • Periwinkle",
    desc: "Soft blue, periwinkle, cream, light lavender",
  },
  {
    id: "peach-bloom",
    name: "Peach Bloom",
    primary: "#F08C65",
    secondary: "#FCE8D8",
    tag: "Peach • Coral",
    desc: "Soft peach, warm cream, coral accent, soft pink",
  },
];

const Icons = {
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Tasks: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Focus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Notes: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  Goals: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Progress: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Profile: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  MoreVertical: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="12" cy="5" r="1.5"/>
      <circle cx="12" cy="19" r="1.5"/>
    </svg>
  ),
  Leaf: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  ),
};

const StudyCat = ({ withBooks = true }) => (
  <div className="ref-cat-illustration" aria-hidden="true">
    <div className="cat-figure">
      <div className="cat-body">
        <span className="cat-ear ear-left" />
        <span className="cat-ear ear-right" />
        <span className="cat-sleeping-face">(=^-ω-^=)</span>
      </div>
      <div className="cat-tail" />
    </div>
    {withBooks && (
      <div className="cat-books-stack">
        <div className="book-spine book-pink"><span>Better Habits</span></div>
        <div className="book-spine book-blue"><span>Brighter Tomorrow</span></div>
        <div className="book-spine book-mint"><span>Happier You</span></div>
      </div>
    )}
  </div>
);

const MOTIVATIONAL_NOTES = [
  "One little step today. 🌱",
  "You've got this, gently. ♡",
  "Slow progress still counts. 🌷",
  "Just begin. The rest can follow.",
  "A little effort is enough for today. 🍃",
  "Your effort matters. Always. ♡",
  "One page at a time. 📖",
  "Tiny steps, big dreams. ✨",
  "You don't need perfect. Just start.",
  "Keep showing up for yourself. 🌱",
  "A quiet little win today. ☁️",
  "Future you will smile at this. ♡",
  "Do what you can, then breathe. 🌷",
  "You're making progress, promise. ✨",
  "Today doesn't need to be perfect.",
  "Start small. Keep going. 🍃",
  "Your pace is still a pace. ♡",
  "A little study, a little magic. ✨",
  "Be proud of the effort you gave today.",
  "One task closer. 🌱",
  "You've already started. That's something.",
  "Keep going, little by little. 🌷",
  "Your future self is cheering quietly. ♡",
  "It's okay to take it one thing at a time.",
  "Small progress is still progress. ✨",
  "Today, just do the next thing.",
  "You can do hard things, softly. 🌱",
  "A tiny win is still a win. ♡",
  "Take a breath. Then try again. 🍃",
  "You're allowed to learn slowly. 🌷",
  "Keep your little spark going. ✨",
  "Even ten focused minutes matter.",
  "You showed up. That counts. ♡",
  "Make today a little kinder to yourself.",
  "Keep going. You're getting there. 🌱",
];

const SIDEBAR_MOTIVATION_SPLITS = {
  "One little step today. 🌱": { line1: "One little step", line2: "today. 🌱", icon: "🌱" },
  "You've got this, gently. ♡": { line1: "You've got this,", line2: "gently. ♡", icon: "♡" },
  "Slow progress still counts. 🌷": { line1: "Slow progress", line2: "still counts. 🌷", icon: "🌷" },
  "Just begin. The rest can follow.": { line1: "Just begin.", line2: "The rest can follow.", icon: "🌱" },
  "A little effort is enough for today. 🍃": { line1: "A little effort", line2: "is enough for today. 🍃", icon: "🍃" },
  "Your effort matters. Always. ♡": { line1: "Your effort matters.", line2: "Always. ♡", icon: "♡" },
  "One page at a time. 📖": { line1: "One page", line2: "at a time. 📖", icon: "📖" },
  "Tiny steps, big dreams. ✨": { line1: "Tiny steps,", line2: "big dreams. ✨", icon: "✨" },
  "You don't need perfect. Just start.": { line1: "You don't need perfect.", line2: "Just start.", icon: "✨" },
  "Keep showing up for yourself. 🌱": { line1: "Keep showing up", line2: "for yourself. 🌱", icon: "🌱" },
  "A quiet little win today. ☁️": { line1: "A quiet little win", line2: "today. ☁️", icon: "☁️" },
  "Future you will smile at this. ♡": { line1: "Future you", line2: "will smile at this. ♡", icon: "♡" },
  "Do what you can, then breathe. 🌷": { line1: "Do what you can,", line2: "then breathe. 🌷", icon: "🌷" },
  "You're making progress, promise. ✨": { line1: "You're making progress,", line2: "promise. ✨", icon: "✨" },
  "Today doesn't need to be perfect.": { line1: "Today doesn't need", line2: "to be perfect.", icon: "🌱" },
  "Start small. Keep going. 🍃": { line1: "Start small.", line2: "Keep going. 🍃", icon: "🍃" },
  "Your pace is still a pace. ♡": { line1: "Your pace", line2: "is still a pace. ♡", icon: "♡" },
  "A little study, a little magic. ✨": { line1: "A little study,", line2: "a little magic. ✨", icon: "✨" },
  "Be proud of the effort you gave today.": { line1: "Be proud of the effort", line2: "you gave today.", icon: "🌱" },
  "One task closer. 🌱": { line1: "One task", line2: "closer. 🌱", icon: "🌱" },
  "You've already started. That's something.": { line1: "You've already started.", line2: "That's something.", icon: "🌱" },
  "Keep going, little by little. 🌷": { line1: "Keep going,", line2: "little by little. 🌷", icon: "🌷" },
  "Your future self is cheering quietly. ♡": { line1: "Your future self", line2: "is cheering quietly. ♡", icon: "♡" },
  "It's okay to take it one thing at a time.": { line1: "It's okay to take it", line2: "one thing at a time.", icon: "🌱" },
  "Small progress is still progress. ✨": { line1: "Small progress", line2: "is still progress. ✨", icon: "✨" },
  "Today, just do the next thing.": { line1: "Today, just do", line2: "the next thing.", icon: "🌱" },
  "You can do hard things, softly. 🌱": { line1: "You can do hard things,", line2: "softly. 🌱", icon: "🌱" },
  "A tiny win is still a win. ♡": { line1: "A tiny win", line2: "is still a win. ♡", icon: "♡" },
  "Take a breath. Then try again. 🍃": { line1: "Take a breath.", line2: "Then try again. 🍃", icon: "🍃" },
  "You're allowed to learn slowly. 🌷": { line1: "You're allowed", line2: "to learn slowly. 🌷", icon: "🌷" },
  "Keep your little spark going. ✨": { line1: "Keep your little", line2: "spark going. ✨", icon: "✨" },
  "Even ten focused minutes matter.": { line1: "Even ten focused", line2: "minutes matter.", icon: "⏱" },
  "You showed up. That counts. ♡": { line1: "You showed up.", line2: "That counts. ♡", icon: "♡" },
  "Make today a little kinder to yourself.": { line1: "Make today a little", line2: "kinder to yourself.", icon: "♡" },
  "Keep going. You're getting there. 🌱": { line1: "Keep going.", line2: "You're getting there. 🌱", icon: "🌱" },
};

const getDailyMotivationIndex = (d = new Date()) => {
  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const daysSinceEpoch = Math.floor(Date.UTC(year, month, date) / 86400000);
  return ((daysSinceEpoch % MOTIVATIONAL_NOTES.length) + MOTIVATIONAL_NOTES.length) % MOTIVATIONAL_NOTES.length;
};

function App() {
  // Local Authentication State (Phase 1 Prototype)
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-auth");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      /* ignore corrupted storage */
    }
    return null;
  });

  const [authView, setAuthView] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-auth");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.pin) return "login";
      }
    } catch {
      /* ignore corrupted storage */
    }
    return "signup";
  });

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPin, setSignupPin] = useState("");
  const [signupConfirmPin, setSignupConfirmPin] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [dbConnected, setDbConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbMessage, setDbMessage] = useState("");

  const today = getLocalDateString(new Date());

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = getLocalDateString(tomorrow);

  const dailyMotivation = useMemo(() => {
    const index = getDailyMotivationIndex();
    return MOTIVATIONAL_NOTES[index];
  }, [today]);

  const sidebarMotivation = useMemo(() => {
    return (
      SIDEBAR_MOTIVATION_SPLITS[dailyMotivation] || {
        line1: dailyMotivation,
        line2: "",
        icon: "🌱",
      }
    );
  }, [dailyMotivation]);

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-tasks");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore corrupted storage and fall back to defaults */
    }
    return [
      {
        id: 1,
        name: "Data Structures Notes",
        subject: "DSA",
        priority: "High",
        dueDate: today,
        dueTime: "14:00",
        reminder: 15,
        completed: false,
      },
      {
        id: 2,
        name: "Maths Problem Set",
        subject: "Maths",
        priority: "Medium",
        dueDate: tomorrowDate,
        dueTime: "10:00",
        reminder: 15,
        completed: false,
      },
      {
        id: 3,
        name: "DBMS Revision",
        subject: "DBMS",
        priority: "High",
        dueDate: today,
        dueTime: "16:30",
        reminder: 30,
        completed: false,
      },
      {
        id: 4,
        name: "English Assignment",
        subject: "English",
        priority: "Low",
        dueDate: today,
        dueTime: "18:00",
        reminder: 0,
        completed: false,
      },
    ];
  });
  const [firedReminders, setFiredReminders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("studyflow-fired-reminders")) || [];
    } catch {
      return [];
    }
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCalendarTaskForm, setShowCalendarTaskForm] = useState(false);
  const [activePage, setActivePage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("studyflow-settings"))?.startPage || "Dashboard"; } catch { return "Dashboard"; }
  });
  const [taskName, setTaskName] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("");
  const [taskReminder, setTaskReminder] = useState("15");
  const [calendarTaskName, setCalendarTaskName] = useState("");
  const [calendarTaskSubject, setCalendarTaskSubject] = useState("");
  const [calendarTaskPriority, setCalendarTaskPriority] = useState("Medium");
  const [calendarTaskTime, setCalendarTaskTime] = useState("10:00");
  const [calendarReminder, setCalendarReminder] = useState("15");
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("All");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [, setIsCompleted] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeReminderAlert, setActiveReminderAlert] = useState(null);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [completedPomodoroSessions, setCompletedPomodoroSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-pomodoro-sessions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  });
  const [studyDays, setStudyDays] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-study-days");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  });
  const [streakMeta, setStreakMeta] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-streak-meta");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      /* ignore */
    }
    return {
      lastContinuedNotifiedDate: null,
      lastAtRiskNotifiedDate: null,
      lastEndedNotifiedForDate: null,
      lastStartedNotifiedDate: null,
      hadPreviousStreak: false,
    };
  });
  const [studyHours, setStudyHours] = useState(1);
  const [currentSession, setCurrentSession] = useState(1);
  const [progressPeriod, setProgressPeriod] = useState("This Week");
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("studyflow-goals")) || []; } catch { return []; }
  });
  const [motivations, setMotivations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("studyflow-motivations")) || []; } catch { return []; }
  });
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-notes");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 1, subject: "Computer Networks", count: 12, icon: "💻", color: "#E3F2EC" },
      { id: 2, subject: "Automata Theory", count: 8, icon: "📖", color: "#FCE4E8" },
      { id: 3, subject: "Web Development", count: 5, icon: "🌐", color: "#E3EEFF" },
      { id: 4, subject: "Mathematics 3", count: 10, icon: "📐", color: "#FCE8D8" },
      { id: 5, subject: "Operating Systems", count: 6, icon: "🖥️", color: "#E8ECF8" },
      { id: 6, subject: "DBMS", count: 7, icon: "🗄️", color: "#FFF3DE" },
    ];
  });
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderEmoji, setSelectedFolderEmoji] = useState("📚");
  const [isEmojiCustomized, setIsEmojiCustomized] = useState(false);
  const [openedFolder, setOpenedFolder] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const avatarInputRef = useRef(null);
  const materialFileInputRef = useRef(null);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialUploadError, setMaterialUploadError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null);
  const [goalFilter, setGoalFilter] = useState("All Goals");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalMenuId, setGoalMenuId] = useState(null);
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [quickGoalTitle, setQuickGoalTitle] = useState("");
  const [motivationInput, setMotivationInput] = useState("");
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    category: "",
    dueDate: "",
    progress: 0,
  });
  const [settings, setSettings] = useState(() => {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("studyflow-settings")),
      profile: {
        ...defaultSettings.profile,
        ...JSON.parse(localStorage.getItem("studyflow-settings"))?.profile,
      },
      notifications: {
        ...defaultSettings.notifications,
        ...JSON.parse(localStorage.getItem("studyflow-settings"))?.notifications,
      },
    };
  } catch {
    return defaultSettings;
  }
});

const [notifications, setNotifications] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("studyflow-notifications")) || [];
  } catch {
    return [];
  }
});

const [showNotifications, setShowNotifications] = useState(false);
const [notificationFilter, setNotificationFilter] = useState("All");

const addNotification = (type, title, message) => {
  const newNotification = {
    id: crypto.randomUUID(),
    type,
    category: type,
    title,
    message,
    time: new Date().toISOString(),
    read: false,
  };

  setNotifications((previousNotifications) => [
    newNotification,
    ...previousNotifications,
  ]);
};

const getNotificationType = (n) => {
  if (!n) return "other";
  const raw = String(n.type || n.category || "").toLowerCase().trim();
  if (raw === "task" || raw === "tasks") return "task";
  if (raw === "reminder" || raw === "reminders") return "reminder";
  if (raw === "pomodoro" || raw === "focus" || raw === "break") return "pomodoro";
  if (raw === "goal" || raw === "goals") return "goal";
  if (raw === "streak" || raw === "streaks") return "streak";

  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
  if (text.includes("focus session") || text.includes("pomodoro")) return "pomodoro";
  if (text.includes("goal")) return "goal";
  if (text.includes("streak")) return "streak";
  if (text.includes("reminder") || text.includes("upcoming") || text.includes("overdue")) return "reminder";
  if (text.includes("task") || text.includes("completed")) return "task";

  return "other";
};

const getNotificationIcon = (n) => {
  const cat = getNotificationType(n);
  if (cat === "task") return "📚";
  if (cat === "reminder") return "⏰";
  if (cat === "pomodoro") return "🍅";
  if (cat === "goal") return "🎯";
  if (cat === "streak") return "🔥";
  return "🔔";
};

const filterNotificationByCategory = (notification, filter) => {
  if (filter === "All") return true;
  const cat = getNotificationType(notification);
  if (filter === "Tasks") return cat === "task";
  if (filter === "Reminders") return cat === "reminder";
  if (filter === "Pomodoro") return cat === "pomodoro";
  if (filter === "Goals") return cat === "goal";
  if (filter === "Streaks") return cat === "streak";
  return false;
};

const [themeDraft, setThemeDraft] = useState({
  mode: settings.themeMode,
  style: settings.themeStyle,
  primary: settings.primary,
  secondary: settings.secondary,
});
  // Profile State (Dedicated "studyflow-profile" storage)
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("studyflow-profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return { ...defaultProfile, ...parsed };
        }
      }
    } catch {
      /* ignore corrupted storage */
    }
    try {
      const savedAuth = localStorage.getItem("studyflow-auth");
      if (savedAuth) {
        const parsedAuth = JSON.parse(savedAuth);
        if (parsedAuth && parsedAuth.name) {
          return {
            ...defaultProfile,
            name: parsedAuth.name,
            username: parsedAuth.name.replace(/\s+/g, "_"),
            email: parsedAuth.email || "",
          };
        }
      }
    } catch {
      /* ignore */
    }
    return defaultProfile;
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);
  const [profileError, setProfileError] = useState("");
  const [settingsConfirm, setSettingsConfirm] = useState(null);

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const darkTheme = settings.themeMode === "Dark" || (settings.themeMode === "System" && systemDark);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("studyflow-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("studyflow-sidebar-collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    localStorage.setItem("studyflow-goals", JSON.stringify(goals));
  }, [goals]);
  useEffect(() => {
    localStorage.setItem("studyflow-motivations", JSON.stringify(motivations));
  }, [motivations]);
  useEffect(() => {
    localStorage.setItem("studyflow-settings", JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem(
      "studyflow-notifications",
      JSON.stringify(notifications)
    );
  }, [notifications]);
  useEffect(() => {
    localStorage.setItem("studyflow-tasks", JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem(
      "studyflow-fired-reminders",
      JSON.stringify(firedReminders),
    );
  }, [firedReminders]);
  useEffect(() => {
    localStorage.setItem("studyflow-pomodoro-sessions", JSON.stringify(completedPomodoroSessions));
  }, [completedPomodoroSessions]);
  useEffect(() => {
    localStorage.setItem("studyflow-study-days", JSON.stringify(studyDays));
  }, [studyDays]);
  useEffect(() => {
    localStorage.setItem("studyflow-streak-meta", JSON.stringify(streakMeta));
  }, [streakMeta]);
  useEffect(() => {
    localStorage.setItem("studyflow-notes", JSON.stringify(notes));
  }, [notes]);

  // Module-level in-flight guard to prevent concurrent migrations
  const migrationInProgressRef = useRef(null);
  const isCheckingHealthRef = useRef(false);

  const performSafeMigration = useCallback(async (userId) => {
    // In-flight guard: if migration is already running, await existing promise
    if (migrationInProgressRef.current) {
      console.log("Migration is already in-flight. Joining active migration promise...");
      return migrationInProgressRef.current;
    }

    // If already migrated, skip duplicate POST to avoid race conditions
    if (localStorage.getItem("studyflow-migrated") === "true") {
      return;
    }

    migrationInProgressRef.current = (async () => {
      try {
        setIsSyncing(true);

        let localTasks = [];
        try {
          const raw = localStorage.getItem("studyflow-tasks");
          if (raw) localTasks = JSON.parse(raw) || [];
        } catch {}

        let localNotes = [];
        try {
          const raw = localStorage.getItem("studyflow-notes");
          if (raw) localNotes = JSON.parse(raw) || [];
        } catch {}

        let localGoals = [];
        try {
          const raw = localStorage.getItem("studyflow-goals");
          if (raw) localGoals = JSON.parse(raw) || [];
        } catch {}

        let localSessions = [];
        try {
          const raw = localStorage.getItem("studyflow-pomodoro-sessions");
          if (raw) localSessions = JSON.parse(raw) || [];
        } catch {}

        let localStudyDays = [];
        try {
          const raw = localStorage.getItem("studyflow-study-days");
          if (raw) localStudyDays = JSON.parse(raw) || [];
        } catch {}

        let localStreakMeta = {};
        try {
          const raw = localStorage.getItem("studyflow-streak-meta");
          if (raw) localStreakMeta = JSON.parse(raw) || {};
        } catch {}

        let localSettings = {};
        try {
          const raw = localStorage.getItem("studyflow-settings");
          if (raw) localSettings = JSON.parse(raw) || {};
        } catch {}

        let localProfile = {};
        try {
          const raw = localStorage.getItem("studyflow-profile");
          if (raw) localProfile = JSON.parse(raw) || {};
        } catch {}

        // Backup local data to ensure it can never be lost
        try {
          if (localTasks.length > 0) {
            localStorage.setItem("studyflow-tasks-backup", JSON.stringify(localTasks));
          }
        } catch {}

        // Call migration endpoint on MongoDB Atlas
        const migrationRes = await api.sync.migrateAll({
          tasks: localTasks,
          notes: localNotes,
          goals: localGoals,
          pomodoroSessions: localSessions,
          studyDays: localStudyDays,
          streakMeta: localStreakMeta,
          settings: localSettings,
          profile: localProfile,
        });

        console.log("Safe migration completed successfully:", migrationRes);

        // Fetch authoritative state from MongoDB Atlas
        const serverData = await api.sync.all();

        if (serverData.tasks && serverData.tasks.length > 0) {
          setTasks(
            serverData.tasks.map((t) => ({
              ...t,
              id: t._id || t.id,
              name: t.title || t.name,
            }))
          );
        }

        if (serverData.notes && serverData.notes.length > 0) {
          setNotes(
            serverData.notes.map((n) => ({
              ...n,
              id: n._id || n.id,
            }))
          );
        }

        if (serverData.goals && serverData.goals.length > 0) {
          setGoals(
            serverData.goals.map((g) => ({
              ...g,
              id: g._id || g.id,
            }))
          );
        }

        if (serverData.pomodoroSessions && serverData.pomodoroSessions.length > 0) {
          setCompletedPomodoroSessions(
            serverData.pomodoroSessions.map((s) => ({
              ...s,
              id: s._id || s.id,
            }))
          );
        }

        if (serverData.userData) {
          if (serverData.userData.settings && Object.keys(serverData.userData.settings).length > 0) {
            setSettings((prev) => ({ ...prev, ...serverData.userData.settings }));
          }
          if (serverData.userData.profile && Object.keys(serverData.userData.profile).length > 0) {
            setProfile((prev) => ({ ...prev, ...serverData.userData.profile }));
          }
          if (serverData.userData.studyDays && serverData.userData.studyDays.length > 0) {
            setStudyDays(serverData.userData.studyDays);
          }
          if (serverData.userData.streakMeta && Object.keys(serverData.userData.streakMeta).length > 0) {
            setStreakMeta(serverData.userData.streakMeta);
          }
        }

        localStorage.setItem("studyflow-migrated", "true");
        setDbMessage("All local data synchronized with MongoDB Atlas.");
      } catch (err) {
        console.warn("Migration / sync deferred:", err.message);
        setDbMessage("Working in local cache mode (MongoDB Atlas connecting).");
      } finally {
        setIsSyncing(false);
        migrationInProgressRef.current = null;
      }
    })();

    return migrationInProgressRef.current;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkHealthAndSync = async () => {
      if (isCheckingHealthRef.current) return;
      isCheckingHealthRef.current = true;
      try {
        const health = await api.health.check();
        const isConn = Boolean(health?.database?.connected);
        if (isMounted) setDbConnected(isConn);

        if (!isConn) return;

        let token = api.getToken();
        let authedUser = null;

        if (token) {
          try {
            const me = await api.auth.me();
            if (isMounted && me?.user) {
              authedUser = me.user;
              setAuth((prev) => ({ ...(prev || {}), ...me.user, isLoggedIn: true }));
            }
          } catch {
            api.setToken("");
            token = "";
          }
        }

        // Check local storage for existing account credentials
        let localAuth = auth;
        if (!localAuth) {
          try {
            const raw = localStorage.getItem("studyflow-auth");
            if (raw) localAuth = JSON.parse(raw);
          } catch {}
        }

        // If no active token, authenticate or auto-provision local account
        if (!token && localAuth && localAuth.pin) {
          const userName = (localAuth.name || profile?.name || "Student").trim();
          let userEmail = (localAuth.email || profile?.email || "").trim().toLowerCase();
          if (!userEmail) {
            userEmail = `${userName.toLowerCase().replace(/[^a-z0-9]/g, "") || "student"}@studyflow.local`;
          }
          const userPin = String(localAuth.pin);

          // 1. Attempt login
          try {
            const loginRes = await api.auth.login({ email: userEmail, pin: userPin });
            if (loginRes?.token) {
              token = loginRes.token;
              authedUser = loginRes.user;
            }
          } catch (loginErr) {
            // 2. If login failed with 401 because account was never created in MongoDB, auto-provision
            if (loginErr.status === 401 || loginErr.status === 404) {
              try {
                const signupRes = await api.auth.signup({
                  name: userName,
                  email: userEmail,
                  pin: userPin,
                });
                if (signupRes?.token) {
                  token = signupRes.token;
                  authedUser = signupRes.user;
                  console.log("Auto-provisioned local account into MongoDB Atlas successfully:", signupRes.user);
                }
              } catch (signupErr) {
                if (signupErr.status === 400 && signupErr.data?.error === "UserExists") {
                  try {
                    const retryRes = await api.auth.login({ email: userEmail, pin: userPin });
                    if (retryRes?.token) {
                      token = retryRes.token;
                      authedUser = retryRes.user;
                    }
                  } catch {}
                } else {
                  console.warn("Auto-provisioning failed:", signupErr);
                }
              }
            }
          }

          if (authedUser && isMounted) {
            const updated = {
              ...(localAuth || {}),
              id: authedUser.id || authedUser._id,
              name: authedUser.name || userName,
              email: authedUser.email || userEmail,
              pin: userPin,
              isLoggedIn: true,
            };
            setAuth(updated);
            try {
              localStorage.setItem("studyflow-auth", JSON.stringify(updated));
            } catch {}
          }
        }

        // Run migration if we have a valid token, user is logged in, and not yet migrated
        const isUserLoggedIn = Boolean(auth?.isLoggedIn || localAuth?.isLoggedIn);
        if (token && isUserLoggedIn && !localStorage.getItem("studyflow-migrated")) {
          await performSafeMigration(authedUser?.id || localAuth?.id || "default");
        }
      } catch (err) {
        if (isMounted) setDbConnected(false);
      } finally {
        isCheckingHealthRef.current = false;
      }
    };

    checkHealthAndSync();

    const healthInterval = setInterval(async () => {
      try {
        const health = await api.health.check();
        const isConn = Boolean(health?.database?.connected);
        if (isMounted) {
          setDbConnected(isConn);
          if (isConn) {
            const token = api.getToken();
            const isMigrated = Boolean(localStorage.getItem("studyflow-migrated"));
            if (!token && !isMigrated) {
              checkHealthAndSync();
            }
          }
        }
      } catch {
        if (isMounted) setDbConnected(false);
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(healthInterval);
    };
  }, [auth, performSafeMigration, profile]);

  // Unified set of all unique study dates (YYYY-MM-DD)
  const allStudyDates = useMemo(() => {
    const dates = new Set(studyDays);
    tasks.forEach((t) => {
      if (t.completed) {
        if (t.completedAt) {
          dates.add(getLocalDateString(new Date(t.completedAt)));
        } else if (t.dueDate) {
          dates.add(t.dueDate);
        }
      }
    });
    completedPomodoroSessions.forEach((s) => {
      if (s.type === "focus" && s.completedAt) {
        dates.add(getLocalDateString(new Date(s.completedAt)));
      }
    });
    return dates;
  }, [studyDays, tasks, completedPomodoroSessions]);

  // Real-time calculated streak status and metrics
  const streakData = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    const yesterdayStr = getPreviousDateString(todayStr);

    const hasActivityToday = allStudyDates.has(todayStr);
    const hasActivityYesterday = allStudyDates.has(yesterdayStr);

    let currentStreak;
    if (hasActivityToday) {
      currentStreak = 1;
      let checkDate = yesterdayStr;
      while (allStudyDates.has(checkDate)) {
        currentStreak += 1;
        checkDate = getPreviousDateString(checkDate);
      }
    } else if (hasActivityYesterday) {
      currentStreak = 1;
      let checkDate = getPreviousDateString(yesterdayStr);
      while (allStudyDates.has(checkDate)) {
        currentStreak += 1;
        checkDate = getPreviousDateString(checkDate);
      }
    } else {
      currentStreak = 0;
    }

    // Longest streak across all recorded study days
    const sortedDates = Array.from(allStudyDates).sort();
    let maxStreak = 0;
    let tempStreak = 0;
    let expectedNext = null;

    for (const dStr of sortedDates) {
      if (!expectedNext || dStr === expectedNext) {
        tempStreak += 1;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
      expectedNext = getNextDateString(dStr);
    }
    maxStreak = Math.max(maxStreak, currentStreak);

    const lastActivityDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

    let status;
    if (currentStreak === 0) {
      status = lastActivityDate ? "ended" : "none";
    } else if (!hasActivityToday) {
      status = "at_risk";
    } else if (currentStreak === 1) {
      status = lastActivityDate && lastActivityDate < todayStr ? "restarted" : "started";
    } else {
      status = "continuing";
    }

    return {
      currentStreak,
      longestStreak: maxStreak,
      hasActivityToday,
      hasActivityYesterday,
      needsStudyToday: !hasActivityToday && currentStreak > 0,
      lastActivityDate,
      status,
      todayStr,
      yesterdayStr,
    };
  }, [allStudyDates]);

  const notifyStreak = useCallback((title, message) => {
    if (settings.notifications?.streak === false) return;

    addNotification("streak", title, message);

    if (
      settings.browserNotifications &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(title, { body: message });
      } catch (err) {
        console.warn("Browser notification error:", err);
      }
    }
  }, [settings.notifications?.streak, settings.browserNotifications]);

  const handleStudyActivityStreakNotification = useCallback((activityDate) => {
    if (settings.notifications?.streak === false) return;

    const alreadyHadActivity = allStudyDates.has(activityDate);
    if (alreadyHadActivity) return;

    const yesterdayStr = getPreviousDateString(activityDate);
    const studiedYesterday = allStudyDates.has(yesterdayStr);

    if (studiedYesterday) {
      let streakFromYesterday = 1;
      let checkDate = getPreviousDateString(yesterdayStr);
      while (allStudyDates.has(checkDate)) {
        streakFromYesterday += 1;
        checkDate = getPreviousDateString(checkDate);
      }
      const newStreak = streakFromYesterday + 1;

      if (streakMeta.lastContinuedNotifiedDate !== activityDate) {
        notifyStreak(
          "Streak continued! 🔥",
          `🔥 Streak continued! You're now on a ${newStreak}-day study streak.`
        );
        setStreakMeta((prev) => ({
          ...prev,
          lastContinuedNotifiedDate: activityDate,
          hadPreviousStreak: true,
        }));
      }
    } else {
      const hadPrior = streakMeta.hadPreviousStreak || allStudyDates.size > 0;
      if (streakMeta.lastStartedNotifiedDate !== activityDate) {
        if (hadPrior) {
          notifyStreak(
            "Streak restarted! 🌱",
            "🌱 New streak started! You're back at 1 day."
          );
        } else {
          notifyStreak(
            "Streak started! 🔥",
            "🔥 Your StudyFlow streak has started! You're on a 1-day streak."
          );
        }
        setStreakMeta((prev) => ({
          ...prev,
          lastStartedNotifiedDate: activityDate,
          hadPreviousStreak: true,
        }));
      }
    }
  }, [allStudyDates, streakMeta.lastContinuedNotifiedDate, streakMeta.lastStartedNotifiedDate, streakMeta.hadPreviousStreak, settings.notifications?.streak, notifyStreak]);

  useEffect(() => {
    if (settings.notifications?.streak === false) return;

    const timer = setTimeout(() => {
      const todayStr = getLocalDateString(new Date());
      const yesterdayStr = getPreviousDateString(todayStr);

      const hasActivityToday = allStudyDates.has(todayStr);
      const hasActivityYesterday = allStudyDates.has(yesterdayStr);

      if (!hasActivityToday && hasActivityYesterday) {
        if (streakMeta.lastAtRiskNotifiedDate !== todayStr) {
          let streakFromYesterday = 1;
          let checkDate = getPreviousDateString(yesterdayStr);
          while (allStudyDates.has(checkDate)) {
            streakFromYesterday += 1;
            checkDate = getPreviousDateString(checkDate);
          }
          notifyStreak(
            "Streak at risk ⚠️",
            `⚠️ Your ${streakFromYesterday}-day StudyFlow streak is at risk. Complete some study activity today to keep it going.`
          );
          setStreakMeta((prev) => ({
            ...prev,
            lastAtRiskNotifiedDate: todayStr,
          }));
        }
      }

      if (!hasActivityToday && !hasActivityYesterday && allStudyDates.size > 0) {
        const sortedDates = Array.from(allStudyDates).sort();
        const lastDate = sortedDates[sortedDates.length - 1];
        if (lastDate && lastDate < yesterdayStr) {
          if (streakMeta.lastEndedNotifiedForDate !== lastDate) {
            notifyStreak(
              "Streak ended 💔",
              "💔 Your streak ended. Start a new streak today!"
            );
            setStreakMeta((prev) => ({
              ...prev,
              lastEndedNotifiedForDate: lastDate,
              hadPreviousStreak: true,
            }));
          }
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [allStudyDates, streakMeta.lastAtRiskNotifiedDate, streakMeta.lastEndedNotifiedForDate, settings.notifications?.streak, notifyStreak]);

  const handleDismissReminder = () => {
    soundManager.stopReminderAlarm();
    setActiveReminderAlert(null);
  };

  useEffect(() => {
    if (!showCelebration) return;
    const timer = setTimeout(() => {
      setShowCelebration(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, [showCelebration]);

  useEffect(() => {
    if (!activeReminderAlert) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        handleDismissReminder();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeReminderAlert]);

  // Centralized Task Reminder Scheduler
  useEffect(() => {
    const checkReminders = () => {
      if (settings.notifications?.tasks === false) return;
      const now = new Date();

      tasks.forEach((task) => {
        if (task.completed) return;
        const reminderTime = getReminderDateTime(task);
        if (!reminderTime) return;
        const dueDateTime = getTaskDueDateTime(task);
        if (!dueDateTime) return;

        const reminderKey = `${task.id}_${task.dueDate}_${task.dueTime}_${task.reminder}`;
        if (firedReminders.includes(reminderKey)) return;

        if (now >= reminderTime && now.getTime() <= dueDateTime.getTime() + 60 * 60 * 1000) {
          setFiredReminders((prev) => [...prev, reminderKey]);

          const formattedTime = formatTimeDisplay(task.dueTime);

          addNotification(
            "reminder",
            "Task reminder ⏰",
            `"${task.name}" is scheduled for ${formattedTime}.`,
          );

          setActiveReminderAlert({
            task,
            dueTimeDisplay: formattedTime,
          });

          soundManager.startReminderAlarm();

          if (
            settings.browserNotifications &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("🔔 StudyFlow Reminder", {
                body: `"${task.name}" starts at ${formattedTime}.`,
              });
            } catch (err) {
              console.warn("Browser notification error:", err);
            }
          }
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 2000);
    return () => clearInterval(interval);
  }, [tasks, firedReminders, settings.notifications?.tasks, settings.browserNotifications]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setTimeout(() => {
      if (timeLeft > 0) {
        setTimeLeft(timeLeft - 1);
      } else {
        if (!isBreak) {
          setSessionsCompleted((prev) => prev + 1);

          const completedAt = new Date().toISOString();
          const todayStr = getLocalDateString(new Date());

          setCompletedPomodoroSessions((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              completedAt,
              type: "focus",
            },
          ]);

          setStudyDays((prev) => (prev.includes(todayStr) ? prev : [...prev, todayStr]));
          handleStudyActivityStreakNotification(todayStr);

          const totalFocusSessions = Math.max(1, studyHours * 2);
          const isFinalFocus = currentSession >= totalFocusSessions;

          if (settings.notifications?.pomodoro !== false) {
            soundManager.playFocusComplete();
          }

          if (!isFinalFocus) {
            if (settings.notifications?.pomodoro !== false) {
              addNotification(
                "pomodoro",
                "Focus session completed 🍅",
                "You completed a Pomodoro focus session. Great work!",
              );
            }
            setIsBreak(true);
            setTimeLeft(BREAK_SECONDS);
          } else {
            if (settings.notifications?.pomodoro !== false) {
              addNotification(
                "pomodoro",
                "Pomodoro Lock Completed! 🎉",
                `You completed all ${totalFocusSessions} focus sessions for your ${studyHours}h study block!`,
              );
              soundManager.playCelebration();
            } else {
              soundManager.playCelebration();
            }
            setShowCelebration(true);
            setIsRunning(false);
            setIsCompleted(true);
            setTimeLeft(0);
          }
        } else {
          if (settings.notifications?.pomodoro !== false) {
            soundManager.playBreakComplete();
          }
          setCurrentSession((prev) => prev + 1);
          setIsBreak(false);
          setTimeLeft(FOCUS_SECONDS);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRunning, isBreak, timeLeft, studyHours, currentSession, settings.notifications?.pomodoro, handleStudyActivityStreakNotification]);
  const toggleTask = (id) => {
    const task = tasks.find((item) => item.id === id);

    if (!task) return;

    const willComplete = !task.completed;
    const nowIso = new Date().toISOString();
    const todayStr = getLocalDateString(new Date());

    const targetDbId = task._id || (typeof id === "string" && id.length === 24 ? id : null);
    if (targetDbId) {
      api.tasks.update(targetDbId, {
        completed: willComplete,
        completedAt: willComplete ? (task.completedAt || nowIso) : null,
      }).catch((err) => console.warn("Background task sync failed:", err));
    }

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: willComplete,
              completedAt: willComplete ? (item.completedAt || nowIso) : null,
            }
          : item,
      ),
    );

    if (willComplete) {
      setStudyDays((prev) => (prev.includes(todayStr) ? prev : [...prev, todayStr]));
      handleStudyActivityStreakNotification(todayStr);
    }

    if (willComplete && activeReminderAlert && activeReminderAlert.task.id === id) {
      soundManager.stopReminderAlarm();
      setActiveReminderAlert(null);
    }

    if (willComplete && settings.notifications?.tasks !== false) {
      addNotification(
        "task",
        "Task completed 🎉",
        `"${task.name}" has been completed.`,
      );
    }
  };

  const completedTasks = tasks.filter((task) => task.completed).length;

  const todaysTasks = tasks.filter((task) => task.dueDate === today);

  const totalTasks = tasks.length;

  const progressPercentage =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const weeklyStudyActivity = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return dayLabels.map((dayLabel, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateStr = getLocalDateString(d);

      const daySessions = completedPomodoroSessions.filter((s) => {
        if (s.type !== "focus" || !s.completedAt) return false;
        return getLocalDateString(new Date(s.completedAt)) === dateStr;
      });

      const sessionCount = daySessions.length;
      const studyHoursVal = sessionCount === 0 ? 0 : Number((sessionCount * 0.5).toFixed(1));

      return {
        day: dayLabel,
        date: dateStr,
        isToday: dateStr === today,
        sessions: sessionCount,
        hours: studyHoursVal,
      };
    });
  }, [completedPomodoroSessions, today]);

  const maxWeeklyHours = useMemo(() => {
    const maxVal = Math.max(...weeklyStudyActivity.map((d) => d.hours), 0);
    return maxVal > 0 ? maxVal : 2;
  }, [weeklyStudyActivity]);

  const totalWeeklyStudyHours = useMemo(() => {
    return Number(weeklyStudyActivity.reduce((sum, d) => sum + d.hours, 0).toFixed(1));
  }, [weeklyStudyActivity]);

  const getNormalizedTaskDate = (dueDateVal) => {
    if (!dueDateVal) return null;
    if (typeof dueDateVal === "string") {
      const match = dueDateVal.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    const d = new Date(dueDateVal);
    return isNaN(d.getTime()) ? null : getLocalDateString(d);
  };

  const getNormalizedTaskTime = (task) => {
    if (task.dueTime) return task.dueTime;
    if (typeof task.dueDate === "string" && task.dueDate.includes("T")) {
      const timePart = task.dueDate.split("T")[1];
      if (timePart) return timePart.slice(0, 5);
    }
    return "23:59";
  };

  const upcomingTasks = useMemo(() => {
    const todayStr = getLocalDateString(new Date());

    return tasks
      .filter((task) => {
        if (task.completed) return false;
        const taskDate = getNormalizedTaskDate(task.dueDate);
        if (!taskDate) return false;
        // Strictly after today: excludes past dates and today (today is in Today's Tasks)
        return taskDate > todayStr;
      })
      .sort((a, b) => {
        const dateA = getNormalizedTaskDate(a.dueDate);
        const dateB = getNormalizedTaskDate(b.dueDate);
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        const timeA = getNormalizedTaskTime(a);
        const timeB = getNormalizedTaskTime(b);
        return timeA.localeCompare(timeB);
      })
      .slice(0, 3);
  }, [tasks]);

  const formatUpcomingTaskDueDate = (dueDateStr, dueTimeStr) => {
    if (!dueDateStr) return "";
    const cleanDateStr = getNormalizedTaskDate(dueDateStr) || dueDateStr;
    const extractedTime =
      dueTimeStr ||
      (typeof dueDateStr === "string" && dueDateStr.includes("T")
        ? dueDateStr.split("T")[1].slice(0, 5)
        : null);

    let datePart;
    if (cleanDateStr === today) {
      datePart = "Today";
    } else if (cleanDateStr === tomorrowDate) {
      datePart = "Tomorrow";
    } else {
      const parts = String(cleanDateStr).split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        datePart = isNaN(d.getTime())
          ? cleanDateStr
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else {
        datePart = cleanDateStr;
      }
    }
    return extractedTime ? `${datePart}, ${formatTimeDisplay(extractedTime)}` : datePart;
  };

  const currentProgressDate = new Date(`${today}T00:00:00`);
  const subjectActivityTasks = tasks.filter((task) => {
    if (!task.completed || !task.dueDate) return false;

    const taskDate = new Date(`${task.dueDate}T00:00:00`);

    if (progressPeriod === "This Week") {
      const weekStart = new Date(currentProgressDate);
      weekStart.setDate(currentProgressDate.getDate() - currentProgressDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return taskDate >= weekStart && taskDate <= weekEnd;
    }

    if (progressPeriod === "This Month") {
      return (
        taskDate.getMonth() === currentProgressDate.getMonth() &&
        taskDate.getFullYear() === currentProgressDate.getFullYear()
      );
    }

    return taskDate.getFullYear() === currentProgressDate.getFullYear();
  });
  const subjectActivityCounts = subjectActivityTasks.reduce((counts, task) => {
    counts[task.subject] = (counts[task.subject] || 0) + 1;
    return counts;
  }, {});
  const subjectActivityEntries = Object.entries(subjectActivityCounts);
  const subjectColors = [
    settings.primary,
    `color-mix(in srgb, ${settings.primary} 70%, ${settings.secondary})`,
    `color-mix(in srgb, ${settings.primary} 40%, ${settings.secondary})`,
    `color-mix(in srgb, ${settings.secondary} 75%, white)`,
    `color-mix(in srgb, ${settings.primary} 25%, ${darkTheme ? "#382e4f" : "#dcd5e5"})`,
  ];
  let allocatedSubjectPercentage = 0;
  const subjectBreakdown = subjectActivityEntries.map(
    ([subject, count], index) => {
      const percentage =
        index === subjectActivityEntries.length - 1
          ? 100 - allocatedSubjectPercentage
          : Math.round((count / subjectActivityTasks.length) * 100);
      allocatedSubjectPercentage += percentage;

      return {
        key: `${subject}-${index}`,
        subject,
        percentage,
        color: subjectColors[index % subjectColors.length],
      };
    },
  );
  let subjectPiePosition = 0;
  const subjectPieBackground = subjectBreakdown.length
    ? `conic-gradient(${subjectBreakdown
        .map(({ color, percentage }) => {
          const start = subjectPiePosition;
          subjectPiePosition += percentage;
          return `${color} ${start}% ${subjectPiePosition}%`;
        })
        .join(", ")})`
    : `conic-gradient(color-mix(in srgb, var(--primary-color, #8565d6) 12%, ${darkTheme ? "#2a2238" : "#eee7f4"}) 0 100%)`;
  const formatActivityDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  const focusSessionCountForDate = (date) =>
    completedPomodoroSessions.filter(
      (session) =>
        session.type === "focus" &&
        formatActivityDate(new Date(session.completedAt)) === formatActivityDate(date),
    ).length;
  let pomodoroActivityBars;

  if (progressPeriod === "This Week") {
    const weekStart = new Date(currentProgressDate);
    weekStart.setDate(
      currentProgressDate.getDate() - ((currentProgressDate.getDay() + 6) % 7),
    );
    pomodoroActivityBars = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
      (label, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return [label, focusSessionCountForDate(date)];
      },
    );
  } else if (progressPeriod === "This Month") {
    pomodoroActivityBars = ["W1", "W2", "W3", "W4", "W5"].map(
      (label, index) => [
        label,
        completedPomodoroSessions.filter((session) => {
          const completedAt = new Date(session.completedAt);
          return (
            session.type === "focus" &&
            completedAt.getMonth() === currentProgressDate.getMonth() &&
            completedAt.getFullYear() === currentProgressDate.getFullYear() &&
            Math.floor((completedAt.getDate() - 1) / 7) === index
          );
        }).length,
      ],
    );
  } else {
    pomodoroActivityBars = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ].map((label, index) => [
      label,
      completedPomodoroSessions.filter((session) => {
        const completedAt = new Date(session.completedAt);
        return (
          session.type === "focus" &&
          completedAt.getMonth() === index &&
          completedAt.getFullYear() === currentProgressDate.getFullYear()
        );
      }).length,
    ]);
  }
  const highestPomodoroActivity = Math.max(
    ...pomodoroActivityBars.map(([, count]) => count),
    1,
  );
  const progressDataByPeriod = {
    "This Week": {
      studyHours,
      tasksCompleted: completedTasks,
      totalTasks,
      taskPercentage: progressPercentage,
      pomodoroSessions: sessionsCompleted,
      studyHoursBars: [
        ["Mon", 48], ["Tue", 65], ["Wed", 35], ["Thu", 82],
        ["Fri", 38], ["Sat", 60], ["Sun", 78],
      ],
    },
    "This Month": {
      studyHours: 48,
      tasksCompleted: 18,
      totalTasks: 24,
      taskPercentage: 75,
      pomodoroSessions: 36,
      studyHoursBars: [["W1", 55], ["W2", 72], ["W3", 60], ["W4", 80]],
    },
    "This Year": {
      studyHours: 420,
      tasksCompleted: 156,
      totalTasks: 208,
      taskPercentage: 75,
      pomodoroSessions: 312,
      studyHoursBars: [["Jan", 45], ["Feb", 52], ["Mar", 58], ["Apr", 64], ["May", 60], ["Jun", 70], ["Jul", 68], ["Aug", 75], ["Sep", 72], ["Oct", 80], ["Nov", 78], ["Dec", 85]],
    },
  };
  const selectedProgressData = progressDataByPeriod[progressPeriod];
  const addTask = async () => {
    if (taskName.trim() === "" || taskSubject.trim() === "") {
      alert("Please enter both task name and subject");
      return;
    }

    const clientTaskId = crypto.randomUUID();
    const taskPayload = {
      title: taskName.trim(),
      name: taskName.trim(),
      subject: taskSubject.trim(),
      dueDate: taskDueDate || today,
      dueTime: taskDueTime || "12:00",
      reminder: taskReminder === "none" ? null : Number(taskReminder),
      priority: taskPriority,
      completed: false,
      clientTaskId,
    };

    try {
      let createdTask;
      try {
        createdTask = await api.tasks.create(taskPayload);
      } catch (backendErr) {
        console.warn("Backend save failed, keeping in local cache:", backendErr);
        // Fallback so the task is NEVER lost if DB is connecting
        createdTask = {
          ...taskPayload,
          id: clientTaskId,
          _id: clientTaskId,
        };
      }

      const newTask = {
        ...createdTask,
        id: createdTask._id || createdTask.id || clientTaskId,
        name: createdTask.title || createdTask.name || taskPayload.name,
        subject: createdTask.subject || taskPayload.subject,
        dueDate: createdTask.dueDate || taskPayload.dueDate,
        dueTime: taskPayload.dueTime,
        reminder: taskPayload.reminder,
        priority: createdTask.priority || taskPayload.priority,
        completed: Boolean(createdTask.completed),
      };

      setTasks((prev) => [...prev, newTask]);

      if (taskReminder !== "none" && settings.notifications?.tasks !== false) {
        const label = formatReminderDisplay(Number(taskReminder)) || `${taskReminder}m before`;
        addNotification(
          "reminder",
          "Task reminder set ⏰",
          `Reminder set for "${taskName}" (${label}).`,
        );
      }

      setTaskName("");
      setTaskSubject("");
      setTaskPriority("Medium");
      setTaskDueDate("");
      setTaskDueTime("");
      setTaskReminder(getDefaultReminderMinutes());
      setShowTaskForm(false);
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Unable to save task: " + (error.message || "Please check connection."));
    }
  };
  const getDefaultReminderMinutes = () => {
    if (settings.calendarReminders === false) return "none";
    if (settings.reminderTime === "At time of task") return "0";
    if (settings.reminderTime === "5 minutes") return "5";
    if (settings.reminderTime === "30 minutes") return "30";
    if (settings.reminderTime === "1 hour") return "60";
    if (settings.reminderTime === "1 day") return "1440";
    if (settings.reminderTime === "No reminder") return "none";
    return "15";
  };
  const cancelTaskForm = () => {
    setTaskName("");
    setTaskSubject("");
    setTaskPriority("Medium");
    setTaskDueDate("");
    setTaskDueTime("");
    setTaskReminder(getDefaultReminderMinutes());
    setShowTaskForm(false);
  };
  const addCalendarTask = async (e) => {
    if (e) e.preventDefault();
    if (calendarTaskName.trim() === "" || calendarTaskSubject.trim() === "") {
      alert("Please enter both task name and subject");
      return;
    }

    const clientTaskId = crypto.randomUUID();
    const taskPayload = {
      title: calendarTaskName.trim(),
      name: calendarTaskName.trim(),
      subject: calendarTaskSubject.trim(),
      priority: calendarTaskPriority,
      dueDate: formatDate(selectedDate),
      dueTime: calendarTaskTime || "10:00",
      reminder: calendarReminder === "none" ? null : Number(calendarReminder),
      completed: false,
      clientTaskId,
    };

    let createdTask;
    try {
      createdTask = await api.tasks.create(taskPayload);
    } catch {
      createdTask = { ...taskPayload, id: clientTaskId };
    }

    const newTask = {
      ...createdTask,
      id: createdTask._id || createdTask.id || clientTaskId,
      name: createdTask.title || createdTask.name || taskPayload.name,
      subject: createdTask.subject || taskPayload.subject,
      priority: createdTask.priority || taskPayload.priority,
      dueDate: createdTask.dueDate || taskPayload.dueDate,
      dueTime: taskPayload.dueTime,
      reminder: taskPayload.reminder,
      completed: false,
    };

    setTasks((prevTasks) => [...prevTasks, newTask]);

    if (calendarReminder !== "none" && settings.notifications?.tasks !== false) {
      const label = formatReminderDisplay(Number(calendarReminder)) || `${calendarReminder}m before`;
      addNotification(
        "reminder",
        "Task reminder set ⏰",
        `Reminder set for "${calendarTaskName}" (${label}).`,
      );
    }

    setCalendarTaskName("");
    setCalendarTaskSubject("");
    setCalendarTaskPriority("Medium");
    setCalendarTaskTime("10:00");
    setCalendarReminder(getDefaultReminderMinutes());
    setShowCalendarTaskForm(false);
  };
  const cancelCalendarTaskForm = () => {
    setCalendarTaskName("");
    setCalendarTaskSubject("");
    setCalendarTaskPriority("Medium");
    setCalendarTaskTime("10:00");
    setCalendarReminder(getDefaultReminderMinutes());
    setShowCalendarTaskForm(false);
  };
  const deleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    const targetDbId = task?._id || (typeof id === "string" && id.length === 24 ? id : null);
    if (targetDbId) {
      api.tasks.delete(targetDbId).catch((err) => console.warn("Delete sync failed:", err));
    }
    setTasks((prev) => prev.filter((item) => item.id !== id));
    if (activeReminderAlert && activeReminderAlert.task.id === id) {
      soundManager.stopReminderAlarm();
      setActiveReminderAlert(null);
    }
  };
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        taskFilter === "All" ||
        (taskFilter === "Active" && !task.completed) ||
        (taskFilter === "Completed" && task.completed);

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };
  const getTasksForDate = (date) => {
    const dateString = formatDate(date);

    return tasks.filter((task) => task.dueDate === dateString);
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

  const isToday = (date) => {
    return formatDate(date) === formatDate(new Date());
  };
  const monthName = calendarDate.toLocaleString("default", {
    month: "long",
  });

  const calendarYear = calendarDate.getFullYear();
  const goToPreviousMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1),
    );
  };
  const goToNextMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1),
    );
  };
  const goToToday = () => {
    const todayDate = new Date();

    setCalendarDate(todayDate);
    setSelectedDate(todayDate);
  };
  const firstDayOfMonth = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    1,
  );

  const daysInMonth = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0,
  ).getDate();

  const startingDay = (firstDayOfMonth.getDay() + 6) % 7;
  const calendarDays = Array.from(
    { length: startingDay + daysInMonth },
    (_, index) => {
      if (index < startingDay) {
        return null;
      }

      return index - startingDay + 1;
    },
  );
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const getSubjectColor = (subject) => {
    const colors = [
      "#eee8ff",
      "#e7f0ff",
      "#f5eaff",
      "#e7f7ed",
      "#fff3d8",
      "#ffe8ec",
    ];
    const index =
      subject
        .toLowerCase()
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;

    return colors[index];
  };
  const resetGoalForm = () => {
    setGoalForm({ title: "", description: "", category: "", dueDate: "", progress: 0 });
    setEditingGoalId(null);
  };
  const saveGoal = () => {
    if (!goalForm.title.trim()) return;

    const progress = Math.max(0, Math.min(100, Number(goalForm.progress) || 0));
    if (editingGoalId) {
      const updatedGoal = {
        ...goalForm,
        progress,
        completed: progress === 100,
        previousProgress: progress === 100 ? 0 : progress,
      };
      setGoals((currentGoals) =>
        currentGoals.map((goal) =>
          goal.id === editingGoalId
            ? { ...goal, ...updatedGoal }
            : goal,
        ),
      );
      api.goals.update(editingGoalId, updatedGoal).catch((err) => {
        console.warn("Backend goal update deferred:", err);
      });
    } else {
      const newGoal = {
        id: crypto.randomUUID(),
        ...goalForm,
        progress,
        completed: progress === 100,
        previousProgress: progress === 100 ? 0 : progress,
        archived: false,
      };
      setGoals((currentGoals) => [
        ...currentGoals,
        newGoal,
      ]);
      api.goals.create(newGoal).catch((err) => {
        console.warn("Backend goal create deferred:", err);
      });
    }
    resetGoalForm();
    setShowGoalForm(false);
  };
  const toggleGoalCompletion = (id) => {
  const goal = goals.find((item) => item.id === id);

  if (!goal) return;

  const willComplete = !goal.completed;

  setGoals((currentGoals) =>
    currentGoals.map((item) =>
      item.id === id
        ? willComplete
          ? {
              ...item,
              completed: true,
              previousProgress: item.progress,
              progress: 100,
            }
          : {
              ...item,
              completed: false,
              progress: item.previousProgress ?? 0,
            }
        : item,
    ),
  );

  if (willComplete && settings.notifications?.goals !== false) {
    addNotification(
      "goal",
      "Goal completed 🎯",
      `"${goal.title}" has been completed.`,
    );
  }
};
  const openGoalEditor = (goal) => {
    setGoalForm({ title: goal.title, description: goal.description || "", category: goal.category || "", dueDate: goal.dueDate || "", progress: goal.progress });
    setEditingGoalId(goal.id);
    setGoalMenuId(null);
    setShowGoalForm(true);
  };
  const addQuickGoal = (event) => {
    event.preventDefault();
    if (!quickGoalTitle.trim()) return;
    setGoals((currentGoals) => [...currentGoals, { id: crypto.randomUUID(), title: quickGoalTitle.trim(), description: "", category: "", dueDate: "", progress: 0, previousProgress: 0, completed: false, archived: false }]);
    setQuickGoalTitle("");
  };
  const visibleGoals = goals.filter((goal) => !goal.archived && (
    goalFilter === "All Goals" ||
    (goalFilter === "Active" && !goal.completed) ||
    (goalFilter === "Completed" && goal.completed)
  ));
  const activeGoals = goals.filter((goal) => !goal.archived && !goal.completed).length;
  const completedGoals = goals.filter((goal) => !goal.archived && goal.completed).length;
  const applyTheme = () => setSettings((current) => ({ ...current, themeMode: themeDraft.mode, themeStyle: themeDraft.style, primary: themeDraft.primary, secondary: themeDraft.secondary }));
  const resetTheme = () => {
    setSettings((current) => ({ ...current, themeMode: defaultSettings.themeMode, themeStyle: defaultSettings.themeStyle, primary: defaultSettings.primary, secondary: defaultSettings.secondary }));
    setThemeDraft({ mode: defaultSettings.themeMode, style: defaultSettings.themeStyle, primary: defaultSettings.primary, secondary: defaultSettings.secondary });
    setSettingsConfirm(null);
  };
  const updateSettings = (updates) => setSettings((current) => ({ ...current, ...updates }));
  const exportStudyFlowData = () => {
    const data = { tasks, goals, motivations, settings, notifications, completedPomodoroSessions, studyDays, streakMeta };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    link.download = "studyflow-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const clearStudyFlowData = () => {
    ["studyflow-goals", "studyflow-motivations", "studyflow-notifications", "studyflow-tasks", "studyflow-fired-reminders", "studyflow-pomodoro-sessions", "studyflow-study-days", "studyflow-streak-meta"].forEach((key) => localStorage.removeItem(key));
    setGoals([]);
    setMotivations([]);
    setTasks([]);
    setNotifications([]);
    setCompletedPomodoroSessions([]);
    setStudyDays([]);
    setStreakMeta({
      lastContinuedNotifiedDate: null,
      lastAtRiskNotifiedDate: null,
      lastEndedNotifiedForDate: null,
      lastStartedNotifiedDate: null,
      hadPreviousStreak: false,
    });
    setFiredReminders([]);
    soundManager.stopReminderAlarm();
    setActiveReminderAlert(null);
    setShowCelebration(false);
    setSessionsCompleted(0);
    setSettingsConfirm(null);
  };
  const deleteAccount = () => {
    ["studyflow-goals", "studyflow-motivations", "studyflow-settings", "studyflow-notifications", "studyflow-tasks", "studyflow-fired-reminders", "studyflow-auth", "studyflow-profile", "studyflow-pomodoro-sessions", "studyflow-study-days", "studyflow-streak-meta", "studyflow-notes"].forEach((key) => localStorage.removeItem(key));
    clearAllMaterials().catch(console.warn);
    setGoals([]);
    setMotivations([]);
    setTasks([]);
    setNotifications([]);
    setCompletedPomodoroSessions([]);
    setStudyDays([]);
    setStreakMeta({
      lastContinuedNotifiedDate: null,
      lastAtRiskNotifiedDate: null,
      lastEndedNotifiedForDate: null,
      lastStartedNotifiedDate: null,
      hadPreviousStreak: false,
    });
    setFiredReminders([]);
    soundManager.stopReminderAlarm();
    setActiveReminderAlert(null);
    setShowCelebration(false);
    setSessionsCompleted(0);
    setSettings(defaultSettings);
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setEditingProfile(false);
    setProfileError("");
    setThemeDraft({
      mode: defaultSettings.themeMode,
      style: defaultSettings.themeStyle,
      primary: defaultSettings.primary,
      secondary: defaultSettings.secondary,
    });
    setSettingsConfirm(null);
    setActivePage("Dashboard");
    setAuth(null);
    setAuthView("signup");
    setSignupName("");
    setSignupEmail("");
    setSignupPin("");
    setSignupConfirmPin("");
    setLoginPin("");
    setAuthError("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    if (!signupEmail.trim()) {
      setAuthError("Please enter your email.");
      return;
    }
    if (signupPin.length !== 4) {
      setAuthError("PIN must contain exactly 4 digits.");
      return;
    }
    if (signupConfirmPin.length !== 4) {
      setAuthError("Confirm PIN must contain exactly 4 digits.");
      return;
    }
    if (signupPin !== signupConfirmPin) {
      setAuthError("PIN and Confirm PIN must match.");
      return;
    }

    try {
      let userRes;
      try {
        userRes = await api.auth.signup({
          name: signupName.trim(),
          email: signupEmail.trim(),
          pin: signupPin,
        });
      } catch (apiErr) {
        if (apiErr.status === 400 && apiErr.data?.error === "UserExists") {
          setAuthError(apiErr.message);
          return;
        }
        console.warn("Backend signup offline/deferred:", apiErr);
      }

      const newAuth = {
        id: userRes?.user?.id || crypto.randomUUID(),
        name: signupName.trim(),
        email: signupEmail.trim(),
        pin: signupPin,
        isLoggedIn: true,
      };

      try {
        localStorage.setItem("studyflow-auth", JSON.stringify(newAuth));
      } catch (err) {
        console.warn("Error saving auth:", err);
      }

      setAuth(newAuth);
      await performSafeMigration(newAuth.id || newAuth.email);

      setProfile((prev) => {
        const hasCustomProfile = Boolean(localStorage.getItem("studyflow-profile"));
        if (hasCustomProfile) return prev;
        const authName = signupName.trim() || prev.name;
        const initialProfile = {
          ...prev,
          name: authName,
          username: authName ? authName.replace(/\s+/g, "_") : prev.username,
          email: signupEmail.trim() || prev.email,
        };
        try {
          localStorage.setItem("studyflow-profile", JSON.stringify(initialProfile));
        } catch {}
        return initialProfile;
      });

      setSignupName("");
      setSignupEmail("");
      setSignupPin("");
      setSignupConfirmPin("");
      setAuthError("");
    } catch (err) {
      setAuthError(err.message || "Signup failed. Please try again.");
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!profileDraft.name.trim()) {
      setProfileError("Full Name is required.");
      return;
    }
    if (!profileDraft.username.trim()) {
      setProfileError("Username is required.");
      return;
    }
    if (!profileDraft.email.trim()) {
      setProfileError("Email is required.");
      return;
    }

    const updated = {
      ...profile,
      name: profileDraft.name.trim(),
      username: profileDraft.username.trim(),
      email: profileDraft.email.trim(),
      dateOfBirth: profileDraft.dateOfBirth || "",
      gender: profileDraft.gender || "",
      phone: profileDraft.phone || "",
      bio: profileDraft.bio || "",
      course: profileDraft.course || "",
      college: profileDraft.college || "",
      branch: profileDraft.branch || "",
      semester: profileDraft.semester || "",
      graduationYear: profileDraft.graduationYear || "",
      avatarUrl: profile.avatarUrl || "",
    };

    try {
      localStorage.setItem("studyflow-profile", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving profile:", err);
    }

    setProfile(updated);
    setEditingProfile(false);
    setProfileError("");
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setProfileError("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Image size must be less than 5MB.");
      return;
    }

    setProfileError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        setProfile((prev) => {
          const updated = { ...prev, avatarUrl: dataUrl };
          try {
            localStorage.setItem("studyflow-profile", JSON.stringify(updated));
          } catch (err) {
            console.warn("Storage error for profile avatar:", err);
          }
          return updated;
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => {
      const updated = { ...prev, avatarUrl: "" };
      try {
        localStorage.setItem("studyflow-profile", JSON.stringify(updated));
      } catch (err) {
        console.warn("Storage error removing profile avatar:", err);
      }
      return updated;
    });
    setProfileError("");
  };

  const openNewFolderModal = () => {
    setNewFolderName("");
    setSelectedFolderEmoji("📚");
    setIsEmojiCustomized(false);
    setShowNewFolderModal(true);
  };

  const handleFolderNameChange = (e) => {
    const val = e.target.value;
    setNewFolderName(val);
    if (!isEmojiCustomized) {
      setSelectedFolderEmoji(getSuggestedFolderEmoji(val));
    }
  };

  const handleSelectEmoji = (emoji) => {
    setSelectedFolderEmoji(emoji);
    setIsEmojiCustomized(true);
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const colors = ["#E3F2EC", "#FCE4E8", "#E3EEFF", "#FCE8D8", "#E8ECF8", "#FFF3DE"];
    const emoji = selectedFolderEmoji || getSuggestedFolderEmoji(newFolderName);
    const newFolder = {
      id: crypto.randomUUID(),
      subject: newFolderName.trim(),
      count: 0,
      icon: emoji,
      color: colors[notes.length % colors.length],
      notesList: [],
      materialsList: [],
    };
    const updated = [...notes, newFolder];
    setNotes(updated);
    try {
      localStorage.setItem("studyflow-notes", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving notes:", err);
    }
    setNewFolderName("");
    setSelectedFolderEmoji("📚");
    setIsEmojiCustomized(false);
    setShowNewFolderModal(false);
  };

  const handleAddNoteToFolder = (folderId, noteText) => {
    if (!noteText.trim()) return;
    const updated = notes.map((f) => {
      if (f.id === folderId) {
        const list = Array.isArray(f.notesList) ? f.notesList : [];
        const newNote = {
          id: crypto.randomUUID(),
          text: noteText.trim(),
          createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
        const nextList = [newNote, ...list];
        return { ...f, count: (f.count || 0) + 1, notesList: nextList };
      }
      return f;
    });
    setNotes(updated);
    try {
      localStorage.setItem("studyflow-notes", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving notes:", err);
    }
    if (openedFolder && openedFolder.id === folderId) {
      const updatedFolder = updated.find((f) => f.id === folderId);
      if (updatedFolder) setOpenedFolder(updatedFolder);
    }
    setNewNoteText("");
  };

  const handleDeleteNote = (folderId, noteId) => {
    const updated = notes.map((f) => {
      if (f.id === folderId) {
        const list = (f.notesList || []).filter((n) => n.id !== noteId);
        return { ...f, notesList: list };
      }
      return f;
    });
    setNotes(updated);
    try {
      localStorage.setItem("studyflow-notes", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving notes:", err);
    }
    if (openedFolder && openedFolder.id === folderId) {
      const updatedFolder = updated.find((f) => f.id === folderId);
      if (updatedFolder) setOpenedFolder(updatedFolder);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !openedFolder) return;

    setIsUploadingMaterial(true);
    setMaterialUploadError("");

    try {
      const fileId = crypto.randomUUID();
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name);
      const category = isPdf ? "pdf" : isImage ? "image" : "document";

      const metadata = {
        name: file.name,
        type: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
        size: file.size,
        uploadedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        category,
        folderId: openedFolder.id,
      };

      await saveMaterialBlob(fileId, openedFolder.id, file, metadata);

      const newMaterialItem = {
        id: fileId,
        ...metadata,
      };

      const updated = notes.map((f) => {
        if (f.id === openedFolder.id) {
          const materials = Array.isArray(f.materialsList) ? f.materialsList : [];
          return {
            ...f,
            materialsList: [newMaterialItem, ...materials],
          };
        }
        return f;
      });

      setNotes(updated);
      try {
        localStorage.setItem("studyflow-notes", JSON.stringify(updated));
      } catch (err) {
        console.warn("Error saving notes:", err);
      }

      const updatedFolder = updated.find((f) => f.id === openedFolder.id);
      if (updatedFolder) setOpenedFolder(updatedFolder);
    } catch (err) {
      console.error("Error uploading file:", err);
      setMaterialUploadError("Failed to store file. Please try again.");
    } finally {
      setIsUploadingMaterial(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteMaterial = async (folderId, materialId) => {
    try {
      await deleteMaterialBlob(materialId);
    } catch (err) {
      console.warn("Error deleting material blob:", err);
    }

    const updated = notes.map((f) => {
      if (f.id === folderId) {
        const materials = (f.materialsList || []).filter((m) => m.id !== materialId);
        return { ...f, materialsList: materials };
      }
      return f;
    });

    setNotes(updated);
    try {
      localStorage.setItem("studyflow-notes", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving notes:", err);
    }

    if (openedFolder && openedFolder.id === folderId) {
      const updatedFolder = updated.find((f) => f.id === folderId);
      if (updatedFolder) setOpenedFolder(updatedFolder);
    }
  };

  const handleViewPdf = async (material) => {
    try {
      const record = await getMaterialBlob(material.id);
      if (record && record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        setViewingPdf({
          name: material.name,
          url: blobUrl,
          size: material.size,
        });
      } else {
        alert("PDF could not be loaded from storage.");
      }
    } catch (err) {
      console.error("Error opening PDF:", err);
      alert("Error opening PDF: " + err.message);
    }
  };

  const handleClosePdf = () => {
    if (viewingPdf?.url) {
      URL.revokeObjectURL(viewingPdf.url);
    }
    setViewingPdf(null);
  };

  const handlePreviewImage = async (material) => {
    try {
      const record = await getMaterialBlob(material.id);
      if (record && record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        setPreviewImage({
          name: material.name,
          url: blobUrl,
          size: material.size,
        });
      } else {
        alert("Image could not be loaded from storage.");
      }
    } catch (err) {
      console.error("Error loading image preview:", err);
      alert("Error loading image: " + err.message);
    }
  };

  const handleCloseImage = () => {
    if (previewImage?.url) {
      URL.revokeObjectURL(previewImage.url);
    }
    setPreviewImage(null);
  };

  const handleDownloadMaterial = async (material) => {
    try {
      const record = await getMaterialBlob(material.id);
      if (record && record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = material.name || "study-material";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        alert("File could not be found for download.");
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Error downloading file: " + err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginPin.length !== 4) {
      setAuthError("Please enter your 4-digit PIN.");
      return;
    }

    let backendUser = null;
    const nameToUse = (auth?.name || profile?.name || "Student").trim();
    let emailToUse = (auth?.email || profile?.email || "").trim().toLowerCase();
    if (!emailToUse) {
      emailToUse = `${nameToUse.toLowerCase().replace(/[^a-z0-9]/g, "") || "student"}@studyflow.local`;
    }

    try {
      const res = await api.auth.login({ email: emailToUse, pin: loginPin });
      if (res && res.token) {
        backendUser = res.user;
      }
    } catch (apiErr) {
      console.warn("Backend login attempt:", apiErr);
      if (apiErr.status === 401 && auth && loginPin === auth.pin) {
        try {
          const signupRes = await api.auth.signup({
            name: nameToUse,
            email: emailToUse,
            pin: loginPin,
          });
          if (signupRes && signupRes.token) {
            backendUser = signupRes.user;
          }
        } catch (signupErr) {
          console.warn("Provisioning on login deferred:", signupErr);
        }
      } else if (apiErr.status === 401) {
        setAuthError(apiErr.message || "Incorrect PIN. Please try again.");
        return;
      }
    }

    if (!backendUser) {
      if (!auth || loginPin !== auth.pin) {
        setAuthError("Incorrect PIN. Please try again.");
        return;
      }
    }

    const updated = {
      ...(auth || {}),
      id: backendUser?.id || auth?.id || crypto.randomUUID(),
      name: backendUser?.name || auth?.name || nameToUse,
      email: backendUser?.email || auth?.email || emailToUse,
      pin: loginPin,
      isLoggedIn: true,
    };

    try {
      localStorage.setItem("studyflow-auth", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error updating auth on login:", err);
    }

    setAuth(updated);
    setLoginPin("");
    setAuthError("");
    await performSafeMigration(updated.id || updated.email);
  };

  const handleLogout = () => {
    api.setToken("");
    const updated = { ...(auth || {}), isLoggedIn: false };
    try {
      localStorage.setItem("studyflow-auth", JSON.stringify(updated));
    } catch (err) {
      console.warn("Error updating auth on logout:", err);
    }
    setAuth(updated);
    setAuthView("login");
    setLoginPin("");
    setAuthError("");
  };

  const switchToSignup = () => {
    setAuthError("");
    setSignupPin("");
    setSignupConfirmPin("");
    setLoginPin("");
    setAuthView("signup");
  };

  const switchToLogin = () => {
    setAuthError("");
    setSignupPin("");
    setSignupConfirmPin("");
    setLoginPin("");
    setAuthView("login");
  };

  if (!auth || !auth.isLoggedIn) {
    return (
      <div
        className={`app auth-wrapper ${darkTheme ? "sf-dark" : ""} ${settings.themeStyle === "Gradient" ? "sf-gradient" : "sf-solid"}`}
        style={{
          "--primary-color": settings.primary,
          "--secondary-color": settings.secondary,
          "--accent-gradient": `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`,
          "--theme-accent": settings.themeStyle === "Gradient"
            ? `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`
            : settings.primary,
          "--sf-primary": settings.primary,
          "--sf-secondary": settings.secondary,
          "--sf-accent": settings.themeStyle === "Gradient"
            ? `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`
            : settings.primary,
        }}
      >
        <main className="auth-page">
          <div className="auth-card">
            <div className="auth-header">
              <span className="logo-leaf-icon" aria-hidden="true">🌿</span>
              <div className="logo-brand-block">
                <h1 className="auth-brand">StudyFlow</h1>
                <span className="logo-tagline">Plan • Focus • Grow</span>
              </div>
            </div>

            <div className="auth-sprig-quote">
              <p>“discipline today creates the freedom tomorrow ♡”</p>
            </div>

            {authView === "signup" ? (
              <form className="auth-form" onSubmit={handleSignup} noValidate>
                <h2 className="auth-title">Create your StudyFlow account</h2>
                <p className="auth-subtitle">Start organizing your study sessions with focus and calm.</p>

                {authError && <div className="auth-error" role="alert">{authError}</div>}

                <div className="auth-field">
                  <label htmlFor="signup-name">Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Cherry"
                    value={signupName}
                    onChange={(e) => {
                      setSignupName(e.target.value);
                      if (authError) setAuthError("");
                    }}
                    autoComplete="name"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-email">Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    className="auth-input"
                    placeholder="e.g. cherry@studyflow.app"
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      if (authError) setAuthError("");
                    }}
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-pin">4-Digit PIN</label>
                  <input
                    id="signup-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="auth-input auth-pin-input"
                    placeholder="••••"
                    value={signupPin}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setSignupPin(sanitized);
                      if (authError) setAuthError("");
                    }}
                    autoComplete="new-password"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-confirm-pin">Confirm 4-Digit PIN</label>
                  <input
                    id="signup-confirm-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="auth-input auth-pin-input"
                    placeholder="••••"
                    value={signupConfirmPin}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setSignupConfirmPin(sanitized);
                      if (authError) setAuthError("");
                    }}
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" className="auth-button primary-button">
                  Create Account
                </button>

                <div className="auth-switch">
                  <span>Already have an account?</span>{" "}
                  <button type="button" className="auth-switch-button" onClick={switchToLogin}>
                    Log In
                  </button>
                </div>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleLogin} noValidate>
                <h2 className="auth-title">Welcome back!</h2>
                <p className="auth-subtitle">
                  {auth?.name ? `Hi ${auth.name}, enter your 4-digit PIN to access StudyFlow.` : "Enter your 4-digit PIN to access StudyFlow."}
                </p>

                {authError && <div className="auth-error" role="alert">{authError}</div>}

                <div className="auth-field">
                  <label htmlFor="login-pin">4-Digit PIN</label>
                  <input
                    id="login-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="auth-input auth-pin-input"
                    placeholder="••••"
                    value={loginPin}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setLoginPin(sanitized);
                      if (authError) setAuthError("");
                    }}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>

                <button type="submit" className="auth-button primary-button">
                  Log In
                </button>

                <div className="auth-switch">
                  <span>Need a new account?</span>{" "}
                  <button type="button" className="auth-switch-button" onClick={switchToSignup}>
                    Sign Up
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    );
  }
  return (
    <div
      className={`app ${darkTheme ? "sf-dark" : ""} ${settings.compactMode ? "sf-compact" : ""} ${settings.themeStyle === "Gradient" ? "sf-gradient" : "sf-solid"}`}
      style={{
        "--primary-color": settings.primary,
        "--secondary-color": settings.secondary,
        "--accent-gradient": `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`,
        "--theme-accent": settings.themeStyle === "Gradient"
          ? `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`
          : settings.primary,
        "--sf-primary": settings.primary,
        "--sf-secondary": settings.secondary,
        "--sf-accent": settings.themeStyle === "Gradient"
          ? `linear-gradient(135deg, ${settings.primary}, ${settings.secondary})`
          : settings.primary,
      }}
    >
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          <div
            className="logo"
            onClick={isSidebarCollapsed ? toggleSidebar : undefined}
            style={{ cursor: isSidebarCollapsed ? "pointer" : "default" }}
            title={isSidebarCollapsed ? "Click to expand sidebar" : undefined}
          >
            <span className="logo-leaf-icon" aria-hidden="true">🌿</span>
            <div className="logo-brand-block">
              <h2>StudyFlow</h2>
              <span className="logo-tagline">Plan • Focus • Grow</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="toggle-icon">{isSidebarCollapsed ? "❯" : "❮"}</span>
          </button>
        </div>

        <nav className="nav-menu">
          <button
            type="button"
            className={`nav-item ${activePage === "Dashboard" ? "active" : ""}`}
            onClick={() => setActivePage("Dashboard")}
            title="Home"
            aria-label="Home"
          >
            <span className="nav-icon"><Icons.Home /></span>
            <span className="nav-label">Home</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "My Tasks" ? "active" : ""}`}
            onClick={() => setActivePage("My Tasks")}
            title="My Tasks"
            aria-label="My Tasks"
          >
            <span className="nav-icon"><Icons.Tasks /></span>
            <span className="nav-label">My Tasks</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Calendar" ? "active" : ""}`}
            onClick={() => setActivePage("Calendar")}
            title="Calendar"
            aria-label="Calendar"
          >
            <span className="nav-icon"><Icons.Calendar /></span>
            <span className="nav-label">Calendar</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Pomodoro" ? "active" : ""}`}
            onClick={() => setActivePage("Pomodoro")}
            title="Focus"
            aria-label="Focus"
          >
            <span className="nav-icon"><Icons.Focus /></span>
            <span className="nav-label">Focus</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Notes" ? "active" : ""}`}
            onClick={() => setActivePage("Notes")}
            title="Notes"
            aria-label="Notes"
          >
            <span className="nav-icon"><Icons.Notes /></span>
            <span className="nav-label">Notes</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Goals" ? "active" : ""}`}
            onClick={() => setActivePage("Goals")}
            title="Goals"
            aria-label="Goals"
          >
            <span className="nav-icon"><Icons.Goals /></span>
            <span className="nav-label">Goals</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Progress" ? "active" : ""}`}
            onClick={() => setActivePage("Progress")}
            title="Progress"
            aria-label="Progress"
          >
            <span className="nav-icon"><Icons.Progress /></span>
            <span className="nav-label">Progress</span>
          </button>

          <div className="sidebar-nav-divider" />

          <button
            type="button"
            className={`nav-item ${activePage === "Profile" ? "active" : ""}`}
            onClick={() => setActivePage("Profile")}
            title="Profile"
            aria-label="Profile"
          >
            <span className="nav-icon"><Icons.Profile /></span>
            <span className="nav-label">Profile</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === "Settings" ? "active" : ""}`}
            onClick={() => setActivePage("Settings")}
            title="Settings"
            aria-label="Settings"
          >
            <span className="nav-icon"><Icons.Settings /></span>
            <span className="nav-label">Settings</span>
          </button>
        </nav>

        <div className="sidebar-actions">
          <button
            type="button"
            className="nav-item sidebar-logout-btn"
            onClick={handleLogout}
            title="Log Out"
            aria-label="Log Out"
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Log Out</span>
          </button>
        </div>

        <div className="sidebar-bottom" title={dailyMotivation}>
          <p className="keep-going-title">
            <span className="keep-going-text">{sidebarMotivation.line1}</span>
            <span className="keep-going-icon">{sidebarMotivation.icon}</span>
          </p>
          <span className="keep-going-sub">{sidebarMotivation.line2}</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activePage === "Dashboard" && (
          <div className="ref-dashboard-view">
            {/* Header: greeting on left, search + notifications + avatar + sprig on right */}
            <header className="ref-dashboard-header">
              <div className="ref-greeting-block">
                <h1 className="ref-greeting-title">Hi, {profile.name || auth?.name || "Shravani"}! 👋</h1>
                <p className="ref-greeting-subtitle">You're doing great! Keep showing up 💜</p>
              </div>

              <div className="ref-header-controls">
                <div className="ref-search-bar">
                  <Icons.Search />
                  <input
                    type="text"
                    placeholder="Search tasks, notes, subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="notification-wrapper">
                  <button
                    className="ref-icon-button"
                    onClick={() => setShowNotifications((current) => !current)}
                    title="Notifications"
                    type="button"
                  >
                    <Icons.Bell />
                    {notifications.some((notification) => !notification.read) && (
                      <span className="ref-notification-dot" />
                    )}
                  </button>

                  {showNotifications && (
                    <div className="notification-dropdown">
                      <div className="notification-dropdown-header">
                        <div>
                          <h3>Notifications</h3>
                          <span>
                            {notifications.filter((notification) => !notification.read).length} unread
                          </span>
                        </div>

                        {notifications.some((notification) => !notification.read) && (
                          <button
                            type="button"
                            className="mark-all-read"
                            onClick={() => {
                              setNotifications((current) =>
                                current.map((notification) => ({
                                  ...notification,
                                  read: true,
                                }))
                              );
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="notification-list">
                        {notifications.length === 0 ? (
                          <div className="notification-empty">
                            <span>🔔</span>
                            <strong>No notifications yet</strong>
                            <p>Your StudyFlow reminders and updates will appear here.</p>
                          </div>
                        ) : (
                          notifications.slice(0, 5).map((notification) => (
                            <button
                              type="button"
                              className={`notification-item ${notification.read ? "read" : "unread"}`}
                              key={notification.id}
                              onClick={() => {
                                setNotifications((current) =>
                                  current.map((item) =>
                                    item.id === notification.id ? { ...item, read: true } : item
                                  )
                                );
                              }}
                            >
                              <div className="notification-item-icon">
                                {getNotificationIcon(notification)}
                              </div>

                              <div className="notification-item-content">
                                <strong>{notification.title}</strong>
                                <p>{notification.message}</p>
                                <small>{new Date(notification.time).toLocaleString()}</small>
                              </div>

                              {!notification.read && <span className="notification-unread-dot" />}
                            </button>
                          ))
                        )}
                      </div>

                      <button
                        type="button"
                        className="view-all-notifications"
                        onClick={() => {
                          setShowNotifications(false);
                          setNotificationFilter("All");
                          setActivePage("Notifications");
                        }}
                      >
                        View all notifications →
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="ref-avatar-pill"
                  onClick={() => setActivePage("Profile")}
                  title="View Profile"
                >
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="ref-avatar-pill-img" />
                  ) : (
                    (profile.name || auth?.name || "SA").slice(0, 2).toUpperCase()
                  )}
                </button>

                <span className="ref-header-sprig" aria-hidden="true">
                  <Icons.Leaf />
                </span>
              </div>
            </header>

            {/* 4 Summary Cards */}
            <section className="ref-summary-grid">
              <div className="ref-stat-card stat-tasks" onClick={() => setActivePage("My Tasks")}>
                <div className="ref-stat-icon-badge badge-tasks">
                  <Icons.Tasks />
                </div>
                <div className="ref-stat-info">
                  <span className="ref-stat-label">Today's Tasks</span>
                  <h2 className="ref-stat-number">{todaysTasks.length}</h2>
                  <span className="ref-stat-sub">
                    {todaysTasks.filter((t) => t.completed).length} completed ›
                  </span>
                </div>
              </div>

              <div className="ref-stat-card stat-focus" onClick={() => setActivePage("Pomodoro")}>
                <div className="ref-stat-icon-badge badge-focus">
                  <Icons.Focus />
                </div>
                <div className="ref-stat-info">
                  <span className="ref-stat-label">Focus Time</span>
                  <h2 className="ref-stat-number">{Math.floor(sessionsCompleted * 25 / 60)}h {(sessionsCompleted * 25) % 60}m</h2>
                  <span className="ref-stat-sub">of 2h goal ›</span>
                </div>
              </div>

              <div className="ref-stat-card stat-completed" onClick={() => setActivePage("My Tasks")}>
                <div className="ref-stat-icon-badge badge-completed">✓</div>
                <div className="ref-stat-info">
                  <span className="ref-stat-label">Completed</span>
                  <h2 className="ref-stat-number">{completedTasks}</h2>
                  <span className="ref-stat-sub">this week ›</span>
                </div>
              </div>

              <div className="ref-stat-card stat-progress" onClick={() => setActivePage("Progress")}>
                <div className="ref-stat-icon-badge badge-progress">
                  <Icons.Progress />
                </div>
                <div className="ref-stat-info">
                  <span className="ref-stat-label">Progress</span>
                  <h2 className="ref-stat-number">{progressPercentage}% ↑</h2>
                  <span className="ref-stat-sub">↗ 10% from last week ›</span>
                </div>
              </div>
            </section>

            {/* Two-Column Main Content: Today's Tasks (left) and Focus/Pomodoro (right) */}
            <section className="ref-dashboard-main-columns">
              {/* Today's Tasks */}
              <div className="ref-card ref-today-tasks-card">
                <div className="ref-card-header">
                  <div className="ref-header-left">
                    <h2>Today's Tasks</h2>
                    <div className="ref-filter-pills">
                      {["All", "High", "Medium", "Low"].map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={`ref-filter-pill ${taskFilter === filter ? "active" : ""}`}
                          onClick={() => setTaskFilter(filter)}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ref-header-right">
                    <button
                      type="button"
                      className="ref-link-btn"
                      onClick={() => setActivePage("My Tasks")}
                    >
                      View All →
                    </button>
                    <button
                      type="button"
                      className="ref-primary-pill-btn"
                      onClick={() => {
                        setShowTaskForm(true);
                        setActivePage("My Tasks");
                      }}
                    >
                      + Add Task
                    </button>
                  </div>
                </div>

                <div className="ref-task-list">
                  {todaysTasks
                    .filter((t) => taskFilter === "All" || t.priority === taskFilter)
                    .map((task) => (
                      <div className={`ref-task-row ${task.completed ? "completed" : ""}`} key={task.id}>
                        <button
                          type="button"
                          className={`ref-circular-check ${task.completed ? "checked" : ""}`}
                          onClick={() => toggleTask(task.id)}
                          aria-label={`Toggle ${task.name}`}
                        >
                          {task.completed && "✓"}
                        </button>
                        <div className="ref-task-titles">
                          <strong className="ref-task-name">{task.name}</strong>
                          <span className="ref-task-sub">{task.subject || "Study Session"}</span>
                        </div>
                        <span
                          className="ref-subject-pill"
                          style={{
                            background: getSubjectColor(task.subject),
                          }}
                        >
                          {task.subject ? task.subject.slice(0, 3).toUpperCase() : "GEN"}
                        </span>
                        <span className={`ref-priority-pill priority-${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <span className="ref-task-time">
                          {task.dueTime ? formatTimeDisplay(task.dueTime) : "10:00 AM"}
                        </span>
                        <button
                          type="button"
                          className="ref-dot-menu-btn"
                          onClick={() => deleteTask(task.id)}
                          title="Delete Task"
                        >
                          <Icons.MoreVertical />
                        </button>
                      </div>
                    ))}
                  {todaysTasks.length === 0 && (
                    <p className="ref-empty-state">No tasks scheduled for today. Tap "+ Add Task" to plan one! 🌸</p>
                  )}
                </div>
              </div>

              {/* Right Column: Focus / Pomodoro Mini Card + Motivational Doodle Note */}
              <div className="ref-dashboard-right-column">
                <div className="ref-card ref-pomodoro-mini-card">
                  <div className="ref-card-header">
                    <h2>Focus / Pomodoro</h2>
                  </div>
                  <div className="ref-mode-pills">
                    <button
                      type="button"
                      className={`ref-mode-pill ${!isBreak ? "active" : ""}`}
                      onClick={() => {
                        setIsBreak(false);
                        setTimeLeft(FOCUS_SECONDS);
                        setIsRunning(false);
                      }}
                    >
                      Pomodoro
                    </button>
                    <button
                      type="button"
                      className={`ref-mode-pill ${isBreak && timeLeft <= BREAK_SECONDS ? "active" : ""}`}
                      onClick={() => {
                        setIsBreak(true);
                        setTimeLeft(BREAK_SECONDS);
                        setIsRunning(false);
                      }}
                    >
                      Short Break
                    </button>
                    <button
                      type="button"
                      className={`ref-mode-pill ${isBreak && timeLeft > BREAK_SECONDS ? "active" : ""}`}
                      onClick={() => {
                        setIsBreak(true);
                        setTimeLeft(15 * 60);
                        setIsRunning(false);
                      }}
                    >
                      Long Break
                    </button>
                  </div>

                  <div className="ref-pomo-timer-center">
                    <div className="ref-pomo-ring-container">
                      <svg className="ref-pomo-svg" viewBox="0 0 160 160">
                        <circle className="ref-pomo-track" cx="80" cy="80" r="68" />
                        <circle
                          className="ref-pomo-progress"
                          cx="80"
                          cy="80"
                          r="68"
                          style={{
                            strokeDasharray: 427,
                            strokeDashoffset:
                              427 - (427 * (timeLeft / (isBreak ? BREAK_SECONDS : FOCUS_SECONDS))),
                          }}
                        />
                      </svg>
                      <div className="ref-pomo-inner-text">
                        <span className="ref-pomo-digits">
                          {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                          {String(timeLeft % 60).padStart(2, "0")}
                        </span>
                        <span className="ref-pomo-label">{isBreak ? "Break Time" : "Focus Time"}</span>
                        <span className="ref-pomo-cheer">You got this! ♡</span>
                      </div>
                    </div>

                    <div className="ref-pomo-quote-doodle">
                      <span className="ref-doodle-sparkle">✦</span>
                      <p className="ref-doodle-text">"Good Focus, Brighter Days!"</p>
                    </div>
                  </div>

                  <div className="ref-pomo-controls">
                    <button
                      type="button"
                      className="ref-primary-pill-btn ref-pomo-start-btn"
                      onClick={() => {
                        setShowCelebration(false);
                        if (timeLeft === 0) {
                          setTimeLeft(FOCUS_SECONDS);
                          setIsBreak(false);
                          setCurrentSession(1);
                          setIsCompleted(false);
                        }
                        setIsRunning(!isRunning);
                      }}
                    >
                      {isRunning ? "⏸ Pause" : "▶ Start"}
                    </button>

                    <button
                      type="button"
                      className="ref-icon-btn"
                      onClick={() => {
                        setIsRunning(false);
                        setIsBreak(false);
                        setTimeLeft(FOCUS_SECONDS);
                        setIsCompleted(false);
                      }}
                      title="Reset Timer"
                    >
                      <Icons.Settings />
                    </button>
                  </div>
                </div>

                {settings.showMotivation && (
                  <div className="motivation-card dashboard-doodle-note">
                    <div className="doodle-note-header">
                      <span className="doodle-pin">📌</span>
                      <span className="doodle-caption">today's note</span>
                      <span className="doodle-sparkle">✨</span>
                    </div>

                    <p className="doodle-note-content">
                      "{dailyMotivation}"
                    </p>

                    <div className="doodle-note-footer">
                      <span className="doodle-flower">🌸</span>
                      <span className="doodle-heart">♡</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Bottom Row: Weekly Study Activity & Upcoming Tasks */}
            <section className="ref-dashboard-bottom-columns">
              {/* Weekly Study Activity */}
              <div className="ref-card ref-weekly-card">
                <div className="ref-card-header">
                  <h2>Weekly Study Activity</h2>
                  <span className="ref-dropdown-tag">This Week ⌵</span>
                </div>
                <div className="ref-weekly-content">
                  <div className="ref-weekly-bars">
                    {weeklyStudyActivity.map((day) => (
                      <div className="ref-bar-col" key={day.day}>
                        <div className="ref-bar-track">
                          <div
                            className={`ref-bar-fill ${day.hours === 0 ? "empty" : ""}`}
                            style={{
                              height: `${Math.max(12, Math.min(100, Math.round((day.hours / maxWeeklyHours) * 100)))}%`,
                            }}
                          />
                        </div>
                        <span className={`ref-bar-day-name ${day.isToday ? "today" : ""}`}>
                          {day.day}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="ref-weekly-legend">
                    {tasks.slice(0, 5).map((t, idx) => {
                      const colors = ["#8B83E8", "#E27396", "#48A999", "#5C7CFA", "#F08C65"];
                      return (
                        <div className="ref-legend-item" key={t.id || idx}>
                          <span className="ref-legend-dot" style={{ background: colors[idx % colors.length] }} />
                          <span className="ref-legend-name">{t.subject || t.name}</span>
                          <span className="ref-legend-hours">{t.dueTime ? `⏰ ${formatTimeDisplay(t.dueTime)}` : "1h 30m"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Upcoming Tasks */}
              <div className="ref-card ref-upcoming-card">
                <div className="ref-card-header">
                  <h2>Upcoming Tasks</h2>
                  <button
                    type="button"
                    className="ref-link-btn"
                    onClick={() => setActivePage("My Tasks")}
                  >
                    View All →
                  </button>
                </div>
                <div className="ref-upcoming-list">
                  {upcomingTasks.slice(0, 3).map((task) => {
                    const dateParts = String(task.dueDate || today).split("-");
                    const dayNum = dateParts[2] || "22";
                    const monthName = "Sep";
                    return (
                      <div className="ref-upcoming-row" key={task.id}>
                        <div className="ref-date-box">
                          <span className="ref-date-day">{dayNum}</span>
                          <span className="ref-date-mo">{monthName}</span>
                        </div>
                        <div className="ref-upcoming-info">
                          <strong className="ref-upcoming-title">{task.name}</strong>
                          <span className="ref-upcoming-sub">{task.subject || "Study Session"}</span>
                        </div>
                        <span className={`ref-priority-pill priority-${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <button
                          type="button"
                          className="ref-dot-menu-btn"
                          onClick={() => deleteTask(task.id)}
                          title="Delete Task"
                        >
                          <Icons.MoreVertical />
                        </button>
                      </div>
                    );
                  })}
                  {upcomingTasks.length === 0 && (
                    <p className="ref-empty-state">No upcoming tasks. You are all caught up! ✨</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
        {activePage === "Pomodoro" && (
          <section className="pomodoro-page ref-focus-page">
            <div className="page-title">
              <div>
                <p className="page-eyebrow">🍅 TIME TO LOCK IN</p>
                <h1>Focus</h1>
                <p>Pick your time, press start, and let the rest wait.</p>
                <div className="study-duration">
                  <label>How long are you locking in?</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={studyHours}
                    onChange={(e) => {
                      const hours = Number(e.target.value);
                      setStudyHours(hours);
                      setIsRunning(false);
                      setIsCompleted(false);
                      setIsBreak(false);
                      setCurrentSession(1);
                      setTimeLeft(FOCUS_SECONDS);
                      setShowCelebration(false);
                    }}
                  />
                  <span>hrs</span>
                </div>
              </div>
            </div>

            <div className="ref-focus-main-container">
              {showCelebration && (
                <div className="celebration-container">
                  <div className="confetti-container" aria-hidden="true">
                    {CONFETTI_PIECES.map((piece) => (
                      <span
                        key={piece.id}
                        className="confetti-piece"
                        style={{
                          left: `${piece.left}%`,
                          backgroundColor: piece.color,
                          animationDelay: `${piece.delay}s`,
                          animationDuration: `${piece.duration}s`,
                          transform: `rotate(${piece.rotate}deg)`,
                          width: `${piece.size}px`,
                          height: `${piece.size * 0.6}px`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="celebration-banner">
                    <div className="celebration-headline">
                      <span className="celebration-party-icon" role="img" aria-label="party">🎉</span>
                      <span className="celebration-text">{studyHours} {studyHours === 1 ? "HOUR" : "HOURS"} COMPLETE!</span>
                      <span className="celebration-party-icon" role="img" aria-label="party">🎉</span>
                    </div>
                    <p className="celebration-subtext">
                      You successfully locked in for {studyHours} hr! Fantastic dedication.
                    </p>
                    <button
                      type="button"
                      className="celebration-dismiss-btn"
                      onClick={() => setShowCelebration(false)}
                    >
                      Awesome! 🚀
                    </button>
                  </div>
                </div>
              )}

              <div className="ref-mode-pills ref-focus-modes">
                <button
                  type="button"
                  className={`ref-mode-pill ${!isBreak ? "active" : ""}`}
                  onClick={() => {
                    setIsBreak(false);
                    setTimeLeft(FOCUS_SECONDS);
                    setIsRunning(false);
                  }}
                >
                  Pomodoro (25m)
                </button>
                <button
                  type="button"
                  className={`ref-mode-pill ${isBreak && timeLeft <= BREAK_SECONDS ? "active" : ""}`}
                  onClick={() => {
                    setIsBreak(true);
                    setTimeLeft(BREAK_SECONDS);
                    setIsRunning(false);
                  }}
                >
                  Short Break (5m)
                </button>
                <button
                  type="button"
                  className={`ref-mode-pill ${isBreak && timeLeft > BREAK_SECONDS ? "active" : ""}`}
                  onClick={() => {
                    setIsBreak(true);
                    setTimeLeft(15 * 60);
                    setIsRunning(false);
                  }}
                >
                  Long Break (15m)
                </button>
              </div>

              <div className="ref-pomo-timer-center ref-focus-timer-large">
                <div className="ref-pomo-ring-container large-ring">
                  <svg className="ref-pomo-svg" viewBox="0 0 220 220">
                    <circle className="ref-pomo-track" cx="110" cy="110" r="95" />
                    <circle
                      className="ref-pomo-progress"
                      cx="110"
                      cy="110"
                      r="95"
                      style={{
                        strokeDasharray: 597,
                        strokeDashoffset:
                          597 - (597 * (timeLeft / (isBreak ? BREAK_SECONDS : FOCUS_SECONDS))),
                      }}
                    />
                  </svg>
                  <div className="ref-pomo-inner-text">
                    <span className="ref-pomo-digits large-digits">
                      {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                      {String(timeLeft % 60).padStart(2, "0")}
                    </span>
                    <span className="ref-pomo-label">{isBreak ? "Break Time" : "Focus Time"}</span>
                    <span className="ref-pomo-cheer">You got this! ♡</span>
                  </div>
                </div>

                <div className="ref-pomo-quote-doodle">
                  <span className="ref-doodle-sparkle">✦</span>
                  <p className="ref-doodle-text">"Good Focus, Brighter Days!"</p>
                </div>
              </div>

              <div className="ref-pomo-controls ref-focus-controls">
                <button
                  type="button"
                  className="ref-primary-pill-btn ref-pomo-start-btn"
                  onClick={() => {
                    setShowCelebration(false);
                    if (timeLeft === 0) {
                      setTimeLeft(FOCUS_SECONDS);
                      setIsBreak(false);
                      setCurrentSession(1);
                      setIsCompleted(false);
                    }
                    setIsRunning(!isRunning);
                  }}
                >
                  {isRunning ? "⏸ Pause" : "▶ Start"}
                </button>

                <button
                  type="button"
                  className="ref-icon-btn"
                  onClick={() => {
                    setIsRunning(false);
                    setIsCompleted(false);
                    setIsBreak(false);
                    setCurrentSession(1);
                    setTimeLeft(FOCUS_SECONDS);
                    setShowCelebration(false);
                  }}
                  title="Reset Timer"
                >
                  ↺
                </button>
              </div>

              <p className="session-count">
                Sessions completed: {sessionsCompleted}
              </p>
            </div>
          </section>
        )}

        {activePage === "Notes" && (
          <section className="ref-notes-page">
            <div className="page-title ref-notes-title-bar">
              <div>
                <p className="page-eyebrow">📚 KNOWLEDGE BASE</p>
                <h1>Notes</h1>
                <p className="ref-greeting-subtitle">Your personal knowledge garden 🌿 Organized by subjects.</p>
              </div>
              <div className="ref-notes-top-actions">
                <div className="ref-search-bar">
                  <Icons.Search />
                  <input
                    type="text"
                    placeholder="Search notes, subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="ref-primary-pill-btn"
                  onClick={openNewFolderModal}
                >
                  + New Folder
                </button>
              </div>
            </div>

            <div className="ref-notes-grid">
              {notes
                .filter((folder) =>
                  !searchQuery ||
                  folder.subject.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((folder) => (
                  <div
                    key={folder.id}
                    className="ref-note-folder-card"
                    style={{
                      borderTop: `4px solid ${folder.color || "#8B83E8"}`,
                    }}
                  >
                    <div className="ref-folder-top">
                      <span className="ref-folder-icon" style={{ background: folder.color || "#E3EEFF" }}>
                        {folder.icon || "📚"}
                      </span>
                      <span className="ref-folder-count">
                        {formatFolderItemCounts(folder)}
                      </span>
                    </div>
                    <h3 className="ref-folder-title">{folder.subject}</h3>
                    <p className="ref-folder-preview">
                      {folder.subject === "Computer Networks" && "Unit 1-4 notes, subnetting cheatsheet, OSI & TCP/IP"}
                      {folder.subject === "Automata Theory" && "CFG, Pushdown Automata, Turing Machines, P vs NP"}
                      {folder.subject === "Web Development" && "React components, hooks, CSS Grid, Express API design"}
                      {folder.subject === "Mathematics 3" && "Fourier transforms, Laplace equations, partial differential equations"}
                      {folder.subject === "Operating Systems" && "Process scheduling algorithms, semaphores, deadlock prevention"}
                      {folder.subject === "DBMS" && "ER diagrams, Normalization (1NF-BCNF), SQL queries, ACID properties"}
                      {!["Computer Networks", "Automata Theory", "Web Development", "Mathematics 3", "Operating Systems", "DBMS"].includes(folder.subject) &&
                        "All lecture notes, quick references, formulas and revisions."}
                    </p>
                    <div className="ref-folder-footer">
                      <span className="ref-folder-edited">Updated recently</span>
                      <button
                        type="button"
                        className="ref-folder-btn"
                        onClick={() => setOpenedFolder(folder)}
                      >
                        Open Folder →
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="ref-notes-footer-note">
              <span className="ref-doodle-sparkle">✦</span>
              <span>"Organize your thoughts, liberate your mind."</span>
            </div>

            {/* Create Folder Modal */}
            {showNewFolderModal && (
              <div className="goal-modal-backdrop" onClick={() => setShowNewFolderModal(false)}>
                <div className="goal-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="goal-modal-header">
                    <h2>Create New Folder</h2>
                    <button type="button" onClick={() => setShowNewFolderModal(false)}>×</button>
                  </div>
                  <form onSubmit={handleCreateFolder}>
                    <label>
                      Folder / Subject Name
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Distributed Systems"
                        value={newFolderName}
                        onChange={handleFolderNameChange}
                        required
                      />
                    </label>

                    {/* Academic Emoji Selector (Parts 6 & 7) */}
                    <div className="folder-emoji-section">
                      <div className="folder-emoji-header">
                        <label>Folder Icon:</label>
                        <span className="selected-emoji-badge">{selectedFolderEmoji}</span>
                      </div>
                      <div className="folder-emoji-picker">
                        {SUGGESTED_EMOJIS_LIST.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            className={`emoji-pick-btn ${selectedFolderEmoji === emoji ? "active" : ""}`}
                            onClick={() => handleSelectEmoji(emoji)}
                            title={`Select ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="goal-modal-actions">
                      <button type="button" onClick={() => setShowNewFolderModal(false)}>Cancel</button>
                      <button type="submit" className="primary-button">Create Folder</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Open Folder Modal (Study Material / Knowledge Base) */}
            {openedFolder && (
              <div className="goal-modal-backdrop" onClick={() => setOpenedFolder(null)}>
                <div className="goal-modal ref-folder-detail-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="goal-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "24px" }}>{openedFolder.icon || "📚"}</span>
                      <div>
                        <h2>{openedFolder.subject}</h2>
                        <span style={{ fontSize: "12px", color: "#8E889B" }}>
                          {formatFolderItemCounts(openedFolder)}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setOpenedFolder(null)}>×</button>
                  </div>

                  {/* Add Actions Bar: Note quick adder + Material upload */}
                  <div className="ref-folder-add-actions-bar">
                    <form
                      className="ref-folder-add-note-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddNoteToFolder(openedFolder.id, newNoteText);
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Add a new note or key takeaway..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                      />
                      <button type="submit" className="primary-button">+ Add Note</button>
                    </form>

                    <div className="ref-folder-upload-wrapper">
                      <input
                        type="file"
                        ref={materialFileInputRef}
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                        accept=".pdf,image/*,.doc,.docx,.txt,.csv,.ppt,.pptx"
                      />
                      <button
                        type="button"
                        className="ref-material-upload-btn"
                        onClick={() => materialFileInputRef.current && materialFileInputRef.current.click()}
                        disabled={isUploadingMaterial}
                      >
                        📎 {isUploadingMaterial ? "Saving Material..." : "+ Add Study Material"}
                      </button>
                    </div>
                  </div>

                  {materialUploadError && (
                    <div className="material-upload-error-pill">{materialUploadError}</div>
                  )}

                  {/* Folder Contents */}
                  <div className="ref-folder-contents-container">
                    {(!openedFolder.notesList || openedFolder.notesList.length === 0) &&
                     (!openedFolder.materialsList || openedFolder.materialsList.length === 0) ? (
                      <div className="ref-folder-empty-notes">
                        <p>No study material here yet.</p>
                        <span>Add lecture notes, PDFs, images, or key insights to build your knowledge base. 📚</span>
                      </div>
                    ) : (
                      <>
                        {/* Uploaded Study Materials (PDFs, Images, Docs) */}
                        {openedFolder.materialsList && openedFolder.materialsList.length > 0 && (
                          <div className="ref-folder-section-block">
                            <div className="ref-folder-section-title">
                              📁 Study Materials ({openedFolder.materialsList.length})
                            </div>
                            <div className="ref-materials-list">
                              {openedFolder.materialsList.map((item) => {
                                const isPdf = item.category === "pdf" || item.name.toLowerCase().endsWith(".pdf");
                                const isImg = item.category === "image" || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.name);
                                return (
                                  <div className="ref-material-item" key={item.id}>
                                    <div className="mat-icon-wrapper">
                                      {isPdf ? (
                                        <span className="mat-icon mat-icon-pdf">📄</span>
                                      ) : isImg ? (
                                        <span className="mat-icon mat-icon-img">🖼️</span>
                                      ) : (
                                        <span className="mat-icon mat-icon-doc">📎</span>
                                      )}
                                    </div>
                                    <div className="mat-info">
                                      <strong className="mat-title" title={item.name}>{item.name}</strong>
                                      <span className="mat-subtitle">
                                        <span className={`mat-badge mat-badge-${item.category || "doc"}`}>
                                          {isPdf ? "PDF" : isImg ? "Image" : "Document"}
                                        </span>
                                        {" • "}
                                        {formatFileSize(item.size)}
                                        {" • "}
                                        {item.uploadedAt}
                                      </span>
                                    </div>
                                    <div className="mat-actions">
                                      {isPdf && (
                                        <button
                                          type="button"
                                          className="mat-btn view-btn"
                                          onClick={() => handleViewPdf(item)}
                                          title="View PDF"
                                        >
                                          👁 View
                                        </button>
                                      )}
                                      {isImg && (
                                        <button
                                          type="button"
                                          className="mat-btn view-btn"
                                          onClick={() => handlePreviewImage(item)}
                                          title="Preview Image"
                                        >
                                          🔍 Preview
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="mat-btn download-btn"
                                        onClick={() => handleDownloadMaterial(item)}
                                        title="Download File"
                                      >
                                        ⬇ Download
                                      </button>
                                      <button
                                        type="button"
                                        className="mat-btn delete-btn"
                                        onClick={() => handleDeleteMaterial(openedFolder.id, item.id)}
                                        title="Delete Material"
                                      >
                                        🗑 Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Lecture Notes */}
                        {openedFolder.notesList && openedFolder.notesList.length > 0 && (
                          <div className="ref-folder-section-block">
                            <div className="ref-folder-section-title">
                              📝 Lecture Notes ({openedFolder.notesList.length})
                            </div>
                            <div className="ref-folder-notes-list">
                              {openedFolder.notesList.map((note) => (
                                <div className="ref-folder-note-item" key={note.id}>
                                  <div className="ref-folder-note-header">
                                    <span className="ref-folder-note-bullet">•</span>
                                    <span className="ref-folder-note-date">{note.createdAt || "Today"}</span>
                                    <button
                                      type="button"
                                      className="mat-btn-icon-delete"
                                      onClick={() => handleDeleteNote(openedFolder.id, note.id)}
                                      title="Delete Note"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                  <p className="ref-folder-note-text">{note.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="goal-modal-actions">
                    <button type="button" onClick={() => setOpenedFolder(null)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Viewer Modal */}
            {viewingPdf && (
              <div className="goal-modal-backdrop pdf-viewer-backdrop" onClick={handleClosePdf} style={{ zIndex: 10000 }}>
                <div className="goal-modal pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="goal-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{ fontSize: "22px" }}>📄</span>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                          {viewingPdf.name}
                        </h2>
                        <span style={{ fontSize: "12px", color: "#8E889B" }}>
                          {formatFileSize(viewingPdf.size)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <button
                        type="button"
                        className="mat-modal-btn"
                        onClick={() => window.open(viewingPdf.url, "_blank")}
                        title="Open in new tab"
                      >
                        ↗ Open in Tab
                      </button>
                      <button
                        type="button"
                        className="mat-modal-btn"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = viewingPdf.url;
                          a.download = viewingPdf.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        title="Download PDF"
                      >
                        ⬇ Download
                      </button>
                      <button type="button" onClick={handleClosePdf} title="Close">×</button>
                    </div>
                  </div>
                  <div className="pdf-iframe-container">
                    <iframe
                      src={viewingPdf.url}
                      title={viewingPdf.name}
                      className="pdf-iframe"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
              <div className="goal-modal-backdrop image-preview-backdrop" onClick={handleCloseImage} style={{ zIndex: 10000 }}>
                <div className="goal-modal image-preview-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="goal-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{ fontSize: "22px" }}>🖼️</span>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                          {previewImage.name}
                        </h2>
                        <span style={{ fontSize: "12px", color: "#8E889B" }}>
                          {formatFileSize(previewImage.size)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <button
                        type="button"
                        className="mat-modal-btn"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = previewImage.url;
                          a.download = previewImage.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        title="Download Image"
                      >
                        ⬇ Download
                      </button>
                      <button type="button" onClick={handleCloseImage} title="Close">×</button>
                    </div>
                  </div>
                  <div className="image-preview-body">
                    <img
                      src={previewImage.url}
                      alt={previewImage.name}
                      className="image-preview-img"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activePage === "Progress" && (
          <section className="progress-page">
            {/* Progress Header */}
            <div className="progress-header">
              <div>
                <p className="progress-greeting">Hey there! 👋</p>
                <h1>Your Progress</h1>
                <p className="progress-doodle-note">
                  <span className="doodle-symbol">✎</span> Consistency today, success tomorrow. <span className="doodle-symbol">✦</span>
                </p>
              </div>

              <select
                className="progress-period"
                value={progressPeriod}
                onChange={(event) => setProgressPeriod(event.target.value)}
              >
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
              </select>
            </div>

            {/* Key Stats */}
            <div className="progress-stats">
              <div className="progress-stat-card">
                <div className="progress-stat-icon">▥</div>
                <div>
                  <span>Study Hours</span>
                  <strong>{selectedProgressData.studyHours} hrs</strong>
                  <small>↑ 20% from last week</small>
                </div>
              </div>

              <div className="progress-stat-card">
                <div className="progress-stat-icon">✓</div>
                <div>
                  <span>Tasks Completed</span>
                  <strong>
                    {selectedProgressData.tasksCompleted} / {selectedProgressData.totalTasks}
                  </strong>
                  <small>{selectedProgressData.taskPercentage}% completed</small>
                </div>
              </div>

              <div className="progress-stat-card">
                <div className="progress-stat-icon">🍅</div>
                <div>
                  <span>Pomodoro Sessions</span>
                  <strong>{selectedProgressData.pomodoroSessions}</strong>
                  <small>↑ 28% from last week</small>
                </div>
              </div>

              <div className="progress-stat-card" title={`Longest streak: ${streakData.longestStreak} days`}>
                <div className="progress-stat-icon">{streakData.currentStreak === 0 ? "🌱" : "🔥"}</div>
                <div>
                  <span>Study Streak</span>
                  <strong>{streakData.currentStreak} {streakData.currentStreak === 1 ? "day" : "days"}</strong>
                  <small>{streakData.currentStreak === 0 ? "Start a streak today! 🌱" : "Keep it going! 🔥"}</small>
                </div>
              </div>
            </div>

            {/* Main Progress Charts */}
            <div className="progress-chart-grid">
              {/* Study Hours */}
              <div className="progress-card study-hours-card">
                <div className="progress-card-title">
                  <h2>Study Hours</h2>
                  <span>{progressPeriod}⌄</span>
                </div>

                <div className="bar-chart">
                  {selectedProgressData.studyHoursBars.map(([label, value]) => (
                    <div className="bar-item" key={label}>
                      <div className="bar" style={{ height: `${value}%` }}></div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Completion */}
              <div className="progress-card task-completion-card">
                <h2>Task Completion</h2>

                <div className="completion-content">
                  <div
                    className="completion-circle"
                    style={{
                      background: `radial-gradient(circle, ${darkTheme ? "#1e192b" : "#fffaff"} 58%, transparent 59%), conic-gradient(var(--primary-color, #8565d6) 0 ${selectedProgressData.taskPercentage}%, ${darkTheme ? "#2e2740" : "color-mix(in srgb, var(--primary-color, #8565d6) 12%, #eee7f7)"} ${selectedProgressData.taskPercentage}% 100%)`,
                    }}
                  >
                    <strong>{selectedProgressData.taskPercentage}%</strong>
                  </div>

                  <div className="completion-legend">
                    <p>
                      <span className="legend-dot completed"></span>
                      Completed <b>{selectedProgressData.tasksCompleted}</b>
                    </p>

                    <p>
                      <span className="legend-dot pending"></span>
                      Pending <b>{selectedProgressData.totalTasks - selectedProgressData.tasksCompleted}</b>
                    </p>

                    <p>
                      <span className="legend-dot overdue"></span>
                      Overdue <b>0</b>
                    </p>
                  </div>
                </div>

                <small>
                  {selectedProgressData.tasksCompleted} of {selectedProgressData.totalTasks} tasks
                </small>
              </div>

              {/* Subjects Breakdown */}
              <div className="progress-card subjects-card">
                <h2>Subjects Breakdown</h2>

                <div className="subjects-content">
                  <div
                    className="subject-pie"
                    style={{ background: subjectPieBackground }}
                  ></div>

                  <div className="subject-legend">
                    {subjectBreakdown.length ? (
                      subjectBreakdown.map(({ key, subject, percentage, color }) => (
                        <p key={key}>
                          <span
                            className="subject-dot"
                            style={{ background: color }}
                          ></span>
                          {subject}{" "}
                          <b>{percentage}%</b>
                        </p>
                      ))
                    ) : (
                      <p>No completed study activity for this period.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pomodoro Activity */}
              <div className="progress-card pomodoro-activity-card">
                <div className="progress-card-title">
                  <h2>Pomodoro Activity</h2>
                  <span>{progressPeriod}⌄</span>
                </div>

                <div className="bar-chart">
                  {pomodoroActivityBars.map(([label, count]) => (
                    <div className="bar-item" key={label}>
                      <div
                        className="bar"
                        style={{ height: `${(count / highestPomodoroActivity) * 100}%` }}
                        title={`${count} completed focus sessions`}
                      ></div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>
        )}

        {activePage === "Goals" && (
          <section className="goals-page">
            <div className="page-title">
              <div>
                <p className="page-eyebrow">Dream ✨ Plan ✨ Achieve</p>
                <h1>Your Goals</h1>
                <p>Small steps lead to big results. 💖</p>
              </div>
              <button className="add-task-button" onClick={() => { resetGoalForm(); setShowGoalForm(true); }}>
                <span className="add-icon">+</span> Add Goal
              </button>
            </div>

            <div className="goals-layout">
              <div className="goals-main">
                <form className="goal-quick-add" onSubmit={addQuickGoal}>
                  <input placeholder="What's your next goal?" value={quickGoalTitle} onChange={(event) => setQuickGoalTitle(event.target.value)} />
                  <button type="submit">+</button>
                </form>
                <div className="goal-filters">
                  {["All Goals", "Active", "Completed"].map((filter) => (
                    <button key={filter} className={goalFilter === filter ? "active-filter" : ""} onClick={() => setGoalFilter(filter)}>{filter}</button>
                  ))}
                </div>
                <div className="goals-list">
                  {visibleGoals.length ? visibleGoals.map((goal) => (
                    <article className={`goal-card ${goal.completed ? "goal-completed" : ""}`} key={goal.id}>
                      <button className="goal-checkbox" aria-label={`Toggle ${goal.title}`} onClick={() => toggleGoalCompletion(goal.id)}>{goal.completed ? "✓" : ""}</button>
                      <div className="goal-icon">🎯</div>
                      <div className="goal-details">
                        <h2>{goal.title}</h2>
                        {goal.description && <p>{goal.description}</p>}
                        {goal.category && <span className="goal-category">{goal.category}</span>}
                        <div className="goal-progress-line"><div style={{ width: `${goal.progress}%` }}></div></div>
                        <span className="goal-percent">{goal.progress}%</span>
                        <input className="goal-range" aria-label={`${goal.title} progress`} type="range" min="0" max="100" value={goal.progress} onChange={(event) => {
                          const progress = Number(event.target.value);
                          setGoals((currentGoals) => currentGoals.map((item) => item.id === goal.id ? { ...item, progress, previousProgress: progress === 100 ? item.progress : progress, completed: progress === 100 } : item));
                        }} />
                      </div>
                      <div className="goal-actions">
                        {goal.dueDate && <span>📅 {new Date(`${goal.dueDate}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        <button className="goal-menu-button" onClick={() => setGoalMenuId(goalMenuId === goal.id ? null : goal.id)}>⋮</button>
                        {goalMenuId === goal.id && <div className="goal-menu">
                          <button onClick={() => openGoalEditor(goal)}>Edit</button>
                          <button onClick={() => { setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, archived: true } : item)); setGoalMenuId(null); }}>Archive</button>
                          <button onClick={() => { setGoalToDelete(goal.id); setGoalMenuId(null); }}>Delete</button>
                        </div>}
                      </div>
                    </article>
                  )) : <div className="goals-empty"><strong>{goalFilter === "All Goals" ? "Nothing here yet." : goalFilter === "Active" ? "No active goals." : "No completed goals yet."}</strong>{goalFilter === "All Goals" && <span>Add your first goal and start making progress. 💖</span>}</div>}
                </div>
              </div>
              <aside className="goals-side">
                <div className="goals-summary card">
                  <h2>Goal Summary</h2>
                  <div><strong>{goals.filter((goal) => !goal.archived).length}</strong><span>Total Goals</span></div>
                  <div><strong>{activeGoals}</strong><span>In Progress</span></div>
                  <div><strong>{completedGoals}</strong><span>Completed</span></div>
                </div>
                <div className="motivation-card-goals card">
                  <div className="motivation-heading"><h2>My Motivation</h2><button onClick={() => { if (motivationInput.trim()) { setMotivations((items) => [...items, { id: crypto.randomUUID(), text: motivationInput.trim() }]); setMotivationInput(""); } }}>+</button></div>
                  <div className="motivation-add"><input placeholder="Add a reminder" value={motivationInput} onChange={(event) => setMotivationInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.parentElement.nextElementSibling?.click(); } }} /><button onClick={() => { if (motivationInput.trim()) { setMotivations((items) => [...items, { id: crypto.randomUUID(), text: motivationInput.trim() }]); setMotivationInput(""); } }}>Add</button></div>
                  {motivations.map((motivation) => <p className="motivation-item" key={motivation.id}>✓ {motivation.text}<button onClick={() => setMotivations((items) => items.filter((item) => item.id !== motivation.id))}>×</button></p>)}
                </div>
              </aside>
            </div>

            {showGoalForm && <div className="goal-modal-backdrop"><div className="goal-modal">
              <div className="goal-modal-header"><h2>{editingGoalId ? "Edit Goal" : "Add Goal"}</h2><button onClick={() => { resetGoalForm(); setShowGoalForm(false); }}>×</button></div>
              <label>Goal title<input value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} /></label>
              <label>Description<textarea value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} /></label>
              <div className="goal-form-row"><label>Category<select value={goalForm.category} onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })}><option value="">None</option><option>Academic</option><option>Personal</option><option>Health</option><option>Other</option></select></label><label>Due date<input type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm({ ...goalForm, dueDate: event.target.value })} /></label></div>
              <label>Starting progress: {goalForm.progress}%<input type="range" min="0" max="100" value={goalForm.progress} onChange={(event) => setGoalForm({ ...goalForm, progress: event.target.value })} /></label>
              <div className="goal-modal-actions"><button onClick={() => { resetGoalForm(); setShowGoalForm(false); }}>Cancel</button><button className="primary-button" onClick={saveGoal}>Save Goal</button></div>
            </div></div>}
            {goalToDelete && <div className="goal-modal-backdrop"><div className="goal-modal goal-delete-modal"><h2>Delete this goal?</h2><div className="goal-modal-actions"><button onClick={() => setGoalToDelete(null)}>Cancel</button><button className="delete-goal-button" onClick={() => { const idToDelete = goalToDelete; setGoals((items) => items.filter((goal) => goal.id !== idToDelete)); api.goals.delete(idToDelete).catch(console.warn); setGoalToDelete(null); }}>Delete</button></div></div></div>}
          </section>
        )}

        {activePage === "Settings" && (
          <section className="settings-page">
            <div className="page-title">
              <div>
                <p className="page-eyebrow">Hello, {profile.name || auth?.name || "there"}! 👋</p>
                <h1>Settings</h1>
                <p>Customize your StudyFlow experience.</p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-column">
                <section className="settings-card">
                  <h2>Notifications</h2>
                  {[
                    ["tasks", "Task Reminders", "Get notified about upcoming and overdue tasks."],
                    ["pomodoro", "Pomodoro Notifications", "Get notified when a Pomodoro session ends."],
                    ["goals", "Goal Updates", "Get notified when you complete a goal."],
                    ["streak", "Streak Notifications", "Get notified about your study streak and streak status."],
                    ["motivation", "Motivational Notifications", "Receive occasional motivational messages."]
                  ].map(([key, label, description]) => (
                    <div className="setting-row" key={key}>
                      <div>
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(settings.notifications?.[key])}
                          onChange={() => updateSettings({
                            notifications: { ...settings.notifications, [key]: !settings.notifications?.[key] }
                          })}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  ))}
                </section>

                <section className="settings-card">
                  <h2>Preferences</h2>
                  <div className="setting-row">
                    <div>
                      <strong>Start Page</strong>
                      <span>Choose which page opens when StudyFlow starts.</span>
                    </div>
                    <select
                      className="settings-select"
                      value={settings.startPage}
                      onChange={(e) => updateSettings({ startPage: e.target.value })}
                    >
                      {["Dashboard", "My Tasks", "Pomodoro", "Calendar", "Progress", "Goals"].map((page) => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                  </div>
                  {[
                    ["compactMode", "Compact Mode", "Reduce spacing while keeping the same layout."],
                    ["showMotivation", "Show Motivational Quotes", "Show motivation in StudyFlow where available."]
                  ].map(([key, label, description]) => (
                    <div className="setting-row" key={key}>
                      <div>
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(settings[key])}
                          onChange={() => updateSettings({ [key]: !settings[key] })}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  ))}
                </section>

                <section className="settings-card account-security-card">
                  <h2>Account & Security</h2>
                  <div className="account-info-group">
                    <div className="account-info-row">
                      <span>Email</span>
                      <strong>{profile.email || auth?.email || "No email added"}</strong>
                    </div>
                    <div className="account-info-row">
                      <span>Authentication</span>
                      <span className="account-auth-badge">🔒 4-digit PIN</span>
                    </div>
                  </div>

                  <div className="storage-row">
                    <div>
                      <strong>Log Out</strong>
                      <span>Sign out of your local StudyFlow session.</span>
                    </div>
                    <button type="button" className="text-button" onClick={handleLogout}>Log Out</button>
                  </div>
                  <div className="storage-row">
                    <div>
                      <strong>Delete Account</strong>
                      <span>Permanently delete your local StudyFlow profile and all data.</span>
                    </div>
                    <button type="button" className="danger-text" onClick={() => setSettingsConfirm("account")}>Delete Account</button>
                  </div>
                </section>

                <section className="settings-card">
                  <h2>Data & Storage</h2>
                  <div className="storage-row">
                    <div>
                      <strong>Export Data</strong>
                      <span>Download a copy of your tasks, goals, settings, and more.</span>
                    </div>
                    <button type="button" className="text-button" onClick={exportStudyFlowData}>Export</button>
                  </div>
                  <div className="storage-row">
                    <div>
                      <strong>Clear All Data</strong>
                      <span>Remove all study tasks, goals, and sessions from this device.</span>
                    </div>
                    <button type="button" className="danger-text" onClick={() => setSettingsConfirm("clear")}>Clear Data</button>
                  </div>
                </section>
              </div>

              <div className="settings-column">
                <section className="settings-card appearance-card">
                  <h2>Appearance & Theme</h2>
                  <div className="theme-option-group">
                    <label className="theme-label">Theme Mode</label>
                    <div className="theme-options">
                      {["Light", "Dark", "System"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={themeDraft.mode === mode ? "active selected" : ""}
                          onClick={() => setThemeDraft({ ...themeDraft, mode })}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="theme-option-group">
                    <label className="theme-label">Theme Style</label>
                    <div className="theme-options">
                      {["Solid", "Gradient"].map((style) => (
                        <button
                          key={style}
                          type="button"
                          className={themeDraft.style === style ? "active selected" : ""}
                          onClick={() => setThemeDraft({ ...themeDraft, style })}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="theme-option-group">
                    <label className="theme-label">Color Theme</label>
                    <div className="theme-presets-grid">
                      {THEME_PRESETS.map((preset) => {
                        const isSelected =
                          themeDraft.primary?.toLowerCase() === preset.primary.toLowerCase() &&
                          themeDraft.secondary?.toLowerCase() === preset.secondary.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`theme-preset-card ${isSelected ? "selected" : ""}`}
                            onClick={() =>
                              setThemeDraft({
                                ...themeDraft,
                                primary: preset.primary,
                                secondary: preset.secondary,
                              })
                            }
                            title={preset.desc}
                          >
                            <span className="preset-swatches">
                              <span
                                className="preset-swatch swatch-primary"
                                style={{ background: preset.primary }}
                              />
                              <span
                                className="preset-swatch swatch-secondary"
                                style={{ background: preset.secondary }}
                              />
                            </span>
                            <span className="preset-info">
                              <strong className="preset-title">{preset.name}</strong>
                              <span className="preset-subtitle">{preset.tag}</span>
                            </span>
                            {isSelected && <span className="preset-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="theme-option-group">
                    <label className="theme-label">Custom Accent Colors</label>
                    <div className="color-controls">
                    {[["Primary Color", "primary"], ["Secondary Color", "secondary"]].map(([label, key]) => (
                      <div className="color-control" key={key}>
                        <label>{label}</label>
                        <input
                          type="color"
                          value={themeDraft[key]}
                          onChange={(e) => setThemeDraft({ ...themeDraft, [key]: e.target.value })}
                        />
                        <input
                          type="text"
                          value={themeDraft[key]}
                          onChange={(e) => setThemeDraft({ ...themeDraft, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                    </div>
                  </div>
                  <div
                    className={`theme-preview ${(themeDraft.mode === "Dark" || (themeDraft.mode === "System" && systemDark)) ? "preview-dark" : ""}`}
                    style={{
                      "--preview-primary": themeDraft.primary,
                      "--preview-secondary": themeDraft.secondary,
                      "--preview-accent": themeDraft.style === "Gradient"
                        ? `linear-gradient(135deg, ${themeDraft.primary}, ${themeDraft.secondary})`
                        : themeDraft.primary
                    }}
                  >
                    <aside>StudyFlow</aside>
                    <div>
                      <strong>Live Preview</strong>
                      <p>Your personalized study space.</p>
                      <button type="button">Button</button>
                      <span><i></i> Progress</span>
                    </div>
                  </div>
                  <div className="theme-actions">
                    <button type="button" className="primary-button" onClick={applyTheme}>
                      Apply Theme
                    </button>
                    <button type="button" className="text-button" onClick={() => setSettingsConfirm("reset-theme")}>
                      Reset to Default
                    </button>
                  </div>
                </section>

                <section className="settings-card">
                  <h2>Reminders</h2>
                  <div className="setting-row">
                    <div>
                      <strong>Default Reminder Time</strong>
                      <span>Set default lead time for notifications.</span>
                    </div>
                    <select
                      className="settings-select"
                      value={settings.reminderTime}
                      onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                    >
                      {["No reminder", "15 minutes", "30 minutes", "1 hour"].map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  {[
                    ["calendarReminders", "Enable Calendar Reminders", "Keep calendar reminders enabled."],
                    ["browserNotifications", "Enable Browser Notifications", "Preference saved; browser permission is not requested automatically."]
                  ].map(([key, label, description]) => (
                    <div className="setting-row" key={key}>
                      <div>
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(settings[key])}
                          onChange={() => updateSettings({ [key]: !settings[key] })}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            <section className="settings-card about-card">
              <h2>About StudyFlow</h2>
              <p>A simple study companion for a better tomorrow.</p>
              <span>Version 1.0.0</span>
              <small>Small progress each day leads to big results. 💖</small>
            </section>

            {settingsConfirm && (
              <div className="goal-modal-backdrop">
                <div className="goal-modal goal-delete-modal">
                  <h2>
                    {settingsConfirm === "reset-theme"
                      ? "Reset theme to default?"
                      : settingsConfirm === "account"
                      ? "Delete your StudyFlow account?"
                      : "Clear all StudyFlow data?"}
                  </h2>
                  <p>
                    {settingsConfirm === "reset-theme"
                      ? "Only theme preferences will be reset to defaults."
                      : settingsConfirm === "account"
                      ? "Permanently deletes your local profile and all stored data."
                      : "Removes all study tasks, goals, and sessions while keeping your account."}
                  </p>
                  <div className="goal-modal-actions">
                    <button type="button" onClick={() => setSettingsConfirm(null)}>Cancel</button>
                    <button
                      type="button"
                      className="delete-goal-button"
                      onClick={
                        settingsConfirm === "reset-theme"
                          ? resetTheme
                          : settingsConfirm === "account"
                          ? deleteAccount
                          : clearStudyFlowData
                      }
                    >
                      {settingsConfirm === "reset-theme" ? "Reset" : settingsConfirm === "account" ? "Delete Account" : "Clear Data"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activePage === "Profile" && (
          <section className="profile-page">
            <div className="page-title profile-page-header">
              <div>
                <button
                  type="button"
                  className="back-to-dashboard-btn"
                  onClick={() => setActivePage("Dashboard")}
                >
                  ← Back to Dashboard
                </button>
                <h1>Profile</h1>
                <p>Manage your personal information and StudyFlow identity.</p>
              </div>
            </div>

            {/* Profile Header Card */}
            <article className="profile-header-card">
              <div className="profile-header-avatar">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="profile-avatar-img" />
                ) : (
                  (profile.name || "C").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="profile-header-details">
                <h2>{profile.name || "Cherry"}</h2>
                <span className="profile-username">@{profile.username || "Cherry_31"}</span>
                <span className="profile-email">{profile.email || "No email added"}</span>
                <div className="profile-avatar-actions">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    className="avatar-action-btn upload-avatar-btn"
                    onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
                  >
                    📷 {profile.avatarUrl ? "Change Photo" : "Upload Photo"}
                  </button>
                  {profile.avatarUrl && (
                    <button
                      type="button"
                      className="avatar-action-btn remove-avatar-btn"
                      onClick={handleRemoveAvatar}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="profile-header-action">
                <button
                  type="button"
                  className={editingProfile ? "text-button" : "primary-button edit-profile-btn"}
                  onClick={() => {
                    if (!editingProfile) {
                      setProfileDraft(profile);
                      setProfileError("");
                    }
                    setEditingProfile(!editingProfile);
                  }}
                >
                  {editingProfile ? "Cancel" : "Edit Profile"}
                </button>
              </div>
            </article>

            {profileError && (
              <div className="profile-error-banner" role="alert">
                {profileError}
              </div>
            )}

            {editingProfile ? (
              <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                {/* Personal Information Card */}
                <div className="profile-info-card">
                  <div className="profile-section-title">
                    <h2>Personal Information</h2>
                    <span>Core identity details</span>
                  </div>
                  <div className="profile-form-grid">
                    <div className="profile-field">
                      <label htmlFor="prof-name">Full Name *</label>
                      <input
                        id="prof-name"
                        type="text"
                        value={profileDraft.name}
                        onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
                        placeholder="e.g. Cherry"
                        required
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-username">Username *</label>
                      <input
                        id="prof-username"
                        type="text"
                        value={profileDraft.username}
                        onChange={(e) => setProfileDraft({ ...profileDraft, username: e.target.value })}
                        placeholder="e.g. Cherry_31"
                        required
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-email">Email Address *</label>
                      <input
                        id="prof-email"
                        type="email"
                        value={profileDraft.email}
                        onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })}
                        placeholder="e.g. cherry@example.com"
                        required
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-dob">Date of Birth</label>
                      <input
                        id="prof-dob"
                        type="date"
                        value={profileDraft.dateOfBirth}
                        onChange={(e) => setProfileDraft({ ...profileDraft, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-gender">Gender</label>
                      <input
                        id="prof-gender"
                        type="text"
                        value={profileDraft.gender}
                        onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value })}
                        placeholder="e.g. Female / Male / Non-binary"
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-phone">Phone Number</label>
                      <input
                        id="prof-phone"
                        type="tel"
                        value={profileDraft.phone}
                        onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                        placeholder="e.g. +1 555-0199"
                      />
                    </div>
                    <div className="profile-field full-width">
                      <label htmlFor="prof-bio">Bio / About Me</label>
                      <textarea
                        id="prof-bio"
                        rows="3"
                        value={profileDraft.bio}
                        onChange={(e) => setProfileDraft({ ...profileDraft, bio: e.target.value })}
                        placeholder="Write a brief note about yourself and your study goals..."
                      />
                    </div>
                  </div>
                </div>

                {/* Study Information Card */}
                <div className="profile-info-card">
                  <div className="profile-section-title">
                    <h2>Study Information</h2>
                    <span>Academic & institutional details</span>
                  </div>
                  <div className="profile-form-grid">
                    <div className="profile-field">
                      <label htmlFor="prof-course">Course / Degree</label>
                      <input
                        id="prof-course"
                        type="text"
                        value={profileDraft.course}
                        onChange={(e) => setProfileDraft({ ...profileDraft, course: e.target.value })}
                        placeholder="e.g. B.E. / B.Tech"
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-college">College / Institution</label>
                      <input
                        id="prof-college"
                        type="text"
                        value={profileDraft.college}
                        onChange={(e) => setProfileDraft({ ...profileDraft, college: e.target.value })}
                        placeholder="e.g. Your College / University"
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-branch">Branch / Department</label>
                      <input
                        id="prof-branch"
                        type="text"
                        value={profileDraft.branch}
                        onChange={(e) => setProfileDraft({ ...profileDraft, branch: e.target.value })}
                        placeholder="e.g. Information Technology"
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-semester">Current Semester / Year</label>
                      <input
                        id="prof-semester"
                        type="text"
                        value={profileDraft.semester}
                        onChange={(e) => setProfileDraft({ ...profileDraft, semester: e.target.value })}
                        placeholder="e.g. Semester 5"
                      />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="prof-grad">Graduation Year</label>
                      <input
                        id="prof-grad"
                        type="text"
                        value={profileDraft.graduationYear}
                        onChange={(e) => setProfileDraft({ ...profileDraft, graduationYear: e.target.value })}
                        placeholder="e.g. 2028"
                      />
                    </div>
                  </div>
                </div>

                <div className="profile-actions">
                  <button type="submit" className="primary-button">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileDraft(profile);
                      setProfileError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-view-layout">
                {/* Personal Information View */}
                <div className="profile-info-card">
                  <div className="profile-section-title">
                    <h2>Personal Information</h2>
                    <span>Core identity details</span>
                  </div>
                  <div className="profile-display-grid">
                    <div className="profile-display-item">
                      <span className="profile-label">Full Name</span>
                      <strong className="profile-value">{profile.name || "Not set"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Username</span>
                      <strong className="profile-value">@{profile.username || "Not set"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Email Address</span>
                      <strong className="profile-value">{profile.email || "Not set"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Date of Birth</span>
                      <strong className="profile-value">{profile.dateOfBirth || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Gender</span>
                      <strong className="profile-value">{profile.gender || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Phone Number</span>
                      <strong className="profile-value">{profile.phone || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item full-width">
                      <span className="profile-label">Bio / About Me</span>
                      <p className="profile-value-text">{profile.bio || "No bio added yet."}</p>
                    </div>
                  </div>
                </div>

                {/* Study Information View */}
                <div className="profile-info-card">
                  <div className="profile-section-title">
                    <h2>Study Information</h2>
                    <span>Academic & institutional details</span>
                  </div>
                  <div className="profile-display-grid">
                    <div className="profile-display-item">
                      <span className="profile-label">Course / Degree</span>
                      <strong className="profile-value">{profile.course || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">College / Institution</span>
                      <strong className="profile-value">{profile.college || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Branch / Department</span>
                      <strong className="profile-value">{profile.branch || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Current Semester / Year</span>
                      <strong className="profile-value">{profile.semester || "Not specified"}</strong>
                    </div>
                    <div className="profile-display-item">
                      <span className="profile-label">Graduation Year</span>
                      <strong className="profile-value">{profile.graduationYear || "Not specified"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

          {activePage === "Notifications" && (
  <section className="notifications-page">
    <div className="page-title">
      <div>
        <p className="page-eyebrow">🔔 STAY UPDATED</p>
        <h1>Notifications</h1>
        <p className="page-subtitle">
          Your StudyFlow reminders and updates.
        </p>
      </div>

      {notifications.some((notification) => !notification.read) && (
        <button
          type="button"
          className="notifications-mark-all"
          onClick={() => {
            setNotifications((current) =>
              current.map((notification) => ({
                ...notification,
                read: true,
              }))
            );
          }}
        >
          Mark all read
        </button>
      )}
    </div>

    <div className="notification-filters">
      {["All", "Tasks", "Reminders", "Pomodoro", "Goals", "Streaks"].map((filter) => (
        <button
          key={filter}
          type="button"
          className={notificationFilter === filter ? "active" : ""}
          onClick={() => setNotificationFilter(filter)}
        >
          {filter}
        </button>
      ))}
    </div>

    <div className="notifications-page-list">
      {(() => {
        const filteredNotifications = notifications.filter((notification) =>
          filterNotificationByCategory(notification, notificationFilter)
        );

        if (filteredNotifications.length === 0) {
          return (
            <div className="notification-empty">
              <span>🔔</span>
              <strong>No notifications</strong>
              <p>There are no notifications in this category yet.</p>
            </div>
          );
        }

        return filteredNotifications.map((notification) => (
          <button
            type="button"
            key={notification.id}
            className={`notification-page-item ${
              notification.read ? "read" : "unread"
            }`}
            onClick={() => {
              setNotifications((current) =>
                current.map((item) =>
                  item.id === notification.id
                    ? { ...item, read: true }
                    : item
                )
              );
            }}
          >
            <div className="notification-item-icon">
              {getNotificationIcon(notification)}
            </div>

            <div className="notification-item-content">
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
              <small>
                {new Date(notification.time).toLocaleString()}
              </small>
            </div>

            {!notification.read && (
              <span className="notification-unread-dot"></span>
            )}
          </button>
        ));
      })()}
    </div>
  </section>
)}

        {activePage === "My Tasks" && (
          <section className="my-tasks-page">
            <div className="page-title">
              <div>
                <p className="page-eyebrow">LET'S GET THINGS DONE🥱</p>
                <h1>My Tasks</h1>
                <p>Your little corner for everything you need to finish.</p>
              </div>

              <button
                className="add-task-button"
                onClick={() => setShowTaskForm(!showTaskForm)}
              >
                <span className="add-icon">+</span>
                Add New Task
              </button>
            </div>

            {/* Search and Filters */}
            <div className="task-controls">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="task-filters">
                <button
                  className={
                    taskFilter === "All"
                      ? "filter-btn active-filter"
                      : "filter-btn"
                  }
                  onClick={() => setTaskFilter("All")}
                >
                  All ({tasks.length})
                </button>

                <button
                  className={
                    taskFilter === "Active"
                      ? "filter-btn active-filter"
                      : "filter-btn"
                  }
                  onClick={() => setTaskFilter("Active")}
                >
                  Active ({tasks.filter((task) => !task.completed).length})
                </button>

                <button
                  className={
                    taskFilter === "Completed"
                      ? "filter-btn active-filter"
                      : "filter-btn"
                  }
                  onClick={() => setTaskFilter("Completed")}
                >
                  Completed ({completedTasks})
                </button>
              </div>
            </div>

            {/* Add Task Form */}
            {showTaskForm && (
              <div className="task-form">
                <input
                  type="text"
                  placeholder="Task name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Subject"
                  value={taskSubject}
                  onChange={(e) => setTaskSubject(e.target.value)}
                />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  title="Due Date"
                />
                <input
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  title="Task Time"
                />

                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  title="Priority"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>

                <select
                  value={taskReminder}
                  onChange={(e) => setTaskReminder(e.target.value)}
                  title="Reminder"
                >
                  <option value="15">⏰ 15 minutes before</option>
                  <option value="0">⏰ At time of task</option>
                  <option value="5">⏰ 5 minutes before</option>
                  <option value="30">⏰ 30 minutes before</option>
                  <option value="60">⏰ 1 hour before</option>
                  <option value="1440">⏰ 1 day before</option>
                  <option value="none">No reminder</option>
                </select>

                <div className="task-form-actions">
                  <button type="button" onClick={addTask}>Add Task</button>
                  <button type="button" className="cancel-task-btn" onClick={cancelTaskForm}>Cancel</button>
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="task-list">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <div
                    className={`task ${task.completed ? "completed" : ""}`}
                    key={task.id}
                  >
                    <button
                      type="button"
                      className={`ref-circular-check ${task.completed ? "checked" : ""}`}
                      onClick={() => toggleTask(task.id)}
                      aria-label={`Toggle ${task.name}`}
                    >
                      {task.completed && "✓"}
                    </button>

                    <div className="task-main-info">
                      <span className="task-name">{task.name}</span>

                      <span
                        className="tag"
                        style={{ background: getSubjectColor(task.subject) }}
                      >
                        {task.subject}
                      </span>
                    </div>
                    <span className="due-date">
                      📅{" "}
                      {new Date(task.dueDate).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {task.dueTime ? ` • ⏰ ${formatTimeDisplay(task.dueTime)}` : ""}
                    </span>
                    <span className={`priority ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>

                    <button
                      className="delete-task"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-task-state">
                  <h3>No tasks found</h3>
                  <p>Try another search or filter.</p>
                </div>
              )}
            </div>
          </section>
        )}
        {activePage === "Calendar" && (
          <div className="calendar-page">
            <div className="page-header">
              <div>
                <p className="page-eyebrow">📅 PLAN YOUR DAYS</p>
                <h1>Calendar</h1>
                <p>See your study tasks and deadlines at a glance.</p>
              </div>

              <button className="today-button" onClick={goToToday}>
                Today
              </button>
            </div>
            <div className="calendar-month-header">
              <button onClick={goToPreviousMonth}>‹</button>

              <h2>
                {monthName} {calendarYear}
              </h2>

              <button onClick={goToNextMonth}>›</button>
            </div>
            <div className="calendar-content">
              <div className="calendar-main-view">
                <div className="calendar-weekdays">
                  {weekdays.map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="calendar-grid">
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return (
                        <div key={index} className="calendar-day empty"></div>
                      );
                    }

                    const date = new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth(),
                      day,
                    );

                    const dayTasks = getTasksForDate(date);

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${isToday(date) ? "today" : ""} ${formatDate(date) === formatDate(selectedDate) ? "selected" : ""}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <span className="calendar-day-number">{day}</span>

                        <div className="calendar-day-tasks">
                          {dayTasks.map((task) => (
                            <div key={task.id}>{task.name}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="calendar-side-column">
                <div className="selected-day-panel">
                <h3>
                  Tasks for{" "}
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>

                {selectedDateTasks.length === 0 ? (
                  <p>No tasks for this day.</p>
                ) : (
                  <div className="selected-day-tasks">
                    {selectedDateTasks.map((task) => (
                      <div
                        className={`selected-task ${task.completed ? "completed" : ""}`}
                        key={task.id}
                      >
                        <button
                          type="button"
                          className={`ref-circular-check ${task.completed ? "checked" : ""}`}
                          onClick={() => toggleTask(task.id)}
                          aria-label={`Toggle ${task.name}`}
                        >
                          {task.completed && "✓"}
                        </button>

                        <div className="selected-task-info">
                          <strong>{task.name}</strong>
                          <span>
                            {task.subject}
                            {task.dueTime ? ` • ⏰ ${formatTimeDisplay(task.dueTime)}` : ""}
                          </span>
                        </div>

                        {formatReminderDisplay(task.reminder) && (
                          <span className="selected-task-reminder">
                            ⏰ {formatReminderDisplay(task.reminder)}
                          </span>
                        )}

                        <span
                          className={`priority-badge ${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>

                        <button
                          className="delete-task"
                          onClick={() => deleteTask(task.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!showCalendarTaskForm && (
                  <button
                    className="calendar-add-task-button"
                    onClick={() => setShowCalendarTaskForm(true)}
                  >
                    ＋ Add Task
                  </button>
                )}

                {showCalendarTaskForm && (
                  <form
                    className="calendar-add-task-panel"
                    onSubmit={addCalendarTask}
                  >
                    <h3>Add a task</h3>

                    <p>
                      For{" "}
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>

                    <label>Task name</label>

                    <input
                      type="text"
                      placeholder="What do you need to study?"
                      value={calendarTaskName}
                      onChange={(e) => setCalendarTaskName(e.target.value)}
                    />

                    <div className="calendar-form-row">
                      <div>
                        <label>Subject</label>

                        <input
                          type="text"
                          placeholder="e.g. DSA"
                          value={calendarTaskSubject}
                          onChange={(e) =>
                            setCalendarTaskSubject(e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label>Priority</label>

                        <select
                          value={calendarTaskPriority}
                          onChange={(e) =>
                            setCalendarTaskPriority(e.target.value)
                          }
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </div>

                    <div className="calendar-form-row">
                      <div>
                        <label>Task Time</label>
                        <input
                          type="time"
                          value={calendarTaskTime}
                          onChange={(e) => setCalendarTaskTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <label>⏰ Reminder</label>
                        <select
                          value={calendarReminder}
                          onChange={(e) => setCalendarReminder(e.target.value)}
                        >
                          <option value="15">15 minutes before</option>
                          <option value="0">At time of task</option>
                          <option value="5">5 minutes before</option>
                          <option value="30">30 minutes before</option>
                          <option value="60">1 hour before</option>
                          <option value="1440">1 day before</option>
                          <option value="none">No reminder</option>
                        </select>
                      </div>
                    </div>

                    <div className="calendar-form-actions">
                      <button
                        type="submit"
                        className="calendar-submit-button"
                      >
                        ＋ Add Task
                      </button>
                      <button
                        type="button"
                        className="calendar-cancel-button"
                        onClick={cancelCalendarTaskForm}
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="calendar-add-task-hint">
                      Tap any date to add a task for that day ✨
                    </div>
                  </form>
                )}
              </div>

              <div className="calendar-doodle-notes" aria-label="Study planner notes">
                <div className="calendar-doodle-item doodle-1">
                  <span className="doodle-symbol">✎</span>
                  <span>one task at a time ♡</span>
                </div>
                <div className="calendar-doodle-item doodle-2">
                  <span className="doodle-symbol">✦</span>
                  <span>little progress counts</span>
                </div>
                <div className="calendar-doodle-item doodle-3">
                  <span className="doodle-symbol">˚₊‧</span>
                  <span>study gently today 🌱</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Active Reminder Alert Modal */}
        {activeReminderAlert && (
          <div className="reminder-alert-backdrop" role="dialog" aria-modal="true" aria-labelledby="reminder-alert-title">
            <div className="reminder-alert-modal">
              <div className="reminder-alert-icon" aria-hidden="true">🔔</div>
              <h2 id="reminder-alert-title">Task Reminder</h2>
              <p className="reminder-task-title">"{activeReminderAlert.task.name}"</p>
              <p className="reminder-task-details">
                Your task is scheduled for {activeReminderAlert.dueTimeDisplay}.
              </p>
              <button
                type="button"
                className="reminder-dismiss-button"
                onClick={handleDismissReminder}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
