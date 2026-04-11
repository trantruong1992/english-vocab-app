import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  Plus,
  Search,
  Settings,
  BarChart3,
  Trash2,
  Pencil,
  Upload,
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";

const STORAGE_KEY = "english_vocab_lab_v2";
const today = () => new Date().toISOString().slice(0, 10);

const defaultLearning = () => ({
  correct: 0,
  wrong: 0,
  streak: 0,
  mastery: 0,
  status: "new",
  interval: 0,
  nextReview: today(),
  lastReview: null,
});

const defaultState = {
  words: [
    {
      id: crypto.randomUUID(),
      day: 1,
      en: "issue",
      vi: "vấn đề",
      phonetic: "/ˈɪʃuː/",
      type: "noun",
      exampleEn: "There is an issue with the app.",
      exampleVi: "Có một vấn đề với ứng dụng.",
      tags: ["work", "IT"],
      collocations: ["technical issue", "serious issue"],
      notes: "Hay dùng khi nói về lỗi hoặc vấn đề trong công việc.",
      difficulty: 2,
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 1,
      en: "schedule",
      vi: "lịch trình; lên lịch",
      phonetic: "/ˈskedʒuːl/",
      type: "noun / verb",
      exampleEn: "I need to schedule a meeting for tomorrow.",
      exampleVi: "Tôi cần lên lịch một cuộc họp cho ngày mai.",
      tags: ["work", "meeting"],
      collocations: ["tight schedule", "schedule a meeting"],
      notes: "Vừa là danh từ vừa là động từ.",
      difficulty: 2,
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 2,
      en: "reliable",
      vi: "đáng tin cậy",
      phonetic: "/rɪˈlaɪəbl/",
      type: "adjective",
      exampleEn: "She is a reliable colleague.",
      exampleVi: "Cô ấy là một đồng nghiệp đáng tin cậy.",
      tags: ["daily", "work"],
      collocations: ["reliable source", "reliable colleague"],
      notes: "Dùng cho người, dữ liệu, nguồn thông tin.",
      difficulty: 1,
      learning: defaultLearning(),
    },
  ],
  logs: [],
  settings: {
    dark: false,
    mode: "typing_word",
    source: "due",
    dayFilter: "all",
    autoSpeak: false,
    voiceLang: "en-US",
    cardsPerSession: 30,
    randomMode: true,
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      words: Array.isArray(parsed.words) ? parsed.words : defaultState.words,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ");
}

function addDays(dateString, days) {
  const d = new Date(dateString || today());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function calcNextReview(word, grade) {
  const rawInterval = Number(word.learning?.interval || 0);
  const current = Number.isFinite(rawInterval) ? rawInterval : 0;
  const safeCurrent = Math.max(0, Math.min(current, 365));

  if (grade === "again") {
    return {
      interval: 0,
      nextReview: today(),
      masteryDelta: -8,
      correctDelta: 0,
      wrongDelta: 1,
      streak: 0,
    };
  }

  if (grade === "hard") {
    return {
      interval: Math.max(1, Math.min(safeCurrent || 1, 365)),
      nextReview: addDays(today(), 1),
      masteryDelta: 3,
      correctDelta: 1,
      wrongDelta: 0,
      streak: (word.learning?.streak || 0) + 1,
    };
  }

  if (grade === "good") {
    const interval = Math.min(
      365,
      Math.max(3, safeCurrent ? Math.round(safeCurrent * 1.8) : 3)
    );
    return {
      interval,
      nextReview: addDays(today(), interval),
      masteryDelta: 8,
      correctDelta: 1,
      wrongDelta: 0,
      streak: (word.learning?.streak || 0) + 1,
    };
  }

  const interval = Math.min(
    365,
    Math.max(7, safeCurrent ? Math.round(safeCurrent * 2.2) : 7)
  );

  return {
    interval,
    nextReview: addDays(today(), interval),
    masteryDelta: 14,
    correctDelta: 1,
    wrongDelta: 0,
    streak: (word.learning?.streak || 0) + 1,
  };
}

function speak(text, lang) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || "en-US";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

const emptyForm = {
  id: null,
  day: 1,
  en: "",
  vi: "",
  phonetic: "",
  type: "",
  exampleEn: "",
  exampleVi: "",
  tags: "",
  collocations: "",
  notes: "",
  difficulty: 2,
};

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("dashboard");
  const [form, setForm] = useState(emptyForm);
  const [searchText, setSearchText] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [dayLibraryFilter, setDayLibraryFilter] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [showHintWord, setShowHintWord] = useState(false);
  const [showHintSentence, setShowHintSentence] = useState(false);

  const fileRef = useRef(null);
  const typingRef = useRef(null);
  const focusTimerRef = useRef(null);

  const words = state.words;
  const settings = state.settings;
  const logs = state.logs;

  function isTypingMode(mode) {
    return (
      mode === "typing_word" ||
      mode === "typing_sentence" ||
      mode === "listening"
    );
  }

  function isMobileDevice() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function focusTypingInput(delay = 0) {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = setTimeout(() => {
      const el = typingRef.current;
      if (!el || !isTypingMode(settings.mode)) return;

      const tryFocus = () => {
        try {
          el.focus({ preventScroll: true });
        } catch {
          try {
            el.focus();
          } catch {}
        }

        try {
          const len = el.value?.length ?? 0;
          el.setSelectionRange(len, len);
        } catch {}
      };

      tryFocus();

      if (!isMobileDevice()) {
        requestAnimationFrame(() => {
          tryFocus();
        });
      }
    }, delay);
  }

  useEffect(() => {
    saveState(state);
    document.body.style.background = state.settings.dark ? "#0f172a" : "#f8fafc";
  }, [state]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const allDays = useMemo(() => {
    const set = new Set(words.map((w) => String(w.day)));
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [words]);

  const allTags = useMemo(() => {
    const set = new Set();
    words.forEach((w) => (w.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [words]);

  const dueWords = useMemo(
    () => words.filter((w) => !w.learning?.nextReview || w.learning.nextReview <= today()),
    [words]
  );

  const difficultWords = useMemo(
    () =>
      [...words]
        .filter((w) => (w.learning?.wrong || 0) > 0)
        .sort((a, b) => (b.learning?.wrong || 0) - (a.learning?.wrong || 0)),
    [words]
  );

  const masteredCount = useMemo(
    () => words.filter((w) => (w.learning?.mastery || 0) >= 80).length,
    [words]
  );

  const libraryWords = useMemo(() => {
    return words.filter((w) => {
      const hay = [
        w.en,
        w.vi,
        w.exampleEn,
        w.exampleVi,
        (w.tags || []).join(" "),
        (w.collocations || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const s = !searchText || hay.includes(searchText.toLowerCase());
      const t = tagFilter === "all" || (w.tags || []).includes(tagFilter);
      const d = dayLibraryFilter === "all" || String(w.day) === dayLibraryFilter;
      return s && t && d;
    });
  }, [words, searchText, tagFilter, dayLibraryFilter]);

  const sessionWords = useMemo(() => {
    let arr = words;

    if (settings.source === "due") arr = dueWords;
    if (settings.source === "difficult") arr = difficultWords;
    if (settings.source === "day" && settings.dayFilter !== "all") {
      arr = words.filter((w) => String(w.day) === settings.dayFilter);
    }
    if (settings.source !== "day" && settings.dayFilter !== "all") {
      arr = arr.filter((w) => String(w.day) === settings.dayFilter);
    }

    const limited = arr.slice(0, settings.cardsPerSession || 30);

    if (!settings.randomMode) return limited;

    const shuffled = [...limited];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [
    words,
    dueWords,
    difficultWords,
    settings.source,
    settings.dayFilter,
    settings.cardsPerSession,
    settings.randomMode,
  ]);

  const currentWord = sessionWords[currentIndex] || null;

  useEffect(() => {
    setCurrentIndex(0);
    setTyped("");
    setFeedback(null);
    setFlipped(false);
    setQuizAnswer("");
    setShowHintWord(false);
    setShowHintSentence(false);
  }, [settings.mode, settings.source, settings.dayFilter, settings.randomMode]);

  useEffect(() => {
    if (isTypingMode(settings.mode) && currentWord) {
      focusTypingInput(isMobileDevice() ? 60 : 140);
    }
  }, [currentIndex, settings.mode, currentWord?.id]);

  useEffect(() => {
    if (
      currentWord &&
      settings.autoSpeak &&
      (settings.mode === "flashcard" || settings.mode === "listening")
    ) {
      speak(currentWord.en, settings.voiceLang);
    }
  }, [currentWord, settings.autoSpeak, settings.voiceLang, settings.mode]);

  function setSetting(key, value) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  }

  async function saveWord() {
    if (!form.en.trim() || !form.vi.trim()) return;

    const payload = {
      id: form.id || crypto.randomUUID(),
      day: Number(form.day || 1),
      en: form.en.trim(),
      vi: form.vi.trim(),
      phonetic: form.phonetic.trim(),
      type: form.type.trim(),
      exampleEn: form.exampleEn.trim(),
      exampleVi: form.exampleVi.trim(),
      tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
      collocations: form.collocations.split(",").map((x) => x.trim()).filter(Boolean),
      notes: form.notes.trim(),
      difficulty: Number(form.difficulty || 2),
      learning: form.id
        ? words.find((w) => w.id === form.id)?.learning || defaultLearning()
        : defaultLearning(),
    };

    setState((prev) => ({
      ...prev,
      words: prev.words.some((w) => w.id === payload.id)
        ? prev.words.map((w) => (w.id === payload.id ? payload : w))
        : [payload, ...prev.words],
    }));
    setForm(emptyForm);
  }

  function editWord(word) {
    setForm({
      id: word.id,
      day: word.day,
      en: word.en,
      vi: word.vi,
      phonetic: word.phonetic || "",
      type: word.type || "",
      exampleEn: word.exampleEn || "",
      exampleVi: word.exampleVi || "",
      tags: (word.tags || []).join(", "),
      collocations: (word.collocations || []).join(", "),
      notes: word.notes || "",
      difficulty: word.difficulty || 2,
    });
    setTab("library");
  }

  function deleteWord(id) {
    setState((prev) => ({
      ...prev,
      words: prev.words.filter((w) => w.id !== id),
    }));
  }

  function reviewWord(word, grade, mode) {
    const update = calcNextReview(word, grade);
    setState((prev) => ({
      ...prev,
      words: prev.words.map((w) =>
        w.id === word.id
          ? {
              ...w,
              learning: {
                ...w.learning,
                correct: (w.learning?.correct || 0) + update.correctDelta,
                wrong: (w.learning?.wrong || 0) + update.wrongDelta,
                streak: update.streak,
                mastery: Math.max(
                  0,
                  Math.min(100, (w.learning?.mastery || 0) + update.masteryDelta)
                ),
                status:
                  grade === "again"
                    ? "learning"
                    : grade === "easy"
                    ? "mastering"
                    : "review",
                interval: update.interval,
                nextReview: update.nextReview,
                lastReview: today(),
              },
            }
          : w
      ),
      logs: [
        {
          id: crypto.randomUUID(),
          wordId: word.id,
          en: word.en,
          date: today(),
          mode,
          correct: grade !== "again",
          detail: grade,
        },
        ...prev.logs,
      ].slice(0, 3000),
    }));
  }

  function nextCard() {
    if (!sessionWords.length) return;
    setCurrentIndex((i) => (i + 1) % sessionWords.length);
    setTyped("");
    setFeedback(null);
    setFlipped(false);
    setQuizAnswer("");
    setShowHintWord(false);
    setShowHintSentence(false);
  }

  function prevCard() {
    if (!sessionWords.length) return;
    setCurrentIndex((i) => (i - 1 + sessionWords.length) % sessionWords.length);
    setTyped("");
    setFeedback(null);
    setFlipped(false);
    setQuizAnswer("");
    setShowHintWord(false);
    setShowHintSentence(false);
  }

  function submitTypingWord() {
    if (!currentWord) return;
    const ok = normalize(typed) === normalize(currentWord.en);

    if (ok) {
      setFeedback({ ok: true, answer: currentWord.en, vi: currentWord.vi });
      reviewWord(currentWord, "good", "typing_word");
      setTyped("");
      setShowHintWord(false);
      setShowHintSentence(false);
      setTimeout(() => {
        nextCard();
      }, 450);
    } else {
      setFeedback({ ok: false, answer: currentWord.en, vi: currentWord.vi });
      reviewWord(currentWord, "again", "typing_word");
      focusTypingInput(30);
    }
  }

  function submitTypingSentence() {
    if (!currentWord) return;
    const ok = normalize(typed) === normalize(currentWord.exampleEn);

    if (ok) {
      setFeedback({
        ok: true,
        answer: currentWord.exampleEn,
        vi: currentWord.exampleVi || currentWord.vi,
      });
      reviewWord(currentWord, "good", "typing_sentence");
      setTyped("");
      setShowHintWord(false);
      setShowHintSentence(false);
      setTimeout(() => {
        nextCard();
      }, 450);
    } else {
      setFeedback({
        ok: false,
        answer: currentWord.exampleEn,
        vi: currentWord.exampleVi || currentWord.vi,
      });
      reviewWord(currentWord, "again", "typing_sentence");
      focusTypingInput(30);
    }
  }

  function submitListening() {
    if (!currentWord) return;
    const ok = normalize(typed) === normalize(currentWord.en);

    if (ok) {
      setFeedback({ ok: true, answer: currentWord.en, vi: currentWord.vi });
      reviewWord(currentWord, "good", "listening");
      setTyped("");
      setShowHintWord(false);
      setTimeout(() => {
        nextCard();
      }, 450);
    } else {
      setFeedback({ ok: false, answer: currentWord.en, vi: currentWord.vi });
      reviewWord(currentWord, "again", "listening");
      focusTypingInput(30);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `english-vocab-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);

        const normalizeWord = (item, index) => ({
          id: item.id || `word_${Date.now()}_${index}`,
          day: Number(item.day || 1),
          en: item.en || "",
          vi: item.vi || "",
          phonetic: item.phonetic || "",
          type: item.type || "",
          exampleEn: item.exampleEn || "",
          exampleVi: item.exampleVi || "",
          tags: Array.isArray(item.tags)
            ? item.tags
            : typeof item.tags === "string"
            ? item.tags.split(",").map((x) => x.trim()).filter(Boolean)
            : [],
          collocations: Array.isArray(item.collocations)
            ? item.collocations
            : typeof item.collocations === "string"
            ? item.collocations.split(",").map((x) => x.trim()).filter(Boolean)
            : [],
          notes: item.notes || "",
          difficulty: Number(item.difficulty || 2),
          learning: {
            ...defaultLearning(),
            ...(item.learning || {}),
            interval: Math.max(
              0,
              Math.min(365, Number(item.learning?.interval || 0) || 0)
            ),
            nextReview:
              item.learning?.nextReview &&
              /^\d{4}-\d{2}-\d{2}$/.test(item.learning.nextReview)
                ? item.learning.nextReview
                : today(),
          },
        });

        if (Array.isArray(parsed)) {
          setState((prev) => ({
            ...prev,
            words: parsed.map(normalizeWord),
            logs: prev.logs || [],
          }));
          return;
        }

        if (Array.isArray(parsed.words)) {
          setState({
            ...defaultState,
            ...parsed,
            words: parsed.words.map(normalizeWord),
            logs: Array.isArray(parsed.logs) ? parsed.logs : [],
            settings: { ...defaultState.settings, ...(parsed.settings || {}) },
          });
          return;
        }

        throw new Error();
      } catch {
        alert(
          "File JSON không đúng định dạng. Bạn có thể import 1 mảng từ vựng hoặc file backup đầy đủ của app."
        );
      }
    };
    reader.readAsText(file);
  }

  function addSampleDay() {
    const nextDay = allDays.length ? Number(allDays[allDays.length - 1]) + 1 : 1;
    const samples = [
      ["deadline", "hạn chót", "We must finish before the deadline."],
      ["improve", "cải thiện", "I want to improve my English every day."],
      ["confident", "tự tin", "She feels confident after practice."],
    ].map(([en, vi, ex]) => ({
      id: crypto.randomUUID(),
      day: nextDay,
      en,
      vi,
      phonetic: "",
      type: "",
      exampleEn: ex,
      exampleVi: "",
      tags: ["sample"],
      collocations: [],
      notes: "Auto sample day",
      difficulty: 2,
      learning: defaultLearning(),
    }));
    setState((prev) => ({ ...prev, words: [...samples, ...prev.words] }));
  }

  function resetLearning() {
    setState((prev) => ({
      ...prev,
      logs: [],
      words: prev.words.map((w) => ({
        ...w,
        learning: defaultLearning(),
      })),
    }));
  }

  function quizOptions(word) {
    const others = words
      .filter((w) => w.id !== word.id)
      .slice(0, 10)
      .map((w) => w.vi);

    return [...new Set([word.vi, ...others])]
      .slice(0, 4)
      .sort(() => Math.random() - 0.5);
  }

  const todayLogs = logs.filter((l) => l.date === today());
  const todayAccuracy = todayLogs.length
    ? Math.round((todayLogs.filter((l) => l.correct).length / todayLogs.length) * 100)
    : 0;

  const recentDays = Array.from({ length: 7 })
    .map((_, i) => addDays(today(), -i))
    .reverse();

  const styles = getStyles(settings.dark);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.brandRow}>
              <div style={styles.brandIcon}>
                <Brain size={20} />
              </div>
              <div>
                <div style={styles.title}>Phòng học từ vựng tiếng Anh cá nhân</div>
                <div style={styles.subtitle}>
                  Ứng dụng học từ vựng cá nhân: học theo ngày, nhập từ, nhập lại câu,
                  nghe, flashcard, quiz, ôn lặp lại ngắt quãng, từ khó,
                  thống kê, xuất và nhập JSON.
                </div>
              </div>
            </div>
          </div>

          <div style={styles.headerStats}>
            <MiniStat label="Due" value={dueWords.length} dark={settings.dark} />
            <MiniStat label="Total" value={words.length} dark={settings.dark} />
            <MiniStat label="Mastered" value={masteredCount} dark={settings.dark} />
            <button
              style={styles.smallBtn}
              onClick={() => setSetting("dark", !settings.dark)}
            >
              <Settings size={16} /> {settings.dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <div style={styles.tabRow}>
          {[
            ["dashboard", <BookOpen size={16} />, "Dashboard"],
            ["study", <Brain size={16} />, "Study"],
            ["library", <Search size={16} />, "Library"],
            ["stats", <BarChart3 size={16} />, "Stats"],
            ["settings", <Settings size={16} />, "Settings"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{ ...styles.tabBtn, ...(tab === key ? styles.tabBtnActive : {}) }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div style={styles.sectionGrid}>
            <Card title="Hôm nay nên học gì" dark={settings.dark}>
              <div style={styles.actionGrid}>
                <ActionCard
                  dark={settings.dark}
                  title="Ôn từ đến hạn"
                  value={`${dueWords.length} từ`}
                  desc="Ôn đúng lúc sắp quên."
                  onClick={() => {
                    setSetting("source", "due");
                    setTab("study");
                  }}
                />
                <ActionCard
                  dark={settings.dark}
                  title="Từ khó"
                  value={`${difficultWords.length} từ`}
                  desc="Tập trung vào từ hay sai."
                  onClick={() => {
                    setSetting("source", "difficult");
                    setTab("study");
                  }}
                />
                <ActionCard
                  dark={settings.dark}
                  title="Học theo ngày"
                  value={`${allDays.length} day`}
                  desc="Chọn Day 1, Day 2..."
                  onClick={() => {
                    setSetting("source", "day");
                    setTab("study");
                  }}
                />
              </div>
            </Card>

            <Card title="Tiến độ hôm nay" dark={settings.dark}>
              <Metric label="Lượt làm bài" value={todayLogs.length} dark={settings.dark} />
              <Metric label="Độ chính xác" value={`${todayAccuracy}%`} dark={settings.dark} />
              <Metric label="Đã thuộc" value={masteredCount} dark={settings.dark} />
              <Metric label="Due còn lại" value={dueWords.length} dark={settings.dark} />
            </Card>

            <Card title="Quick actions" dark={settings.dark}>
              <div style={styles.stackGap}>
                <button style={styles.primaryBtn} onClick={() => setTab("library")}>
                  <Plus size={16} /> Thêm từ mới
                </button>
                <button style={styles.secondaryBtn} onClick={addSampleDay}>
                  <Star size={16} /> Tạo sample Day
                </button>
                <button style={styles.secondaryBtn} onClick={exportJson}>
                  <Download size={16} /> Export JSON
                </button>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} /> Import JSON
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={(e) => importJson(e.target.files?.[0])}
                />
              </div>
            </Card>

            <Card title="Từ khó nhất" dark={settings.dark}>
              <div style={styles.stackGap}>
                {difficultWords.length === 0 && (
                  <div style={styles.muted}>Chưa có từ khó. Khi bạn sai, app sẽ tự gom vào đây.</div>
                )}
                {difficultWords.slice(0, 8).map((w) => (
                  <div key={w.id} style={styles.listItem}>
                    <div>
                      <div style={styles.wordTitle}>{w.en}</div>
                      <div style={styles.muted}>{w.vi}</div>
                    </div>
                    <div style={styles.rightMini}>Sai {w.learning?.wrong || 0} lần</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "study" && (
          <div style={styles.stackGapLg}>
            <Card title="Cấu hình phiên học" dark={settings.dark}>
              <div style={styles.filterGrid}>
                <SelectLike
                  label="Chế độ học"
                  value={settings.mode}
                  onChange={(v) => setSetting("mode", v)}
                  options={["typing_word", "typing_sentence", "flashcard", "listening", "quiz"]}
                  dark={settings.dark}
                />
                <SelectLike
                  label="Nguồn học"
                  value={settings.source}
                  onChange={(v) => setSetting("source", v)}
                  options={["due", "all", "difficult", "day"]}
                  dark={settings.dark}
                />
                <SelectLike
                  label="Lọc theo ngày"
                  value={settings.dayFilter}
                  onChange={(v) => setSetting("dayFilter", v)}
                  options={["all", ...allDays]}
                  dark={settings.dark}
                />
                <Field label="Số thẻ mỗi phiên" dark={settings.dark}>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={settings.cardsPerSession}
                    onChange={(e) =>
                      setSetting("cardsPerSession", Number(e.target.value || 30))
                    }
                    style={styles.input}
                  />
                </Field>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={!!settings.randomMode}
                    onChange={(e) => setSetting("randomMode", e.target.checked)}
                  />
                  <span>Học ngẫu nhiên</span>
                </label>
              </div>
            </Card>

            {!currentWord ? (
              <Card title="Phiên học" dark={settings.dark}>
                <div style={styles.empty}>
                  Không có từ trong phiên học này. Hãy đổi source hoặc thêm từ trong Library.
                </div>
              </Card>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentWord.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <Card
                    title={`Chế độ học: ${modeText(settings.mode)}`}
                    dark={settings.dark}
                  >
                    <div style={styles.studyTop}>
                      <div style={styles.badges}>
                        <Badge dark={settings.dark}>Day {currentWord.day}</Badge>
                        <Badge dark={settings.dark}>
                          {currentWord.type || "Unknown type"}
                        </Badge>
                        <Badge dark={settings.dark}>
                          Mastery {currentWord.learning?.mastery || 0}%
                        </Badge>
                      </div>
                      <div style={styles.muted}>
                        Thẻ {currentIndex + 1} / {sessionWords.length}
                      </div>
                    </div>

                    {settings.mode === "typing_word" && (
                      <div style={styles.studyGrid}>
                        <div style={styles.promptBox}>
                          <div style={styles.label}>Gợi ý nghĩa</div>
                          <div style={styles.promptTitle}>{currentWord.vi}</div>
                          <div style={styles.muted}>
                            Nhập đúng từ tiếng Anh rồi nhấn Enter. Nếu đúng, app tự
                            chuyển sang từ tiếp theo. Nếu sai, bạn phải nhập lại đến khi đúng.
                          </div>
                          {currentWord.exampleVi && (
                            <div style={styles.exampleText}>
                              Ví dụ tiếng Việt: {currentWord.exampleVi}
                            </div>
                          )}
                        </div>

                        <div style={styles.stackGap}>
                          <input
                            key={`typing_word_${currentWord.id}`}
                            ref={typingRef}
                            autoFocus
                            inputMode="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitTypingWord();
                            }}
                            placeholder="Nhập từ tiếng Anh..."
                            style={{ ...styles.input, height: 48, fontSize: 18 }}
                          />

                          <div style={styles.btnRow}>
                            <button style={styles.primaryBtn} onClick={submitTypingWord}>
                              Kiểm tra
                            </button>
                            <button
                              style={styles.secondaryBtn}
                              onClick={() =>
                                speak(currentWord.exampleEn || currentWord.en, settings.voiceLang)
                              }
                            >
                              <Volume2 size={16} /> Nghe câu
                            </button>
                          </div>

                          {feedback && (
                            <div
                              style={{
                                ...styles.feedback,
                                background: feedback.ok ? "#dcfce7" : "#fee2e2",
                                color: feedback.ok ? "#166534" : "#991b1b",
                              }}
                            >
                              {feedback.ok
                                ? `Đúng. Từ chính xác là: ${feedback.answer}`
                                : `Sai. Hãy nhập lại cho đúng.`}
                            </div>
                          )}

                          {!feedback?.ok && feedback && (
                            <div style={styles.btnRowWrap}>
                              <button
                                style={styles.secondaryBtn}
                                onClick={() => setShowHintWord((prev) => !prev)}
                              >
                                {showHintWord ? "Ẩn từ" : "Hiện từ"}
                              </button>
                              <button
                                style={styles.secondaryBtn}
                                onClick={() => setShowHintSentence((prev) => !prev)}
                              >
                                {showHintSentence ? "Ẩn câu" : "Hiện câu"}
                              </button>
                            </div>
                          )}

                          {showHintWord && (
                            <div style={styles.exampleText}>
                              Từ đúng: <strong>{currentWord.en}</strong>
                            </div>
                          )}

                          {showHintSentence && (
                            <div style={styles.exampleText}>
                              Câu tiếng Anh:{" "}
                              <strong>{currentWord.exampleEn || currentWord.en}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {settings.mode === "typing_sentence" && (
                      <div style={styles.studyGrid}>
                        <div style={styles.promptBox}>
                          <div style={styles.label}>Dịch câu sang tiếng Anh</div>
                          <div style={styles.promptTitle}>
                            {currentWord.exampleVi || currentWord.vi}
                          </div>
                          <div style={styles.muted}>
                            Nhập đúng cả câu tiếng Anh rồi nhấn Enter. Đúng thì app
                            tự chuyển câu khác. Sai thì phải nhập lại đến khi đúng.
                          </div>
                        </div>

                        <div style={styles.stackGap}>
                          <input
                            key={`typing_sentence_${currentWord.id}`}
                            ref={typingRef}
                            autoFocus
                            inputMode="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitTypingSentence();
                            }}
                            placeholder="Nhập lại cả câu tiếng Anh..."
                            style={{ ...styles.input, height: 48, fontSize: 18 }}
                          />

                          <div style={styles.btnRow}>
                            <button
                              style={styles.primaryBtn}
                              onClick={submitTypingSentence}
                            >
                              Kiểm tra
                            </button>
                            <button
                              style={styles.secondaryBtn}
                              onClick={() =>
                                speak(currentWord.exampleEn || currentWord.en, settings.voiceLang)
                              }
                            >
                              <Volume2 size={16} /> Nghe câu
                            </button>
                          </div>

                          {feedback && (
                            <div
                              style={{
                                ...styles.feedback,
                                background: feedback.ok ? "#dcfce7" : "#fee2e2",
                                color: feedback.ok ? "#166534" : "#991b1b",
                              }}
                            >
                              {feedback.ok
                                ? `Đúng. Câu chuẩn là: ${feedback.answer}`
                                : `Sai. Hãy nhập lại cho đúng.`}
                            </div>
                          )}

                          {!feedback?.ok && feedback && (
                            <div style={styles.btnRowWrap}>
                              <button
                                style={styles.secondaryBtn}
                                onClick={() => setShowHintWord((prev) => !prev)}
                              >
                                {showHintWord ? "Ẩn từ" : "Hiện từ"}
                              </button>
                              <button
                                style={styles.secondaryBtn}
                                onClick={() => setShowHintSentence((prev) => !prev)}
                              >
                                {showHintSentence ? "Ẩn câu" : "Hiện câu"}
                              </button>
                            </div>
                          )}

                          {showHintWord && (
                            <div style={styles.exampleText}>
                              Từ mục tiêu: <strong>{currentWord.en}</strong>
                            </div>
                          )}

                          {showHintSentence && (
                            <div style={styles.exampleText}>
                              Câu đúng:{" "}
                              <strong>{currentWord.exampleEn || currentWord.en}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {settings.mode === "flashcard" && (
                      <div style={styles.stackGapLg}>
                        <button
                          style={styles.flashcard}
                          onClick={() => setFlipped(!flipped)}
                        >
                          {!flipped ? (
                            <>
                              <div style={styles.labelLight}>Tap to reveal</div>
                              <div style={styles.flashWord}>{currentWord.en}</div>
                              <div>{currentWord.phonetic}</div>
                            </>
                          ) : (
                            <>
                              <div style={styles.labelLight}>Meaning + usage</div>
                              <div style={styles.flashMeaning}>{currentWord.vi}</div>
                              <div>{currentWord.exampleEn}</div>
                              <div style={{ opacity: 0.88 }}>{currentWord.exampleVi}</div>
                            </>
                          )}
                        </button>

                        <div style={styles.btnRowWrap}>
                          <button
                            style={styles.secondaryBtn}
                            onClick={() => speak(currentWord.en, settings.voiceLang)}
                          >
                            <Headphones size={16} /> Hear word
                          </button>
                          <ReviewRow
                            onPick={(grade) => reviewWord(currentWord, grade, "flashcard")}
                          />
                        </div>
                      </div>
                    )}

                    {settings.mode === "listening" && (
                      <div style={styles.studyGrid}>
                        <div style={styles.promptBox}>
                          <div style={styles.label}>Nghe và đoán</div>
                          <div style={styles.exampleText}>
                            Nhấn Play audio để nghe từ. Sau đó gõ lại và Enter để kiểm tra.
                          </div>
                          <div style={styles.btnRowWrap}>
                            <button
                              style={styles.primaryBtn}
                              onClick={() => speak(currentWord.en, settings.voiceLang)}
                            >
                              <Volume2 size={16} /> Play audio
                            </button>
                            <button
                              style={styles.secondaryBtn}
                              onClick={() => speak(currentWord.exampleEn, settings.voiceLang)}
                            >
                              <Headphones size={16} /> Hear sentence
                            </button>
                          </div>
                        </div>

                        <div style={styles.stackGap}>
                          <input
                            key={`listening_${currentWord.id}`}
                            ref={typingRef}
                            autoFocus
                            inputMode="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitListening();
                            }}
                            placeholder="Type what you heard..."
                            style={{ ...styles.input, height: 48, fontSize: 18 }}
                          />

                          <button style={styles.primaryBtn} onClick={submitListening}>
                            Check
                          </button>

                          {feedback && (
                            <div
                              style={{
                                ...styles.feedback,
                                background: feedback.ok ? "#dcfce7" : "#fee2e2",
                                color: feedback.ok ? "#166534" : "#991b1b",
                              }}
                            >
                              {feedback.ok
                                ? `Đúng. ${feedback.answer}`
                                : `Sai. Hãy nhập lại cho đúng.`}
                            </div>
                          )}

                          {!feedback?.ok && feedback && (
                            <div style={styles.btnRowWrap}>
                              <button
                                style={styles.secondaryBtn}
                                onClick={() => setShowHintWord((prev) => !prev)}
                              >
                                {showHintWord ? "Ẩn từ" : "Hiện từ"}
                              </button>
                            </div>
                          )}

                          {showHintWord && (
                            <div style={styles.exampleText}>
                              Từ đúng: <strong>{currentWord.en}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {settings.mode === "quiz" && (
                      <div style={styles.stackGapLg}>
                        <div style={styles.promptBox}>
                          <div style={styles.label}>Choose the correct meaning</div>
                          <div style={styles.flashWordDark}>{currentWord.en}</div>
                          <div style={styles.exampleText}>{currentWord.phonetic}</div>
                        </div>

                        <div style={styles.quizGrid}>
                          {quizOptions(currentWord).map((option) => (
                            <button
                              key={option}
                              onClick={() => setQuizAnswer(option)}
                              style={{
                                ...styles.quizOption,
                                ...(quizAnswer === option ? styles.quizOptionActive : {}),
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>

                        <div style={styles.btnRowWrap}>
                          <button
                            style={styles.primaryBtn}
                            onClick={() => {
                              if (!quizAnswer) return;
                              const ok = quizAnswer === currentWord.vi;
                              setFeedback({ ok, answer: currentWord.vi, vi: currentWord.vi });

                              if (ok) {
                                reviewWord(currentWord, "good", "quiz");
                                setTimeout(() => {
                                  nextCard();
                                }, 450);
                              } else {
                                reviewWord(currentWord, "again", "quiz");
                              }
                            }}
                          >
                            Submit quiz
                          </button>
                        </div>

                        {feedback && (
                          <div
                            style={{
                              ...styles.feedback,
                              background: feedback.ok ? "#dcfce7" : "#fee2e2",
                              color: feedback.ok ? "#166534" : "#991b1b",
                            }}
                          >
                            {feedback.ok
                              ? `Đúng. Nghĩa chính xác là: ${feedback.answer}`
                              : `Sai. Hãy chọn lại cho đúng.`}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={styles.studyFooter}>
                      <div style={styles.btnRowWrap}>
                        <button style={styles.secondaryBtn} onClick={prevCard}>
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <button style={styles.secondaryBtn} onClick={nextCard}>
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                      <div style={styles.muted}>
                        Lần ôn tiếp theo: {currentWord.learning?.nextReview || today()}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}

        {tab === "library" && (
          <div style={styles.libraryGrid}>
            <Card title="Add / Edit word" dark={settings.dark}>
              <div style={styles.formGrid}>
                <Field label="Day" dark={settings.dark}>
                  <input
                    type="number"
                    value={form.day}
                    onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="English word" dark={settings.dark}>
                  <input
                    value={form.en}
                    onChange={(e) => setForm((p) => ({ ...p, en: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Meaning VI" dark={settings.dark}>
                  <input
                    value={form.vi}
                    onChange={(e) => setForm((p) => ({ ...p, vi: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Phonetic" dark={settings.dark}>
                  <input
                    value={form.phonetic}
                    onChange={(e) => setForm((p) => ({ ...p, phonetic: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Type" dark={settings.dark}>
                  <input
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Difficulty (1-5)" dark={settings.dark}>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.difficulty}
                    onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Example EN" dark={settings.dark}>
                  <textarea
                    value={form.exampleEn}
                    onChange={(e) => setForm((p) => ({ ...p, exampleEn: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>
                <Field label="Example VI" dark={settings.dark}>
                  <textarea
                    value={form.exampleVi}
                    onChange={(e) => setForm((p) => ({ ...p, exampleVi: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>
                <Field label="Tags (phân tách bằng dấu phẩy)" dark={settings.dark}>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field
                  label="Collocations (phân tách bằng dấu phẩy)"
                  dark={settings.dark}
                >
                  <input
                    value={form.collocations}
                    onChange={(e) => setForm((p) => ({ ...p, collocations: e.target.value }))}
                    style={styles.input}
                  />
                </Field>
                <Field label="Notes" dark={settings.dark}>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>
              </div>

              <div style={styles.btnRowWrap}>
                <button style={styles.primaryBtn} onClick={saveWord}>
                  <CheckCircle2 size={16} /> {form.id ? "Update word" : "Add word"}
                </button>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => setForm(emptyForm)}
                >
                  <RotateCcw size={16} /> Clear form
                </button>
              </div>
            </Card>

            <Card title="Word library" dark={settings.dark}>
              <div style={styles.filterGrid}>
                <Field label="Search" dark={settings.dark}>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="word, meaning, example..."
                    style={styles.input}
                  />
                </Field>
                <SelectLike
                  label="Tag"
                  value={tagFilter}
                  onChange={setTagFilter}
                  options={["all", ...allTags]}
                  dark={settings.dark}
                />
                <SelectLike
                  label="Day"
                  value={dayLibraryFilter}
                  onChange={setDayLibraryFilter}
                  options={["all", ...allDays]}
                  dark={settings.dark}
                />
              </div>

              <div style={styles.stackGap}>
                {libraryWords.length === 0 && (
                  <div style={styles.empty}>Không có từ phù hợp với bộ lọc.</div>
                )}

                {libraryWords.map((w) => (
                  <div key={w.id} style={styles.wordCard}>
                    <div style={styles.wordHead}>
                      <div>
                        <div style={styles.wordTitle}>{w.en}</div>
                        <div style={styles.muted}>{w.vi}</div>
                      </div>

                      <div style={styles.btnRowWrap}>
                        <button
                          style={styles.iconBtn}
                          onClick={() => speak(w.en, settings.voiceLang)}
                        >
                          <Volume2 size={16} />
                        </button>
                        <button style={styles.iconBtn} onClick={() => editWord(w)}>
                          <Pencil size={16} />
                        </button>
                        <button style={styles.iconBtn} onClick={() => deleteWord(w.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div style={styles.badges}>
                      <Badge dark={settings.dark}>Day {w.day}</Badge>
                      <Badge dark={settings.dark}>{w.type || "Unknown"}</Badge>
                      <Badge dark={settings.dark}>
                        Mastery {w.learning?.mastery || 0}%
                      </Badge>
                    </div>

                    {w.exampleEn && (
                      <div style={styles.exampleBox}>
                        {w.exampleEn}
                        {w.exampleVi ? ` — ${w.exampleVi}` : ""}
                      </div>
                    )}

                    <div style={styles.metaGrid}>
                      <div>Correct: {w.learning?.correct || 0}</div>
                      <div>Wrong: {w.learning?.wrong || 0}</div>
                      <div>Next review: {w.learning?.nextReview || today()}</div>
                      <div>Tags: {(w.tags || []).join(", ") || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "stats" && (
          <div style={styles.sectionGrid}>
            <Card title="Accuracy 7 ngày gần nhất" dark={settings.dark}>
              <div style={styles.stackGap}>
                {recentDays.map((d) => {
                  const dayLogs = logs.filter((x) => x.date === d);
                  const total = dayLogs.length;
                  const correct = dayLogs.filter((x) => x.correct).length;
                  const pct = total ? Math.round((correct / total) * 100) : 0;
                  return (
                    <div key={d}>
                      <div style={styles.lineHead}>
                        <span>{d}</span>
                        <span>
                          {correct}/{total} · {pct}%
                        </span>
                      </div>
                      <div style={styles.progressOuter}>
                        <div style={{ ...styles.progressInner, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Tổng quan" dark={settings.dark}>
              <Metric label="Today attempts" value={todayLogs.length} dark={settings.dark} />
              <Metric label="Today accuracy" value={`${todayAccuracy}%`} dark={settings.dark} />
              <Metric label="Due" value={dueWords.length} dark={settings.dark} />
              <Metric
                label="Difficult words"
                value={difficultWords.length}
                dark={settings.dark}
              />
              <Metric label="Days available" value={allDays.length} dark={settings.dark} />
            </Card>

            <Card title="Frequently missed words" dark={settings.dark}>
              <div style={styles.stackGap}>
                {difficultWords.length === 0 && (
                  <div style={styles.empty}>Chưa có từ khó.</div>
                )}
                {difficultWords.slice(0, 12).map((w) => (
                  <div key={w.id} style={styles.listItem}>
                    <div>
                      <div style={styles.wordTitle}>{w.en}</div>
                      <div style={styles.muted}>{w.vi}</div>
                    </div>
                    <div style={styles.rightMini}>Wrong: {w.learning?.wrong || 0}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "settings" && (
          <div style={styles.sectionGrid}>
            <Card title="Cài đặt" dark={settings.dark}>
              <div style={styles.stackGap}>
                <SelectLike
                  label="Voice"
                  value={settings.voiceLang}
                  onChange={(v) => setSetting("voiceLang", v)}
                  options={["en-US", "en-GB"]}
                  dark={settings.dark}
                />
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={settings.autoSpeak}
                    onChange={(e) => setSetting("autoSpeak", e.target.checked)}
                  />
                  <span>Tự phát âm khi sang card mới ở Flashcard / Listening</span>
                </label>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={!!settings.randomMode}
                    onChange={(e) => setSetting("randomMode", e.target.checked)}
                  />
                  <span>Học ngẫu nhiên mặc định</span>
                </label>
                <button style={styles.secondaryBtn} onClick={exportJson}>
                  <Download size={16} /> Export JSON
                </button>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} /> Import JSON
                </button>
                <button
                  style={{ ...styles.secondaryBtn, borderColor: "#ef4444", color: "#ef4444" }}
                  onClick={resetLearning}
                >
                  <XCircle size={16} /> Reset learning progress
                </button>
                <div style={styles.helpBox}>
                  Nếu sau này bạn muốn dùng trên nhiều thiết bị và tự đồng bộ dữ liệu,
                  bước tiếp theo là nối app này với Supabase hoặc Firebase.
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children, dark }) {
  const styles = getStyles(dark);
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.stackGap}>{children}</div>
    </div>
  );
}

function Field({ label, children, dark }) {
  const styles = getStyles(dark);
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, dark }) {
  const styles = getStyles(dark);
  return (
    <div style={styles.metric}>
      <span style={styles.muted}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value, dark }) {
  const styles = getStyles(dark);
  return (
    <div style={styles.miniStat}>
      <div style={styles.mutedSmall}>{label}</div>
      <div style={styles.miniValue}>{value}</div>
    </div>
  );
}

function Badge({ children, dark }) {
  const styles = getStyles(dark);
  return <span style={styles.badge}>{children}</span>;
}

function ActionCard({ title, value, desc, onClick, dark }) {
  const styles = getStyles(dark);
  return (
    <button style={styles.actionCard} onClick={onClick}>
      <div style={styles.actionValue}>{value}</div>
      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.muted}>{desc}</div>
    </button>
  );
}

function SelectLike({ label, value, onChange, options, dark }) {
  const styles = getStyles(dark);
  const labelMap = {
    typing_word: "Nhập từ theo nghĩa",
    typing_sentence: "Nhập lại câu tiếng Anh",
    flashcard: "Flashcard",
    listening: "Nghe và nhập",
    quiz: "Trắc nghiệm",
    due: "Từ đến hạn",
    all: "Tất cả từ",
    difficult: "Từ khó",
    day: "Theo ngày",
  };

  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
        {options.map((op) => (
          <option key={op} value={op}>
            {labelMap[op] || op}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReviewRow({ onPick }) {
  const btn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        style={{ ...btn, borderColor: "#ef4444", color: "#ef4444" }}
        onClick={() => onPick("again")}
      >
        Again
      </button>
      <button style={btn} onClick={() => onPick("hard")}>
        Hard
      </button>
      <button style={btn} onClick={() => onPick("good")}>
        Good
      </button>
      <button style={btn} onClick={() => onPick("easy")}>
        Easy
      </button>
    </div>
  );
}

function modeText(mode) {
  const map = {
    typing_word: "Nhập từ theo nghĩa",
    typing_sentence: "Nhập lại câu tiếng Anh",
    flashcard: "Flashcard",
    listening: "Nghe và nhập",
    quiz: "Trắc nghiệm",
  };
  return map[mode] || mode;
}

function getStyles(dark) {
  const bg = dark ? "#0f172a" : "#f8fafc";
  const card = dark ? "#111827" : "#ffffff";
  const text = dark ? "#e5e7eb" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#334155" : "#e2e8f0";

  return {
    page: {
      minHeight: "100vh",
      background: bg,
      color: text,
      fontFamily: "Arial, sans-serif",
      padding: 20,
    },
    container: {
      maxWidth: 1400,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    },
    brandRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
    },
    brandIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      background: "#2563eb",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 28, fontWeight: 700 },
    subtitle: {
      marginTop: 6,
      color: muted,
      maxWidth: 800,
      lineHeight: 1.5,
    },
    headerStats: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "stretch",
    },
    miniStat: {
      border: `1px solid ${border}`,
      background: card,
      borderRadius: 16,
      padding: "10px 14px",
      minWidth: 90,
    },
    mutedSmall: { fontSize: 12, color: muted },
    miniValue: { fontSize: 22, fontWeight: 700 },
    smallBtn: {
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 16,
      padding: "10px 14px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    tabRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    tabBtn: {
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 16,
      padding: "10px 14px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    tabBtnActive: {
      background: "#2563eb",
      color: "white",
      borderColor: "#2563eb",
    },
    sectionGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 20,
    },
    libraryGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(320px, 420px) 1fr",
      gap: 20,
    },
    card: {
      border: `1px solid ${border}`,
      background: card,
      borderRadius: 24,
      padding: 20,
      boxShadow: dark ? "none" : "0 12px 30px rgba(15,23,42,0.06)",
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: 700,
      marginBottom: 16,
    },
    stackGap: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    stackGapLg: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
    },
    actionGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 12,
    },
    actionCard: {
      border: `1px solid ${border}`,
      background: dark ? "#0f172a" : "#f8fafc",
      color: text,
      borderRadius: 20,
      padding: 18,
      cursor: "pointer",
      textAlign: "left",
    },
    actionValue: {
      fontSize: 24,
      fontWeight: 700,
      color: "#2563eb",
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: 700,
      marginTop: 4,
      marginBottom: 6,
    },
    muted: {
      color: muted,
      lineHeight: 1.45,
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    fieldLabel: {
      fontWeight: 600,
      fontSize: 14,
    },
    input: {
      width: "100%",
      border: `1px solid ${border}`,
      borderRadius: 14,
      background: card,
      color: text,
      padding: "10px 12px",
      outline: "none",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      minHeight: 92,
      border: `1px solid ${border}`,
      borderRadius: 14,
      background: card,
      color: text,
      padding: "10px 12px",
      outline: "none",
      resize: "vertical",
      boxSizing: "border-box",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 12,
    },
    primaryBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "white",
      borderRadius: 14,
      padding: "10px 14px",
      cursor: "pointer",
    },
    secondaryBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 14,
      padding: "10px 14px",
      cursor: "pointer",
    },
    iconBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 12,
      cursor: "pointer",
    },
    btnRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    btnRowWrap: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    listItem: {
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: 14,
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      alignItems: "center",
    },
    wordCard: {
      border: `1px solid ${border}`,
      borderRadius: 20,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    wordHead: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
    },
    wordTitle: { fontSize: 20, fontWeight: 700 },
    rightMini: { color: muted, whiteSpace: "nowrap" },
    badges: { display: "flex", gap: 8, flexWrap: "wrap" },
    badge: {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: card,
      fontSize: 12,
    },
    exampleBox: {
      background: dark ? "#0f172a" : "#f8fafc",
      borderRadius: 14,
      padding: 12,
      lineHeight: 1.5,
    },
    metaGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
      gap: 8,
      color: muted,
      fontSize: 14,
    },
    filterGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    },
    metric: {
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    empty: {
      border: `1px dashed ${border}`,
      borderRadius: 16,
      padding: 24,
      textAlign: "center",
      color: muted,
    },
    studyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    studyGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 20,
    },
    promptBox: {
      border: `1px solid ${border}`,
      background: dark ? "#0f172a" : "#f8fafc",
      borderRadius: 20,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    label: {
      fontSize: 13,
      color: muted,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    labelLight: {
      fontSize: 13,
      color: "rgba(255,255,255,0.85)",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    promptTitle: { fontSize: 34, fontWeight: 700 },
    exampleText: { color: muted, lineHeight: 1.5 },
    feedback: { padding: 12, borderRadius: 16, fontWeight: 600 },
    flashcard: {
      border: 0,
      borderRadius: 28,
      padding: 28,
      background: "linear-gradient(135deg,#2563eb,#4f46e5)",
      color: "white",
      textAlign: "left",
      cursor: "pointer",
      minHeight: 220,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    },
    flashWord: { fontSize: 44, fontWeight: 800 },
    flashWordDark: { fontSize: 40, fontWeight: 800 },
    flashMeaning: { fontSize: 34, fontWeight: 800 },
    quizGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 12,
    },
    quizOption: {
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 18,
      padding: 16,
      cursor: "pointer",
      textAlign: "left",
    },
    quizOptionActive: {
      borderColor: "#2563eb",
      background: dark ? "#172554" : "#dbeafe",
    },
    studyFooter: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
      paddingTop: 10,
      borderTop: `1px solid ${border}`,
    },
    lineHead: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6,
      fontSize: 14,
    },
    progressOuter: {
      width: "100%",
      height: 10,
      background: dark ? "#1e293b" : "#e2e8f0",
      borderRadius: 999,
      overflow: "hidden",
    },
    progressInner: {
      height: "100%",
      background: "#2563eb",
      borderRadius: 999,
    },
    checkboxRow: {
      display: "flex",
      gap: 10,
      alignItems: "center",
    },
    helpBox: {
      border: `1px dashed ${border}`,
      borderRadius: 16,
      padding: 14,
      color: muted,
      lineHeight: 1.5,
    },
  };
}