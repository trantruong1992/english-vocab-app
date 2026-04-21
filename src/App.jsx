import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  BookOpen,
  Upload,
  Download,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Search,
  BarChart3,
  Settings,
  Star,
} from "lucide-react";

const STORAGE_KEY = "english_vocab_day_study_v1";
const today = () => new Date().toISOString().slice(0, 10);

const defaultLearning = () => ({
  mastered: false,
  masteredAt: null,
  reviewCount: 0,
  lastReviewedAt: null,
});

const defaultItem = {
  id: "",
  day: 1,
  kind: "word", // word | sentence
  en: "",
  vi: "",
  note: "",
  learning: defaultLearning(),
};

const defaultState = {
  items: [
    {
      id: crypto.randomUUID(),
      day: 1,
      kind: "word",
      en: "issue",
      vi: "vấn đề",
      note: "",
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 1,
      kind: "word",
      en: "schedule",
      vi: "lịch trình; lên lịch",
      note: "",
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 1,
      kind: "sentence",
      en: "There is an issue with the app.",
      vi: "Có một vấn đề với ứng dụng.",
      note: "",
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 2,
      kind: "word",
      en: "reliable",
      vi: "đáng tin cậy",
      note: "",
      learning: defaultLearning(),
    },
    {
      id: crypto.randomUUID(),
      day: 2,
      kind: "sentence",
      en: "She is a reliable colleague.",
      vi: "Cô ấy là một đồng nghiệp đáng tin cậy.",
      note: "",
      learning: defaultLearning(),
    },
  ],
  settings: {
    dark: false,
    studyKind: "word", // word | sentence
    source: "unmastered", // all | unmastered
    day: "1",
    randomMode: false,
    autoSpeak: false,
    voiceLang: "en-US",
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
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item, index) => ({
            ...defaultItem,
            ...item,
            id: item.id || `item_${Date.now()}_${index}`,
            kind: item.kind === "sentence" ? "sentence" : "word",
            day: Number(item.day || 1),
            learning: { ...defaultLearning(), ...(item.learning || {}) },
          }))
        : defaultState.items,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeText(text) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ");
}

function speak(text, lang = "en-US") {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

function sortDays(items) {
  return [...new Set(items.map((x) => String(x.day)))].sort((a, b) => Number(a) - Number(b));
}

function getNextDay(days, currentDay) {
  const currentIndex = days.findIndex((d) => String(d) === String(currentDay));
  if (currentIndex === -1) return null;
  return days[currentIndex + 1] || null;
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("dashboard");
  const [searchText, setSearchText] = useState("");
  const [form, setForm] = useState({
    id: null,
    day: 1,
    kind: "word",
    en: "",
    vi: "",
    note: "",
  });
  const [sessionIndex, setSessionIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [answerState, setAnswerState] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [completedIds, setCompletedIds] = useState([]);
  const [lastSessionConfig, setLastSessionConfig] = useState(null);

  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const items = state.items;
  const settings = state.settings;

  const allDays = useMemo(() => sortDays(items), [items]);

  useEffect(() => {
    saveState(state);
    document.body.style.background = settings.dark ? "#0f172a" : "#f8fafc";
  }, [state, settings.dark]);

  function focusInput() {
    const run = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select?.();
      }
    };
    setTimeout(run, 0);
    setTimeout(run, 100);
    setTimeout(run, 220);
  }

  useEffect(() => {
    if (tab === "study" && !sessionFinished) {
      focusInput();
    }
  }, [tab, sessionIndex, settings.studyKind, settings.day, settings.source, sessionFinished]);

  const filteredLibrary = useMemo(() => {
    return items.filter((item) => {
      const hay = `${item.en} ${item.vi} ${item.note}`.toLowerCase();
      return !searchText || hay.includes(searchText.toLowerCase());
    });
  }, [items, searchText]);

  const currentSessionItems = useMemo(() => {
    let arr = items.filter(
      (item) =>
        item.kind === settings.studyKind && String(item.day) === String(settings.day)
    );

    if (settings.source === "unmastered") {
      arr = arr.filter((item) => !item.learning?.mastered);
    }

    if (settings.randomMode) {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    return arr;
  }, [items, settings.studyKind, settings.day, settings.source, settings.randomMode]);

  const currentItem = currentSessionItems[sessionIndex] || null;

  const sessionStats = useMemo(() => {
    const total = currentSessionItems.length;
    const mastered = currentSessionItems.filter((item) => item.learning?.mastered).length;
    const unmastered = total - mastered;
    return { total, mastered, unmastered };
  }, [currentSessionItems]);

  const currentDayStats = useMemo(() => {
    const dayItems = items.filter(
      (item) => item.kind === settings.studyKind && String(item.day) === String(settings.day)
    );
    const total = dayItems.length;
    const mastered = dayItems.filter((item) => item.learning?.mastered).length;
    const unmastered = total - mastered;
    return { total, mastered, unmastered };
  }, [items, settings.studyKind, settings.day]);

  useEffect(() => {
    setSessionIndex(0);
    setTyped("");
    setAnswerState(null);
    setShowAnswer(false);
    setSessionFinished(false);
    setCompletedIds([]);
  }, [settings.studyKind, settings.day, settings.source, settings.randomMode]);

  useEffect(() => {
    if (currentItem && settings.autoSpeak) {
      speak(currentItem.en, settings.voiceLang);
    }
  }, [currentItem, settings.autoSpeak, settings.voiceLang]);

  function setSetting(key, value) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  }

  function updateItemLearning(itemId, patch) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              learning: {
                ...defaultLearning(),
                ...(item.learning || {}),
                ...patch,
              },
            }
          : item
      ),
    }));
  }

  function goNextCard(afterMarkMastered = false) {
    const newCompleted = completedIds.includes(currentItem.id)
      ? completedIds
      : [...completedIds, currentItem.id];
    setCompletedIds(newCompleted);

    const nextIndex = sessionIndex + 1;
    if (nextIndex >= currentSessionItems.length) {
      setSessionFinished(true);
      setLastSessionConfig({
        studyKind: settings.studyKind,
        day: settings.day,
        source: settings.source,
        randomMode: settings.randomMode,
        endedAt: today(),
      });
      return;
    }

    setSessionIndex(nextIndex);
    setTyped("");
    setAnswerState(afterMarkMastered ? { ok: true, text: "Đã đánh dấu thuộc." } : null);
    setShowAnswer(false);
    setTimeout(() => {
      setAnswerState(null);
      focusInput();
    }, 150);
  }

  function submitAnswer() {
    if (!currentItem) return;
    const isCorrect = normalizeText(typed) === normalizeText(currentItem.en);

    updateItemLearning(currentItem.id, {
      reviewCount: Number(currentItem.learning?.reviewCount || 0) + 1,
      lastReviewedAt: today(),
    });

    if (isCorrect) {
      setAnswerState({ ok: true, text: "Đúng rồi" });
      setTyped("");
      setShowAnswer(false);
      setTimeout(() => {
        goNextCard(false);
      }, 350);
    } else {
      setAnswerState({ ok: false, text: "Sai rồi, hãy xem đáp án và nhập lại." });
      focusInput();
    }
  }

  function markMastered() {
    if (!currentItem) return;

    updateItemLearning(currentItem.id, {
      mastered: true,
      masteredAt: today(),
      reviewCount: Number(currentItem.learning?.reviewCount || 0) + 1,
      lastReviewedAt: today(),
    });

    setTyped("");
    setShowAnswer(false);
    setAnswerState({ ok: true, text: "Đã đánh dấu thuộc." });

    setTimeout(() => {
      goNextCard(true);
    }, 300);
  }

  function replayCurrentMode(source) {
    setSetting("source", source);
    setSessionIndex(0);
    setTyped("");
    setAnswerState(null);
    setShowAnswer(false);
    setSessionFinished(false);
    setCompletedIds([]);
    setTab("study");
  }

  function studyNextDay() {
    const nextDay = getNextDay(allDays, settings.day);
    if (!nextDay) return;
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, day: String(nextDay) },
    }));
    setSessionIndex(0);
    setTyped("");
    setAnswerState(null);
    setShowAnswer(false);
    setSessionFinished(false);
    setCompletedIds([]);
    setTab("study");
  }

  function saveFormItem() {
    if (!form.en.trim() || !form.vi.trim()) return;

    const payload = {
      id: form.id || crypto.randomUUID(),
      day: Number(form.day || 1),
      kind: form.kind,
      en: form.en.trim(),
      vi: form.vi.trim(),
      note: form.note.trim(),
      learning: form.id
        ? items.find((item) => item.id === form.id)?.learning || defaultLearning()
        : defaultLearning(),
    };

    setState((prev) => ({
      ...prev,
      items: prev.items.some((item) => item.id === payload.id)
        ? prev.items.map((item) => (item.id === payload.id ? payload : item))
        : [payload, ...prev.items],
    }));

    setForm({
      id: null,
      day: Number(settings.day || 1),
      kind: settings.studyKind,
      en: "",
      vi: "",
      note: "",
    });
  }

  function editItem(item) {
    setForm({
      id: item.id,
      day: item.day,
      kind: item.kind,
      en: item.en,
      vi: item.vi,
      note: item.note || "",
    });
    setTab("library");
  }

  function deleteItem(id) {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocab-day-study-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let raw = String(e.target?.result || "");

        // bỏ BOM nếu có
        raw = raw.replace(/^﻿/, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // thử sửa một số dấu quote “ ” ‘ ’ nếu file bị copy từ nguồn khác
          const normalizedRaw = raw
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'");
          parsed = JSON.parse(normalizedRaw);
        }

        const toSafeLearning = (learning) => ({
          ...defaultLearning(),
          ...(learning || {}),
          mastered: !!learning?.mastered,
          masteredAt: learning?.masteredAt || null,
          reviewCount: Number(learning?.reviewCount || 0),
          lastReviewedAt: learning?.lastReviewedAt || null,
        });

        const mapWordRecordToItems = (word, index) => {
          const baseId = word.id || `word_${Date.now()}_${index}`;
          const day = Number(word.day || 1);
          const note = word.note || word.notes || "";
          const learning = toSafeLearning(word.learning);

          const result = [];

          if ((word.en || "").trim() || (word.vi || "").trim()) {
            result.push({
              id: `${baseId}_word`,
              day,
              kind: "word",
              en: String(word.en || "").trim(),
              vi: String(word.vi || "").trim(),
              note,
              learning,
            });
          }

          if ((word.exampleEn || "").trim() || (word.exampleVi || "").trim()) {
            result.push({
              id: `${baseId}_sentence`,
              day,
              kind: "sentence",
              en: String(word.exampleEn || "").trim(),
              vi: String(word.exampleVi || word.vi || "").trim(),
              note,
              learning,
            });
          }

          return result;
        };

        const normalizeImportedItem = (item, index) => ({
          ...defaultItem,
          ...item,
          id: item.id || `item_${Date.now()}_${index}`,
          day: Number(item.day || 1),
          kind: item.kind === "sentence" ? "sentence" : "word",
          en: String(item.en || "").trim(),
          vi: String(item.vi || "").trim(),
          note: String(item.note || item.notes || "").trim(),
          learning: toSafeLearning(item.learning),
        });

        // 1) format mới đầy đủ của app
        if (parsed && Array.isArray(parsed.items)) {
          setState({
            ...defaultState,
            ...parsed,
            items: parsed.items.map(normalizeImportedItem),
            settings: { ...defaultState.settings, ...(parsed.settings || {}) },
          });
          return;
        }

        // 2) format cũ: { words: [...] }
        if (parsed && Array.isArray(parsed.words)) {
          const convertedItems = parsed.words.flatMap(mapWordRecordToItems);
          setState((prev) => ({
            ...prev,
            items: convertedItems,
          }));
          return;
        }

        // 3) top-level array: có thể là items mới hoặc words cũ
        if (Array.isArray(parsed)) {
          const looksLikeOldWords = parsed.some(
            (x) => x && (Object.prototype.hasOwnProperty.call(x, "exampleEn") || !Object.prototype.hasOwnProperty.call(x, "kind"))
          );

          const convertedItems = looksLikeOldWords
            ? parsed.flatMap(mapWordRecordToItems)
            : parsed.map(normalizeImportedItem);

          setState((prev) => ({
            ...prev,
            items: convertedItems,
          }));
          return;
        }

        throw new Error("Unsupported JSON format");
      } catch (err) {
        console.error("Import JSON error:", err);
        alert(
          "Không đọc được file JSON. Hãy kiểm tra file có đúng JSON không. App hiện hỗ trợ 3 kiểu: { items: [...] }, { words: [...] }, hoặc mảng dữ liệu trực tiếp."
        );
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function resetAllMasteredOfCurrentFilter(toSource) {
    const targetIds = items
      .filter(
        (item) =>
          item.kind === settings.studyKind &&
          String(item.day) === String(settings.day) &&
          (toSource === "all" || !item.learning?.mastered)
      )
      .map((item) => item.id);

    setCompletedIds([]);
    setSessionIndex(0);
    setTyped("");
    setAnswerState(null);
    setShowAnswer(false);
    setSessionFinished(false);

    if (toSource === "all") {
      setSetting("source", "all");
    } else {
      setSetting("source", "unmastered");
    }
  }

  const nextDay = getNextDay(allDays, settings.day);
  const styles = getStyles(settings.dark);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.brandWrap}>
            <div style={styles.brandIcon}><Brain size={20} /></div>
            <div>
              <div style={styles.title}>Ứng dụng học từ vựng theo ngày</div>
              <div style={styles.subtitle}>
                Giữ giao diện đẹp, giữ import/export, tập trung đúng các chức năng học từ và học câu theo ngày, chọn học tất cả hoặc chưa thuộc, đánh dấu đã thuộc, và học xong có thống kê để học tiếp hoặc học lại.
              </div>
            </div>
          </div>

          <div style={styles.topStats}>
            <MiniStat label="Tổng mục" value={items.length} dark={settings.dark} />
            <MiniStat label="Ngày hiện tại" value={settings.day} dark={settings.dark} />
            <MiniStat label="Đã thuộc" value={currentDayStats.mastered} dark={settings.dark} />
            <button style={styles.smallBtn} onClick={() => setSetting("dark", !settings.dark)}>
              <Settings size={16} /> {settings.dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <div style={styles.tabRow}>
          {[
            ["dashboard", <BookOpen size={16} />, "Dashboard"],
            ["study", <Brain size={16} />, "Học"],
            ["library", <Search size={16} />, "Thư viện"],
            ["stats", <BarChart3 size={16} />, "Thống kê"],
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

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => importJson(e.target.files?.[0])}
        />

        {tab === "dashboard" && (
          <div style={styles.grid}>
            <Card title="Bắt đầu nhanh" dark={settings.dark}>
              <div style={styles.actionGrid}>
                <ActionCard
                  dark={settings.dark}
                  title="Học từ chưa thuộc"
                  value={`${items.filter((x) => x.kind === "word" && !x.learning?.mastered).length} mục`}
                  desc="Chỉ học từ chưa thuộc"
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, studyKind: "word", source: "unmastered" },
                    }));
                    setTab("study");
                  }}
                />
                <ActionCard
                  dark={settings.dark}
                  title="Học câu chưa thuộc"
                  value={`${items.filter((x) => x.kind === "sentence" && !x.learning?.mastered).length} mục`}
                  desc="Chỉ học câu chưa thuộc"
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, studyKind: "sentence", source: "unmastered" },
                    }));
                    setTab("study");
                  }}
                />
                <ActionCard
                  dark={settings.dark}
                  title="Học tất cả"
                  value={`${items.length} mục`}
                  desc="Ôn lại toàn bộ khi cần"
                  onClick={() => {
                    setSetting("source", "all");
                    setTab("study");
                  }}
                />
              </div>
            </Card>

            <Card title="Ngày đang chọn" dark={settings.dark}>
              <Metric label="Loại học" value={settings.studyKind === "word" ? "Từ" : "Câu"} dark={settings.dark} />
              <Metric label="Ngày" value={settings.day} dark={settings.dark} />
              <Metric label="Đã thuộc" value={currentDayStats.mastered} dark={settings.dark} />
              <Metric label="Chưa thuộc" value={currentDayStats.unmastered} dark={settings.dark} />
            </Card>

            <Card title="Dữ liệu" dark={settings.dark}>
              <div style={styles.stack}>
                <button style={styles.primaryBtn} onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Import JSON
                </button>
                <button style={styles.secondaryBtn} onClick={exportJson}>
                  <Download size={16} /> Export JSON
                </button>
              </div>
            </Card>
          </div>
        )}

        {tab === "study" && (
          <div style={styles.stackLarge}>
            <Card title="Cấu hình phiên học" dark={settings.dark}>
              <div style={styles.filterGrid}>
                <SelectLike
                  label="Loại học"
                  value={settings.studyKind}
                  onChange={(v) => setSetting("studyKind", v)}
                  options={["word", "sentence"]}
                  dark={settings.dark}
                />
                <SelectLike
                  label="Ngày học"
                  value={settings.day}
                  onChange={(v) => setSetting("day", v)}
                  options={allDays.length ? allDays : ["1"]}
                  dark={settings.dark}
                />
                <SelectLike
                  label="Nguồn học"
                  value={settings.source}
                  onChange={(v) => setSetting("source", v)}
                  options={["all", "unmastered"]}
                  dark={settings.dark}
                />
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={settings.randomMode}
                    onChange={(e) => setSetting("randomMode", e.target.checked)}
                  />
                  <span>Học ngẫu nhiên</span>
                </label>
              </div>
            </Card>

            {currentSessionItems.length === 0 ? (
              <Card title="Phiên học" dark={settings.dark}>
                <div style={styles.empty}>Không có dữ liệu để học ở bộ lọc này.</div>
              </Card>
            ) : sessionFinished ? (
              <Card title="Kết thúc lượt học" dark={settings.dark}>
                <div style={styles.finishBox}>
                  <div style={styles.finishTitle}>Hoàn thành lượt học</div>
                  <div style={styles.finishStatsGrid}>
                    <FinishStat label="Đã thuộc" value={currentDayStats.mastered} dark={settings.dark} />
                    <FinishStat label="Chưa thuộc" value={currentDayStats.unmastered} dark={settings.dark} />
                    <FinishStat label="Tổng" value={currentDayStats.total} dark={settings.dark} />
                  </div>

                  <div style={styles.finishActions}>
                    <button
                      style={styles.primaryBtn}
                      onClick={studyNextDay}
                      disabled={!nextDay}
                    >
                      Học ngày tiếp theo
                    </button>
                    <button style={styles.secondaryBtn} onClick={() => replayCurrentMode("all")}>
                      Học lại ngày hiện tại
                    </button>
                    <button style={styles.secondaryBtn} onClick={() => replayCurrentMode("all")}>
                      Học lại tất cả
                    </button>
                    <button style={styles.secondaryBtn} onClick={() => replayCurrentMode("unmastered")}>
                      Học lại chưa thuộc
                    </button>
                  </div>

                  {!nextDay && (
                    <div style={styles.helpText}>Hiện chưa có ngày tiếp theo trong dữ liệu.</div>
                  )}
                </div>
              </Card>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card title={settings.studyKind === "word" ? "Học từ theo ngày" : "Học câu theo ngày"} dark={settings.dark}>
                    <div style={styles.studyTop}>
                      <div style={styles.badgeRow}>
                        <Badge dark={settings.dark}>Ngày {currentItem.day}</Badge>
                        <Badge dark={settings.dark}>{currentItem.kind === "word" ? "Từ" : "Câu"}</Badge>
                        <Badge dark={settings.dark}>{currentItem.learning?.mastered ? "Đã thuộc" : "Chưa thuộc"}</Badge>
                      </div>
                      <div style={styles.muted}>Mục {sessionIndex + 1} / {currentSessionItems.length}</div>
                    </div>

                    <div style={styles.studyGrid}>
                      <div style={styles.promptBox}>
                        <div style={styles.promptLabel}>Nghĩa tiếng Việt</div>
                        <div style={styles.promptText}>{currentItem.vi}</div>
                        {currentItem.note ? <div style={styles.helpText}>{currentItem.note}</div> : null}
                        <div style={styles.helpText}>
                          Nhập đúng {settings.studyKind === "word" ? "từ tiếng Anh" : "câu tiếng Anh"}. Nếu quên, bấm hiện đáp án.
                        </div>
                      </div>

                      <div style={styles.stack}>
                        <input
                          ref={inputRef}
                          autoFocus
                          value={typed}
                          onChange={(e) => setTyped(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                          placeholder={settings.studyKind === "word" ? "Nhập từ tiếng Anh..." : "Nhập câu tiếng Anh..."}
                          style={{ ...styles.input, minHeight: 50, fontSize: 18 }}
                        />

                        <div style={styles.buttonRow}>
                          <button style={styles.primaryBtn} onClick={submitAnswer}>
                            <CheckCircle2 size={16} /> Kiểm tra
                          </button>
                          <button style={styles.secondaryBtn} onClick={markMastered}>
                            <Star size={16} /> Đánh dấu đã thuộc
                          </button>
                          <button style={styles.secondaryBtn} onClick={() => setShowAnswer((prev) => !prev)}>
                            {showAnswer ? "Ẩn đáp án" : "Hiện đáp án"}
                          </button>
                          <button style={styles.secondaryBtn} onClick={() => speak(currentItem.en, settings.voiceLang)}>
                            <Volume2 size={16} /> Nghe
                          </button>
                        </div>

                        {answerState && (
                          <div
                            style={{
                              ...styles.feedback,
                              background: answerState.ok ? "#dcfce7" : "#fee2e2",
                              color: answerState.ok ? "#166534" : "#991b1b",
                            }}
                          >
                            {answerState.text}
                          </div>
                        )}

                        {showAnswer && (
                          <div style={styles.answerBox}>
                            <div style={styles.answerLabel}>Đáp án</div>
                            <div style={styles.answerText}>{currentItem.en}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.studyFooter}>
                      <button
                        style={styles.secondaryBtn}
                        onClick={() => {
                          if (sessionIndex === 0) return;
                          setSessionIndex((prev) => prev - 1);
                          setTyped("");
                          setAnswerState(null);
                          setShowAnswer(false);
                        }}
                      >
                        <ChevronLeft size={16} /> Trước
                      </button>

                      <div style={styles.footerStats}>
                        <span>Đã thuộc: {currentDayStats.mastered}</span>
                        <span>Chưa thuộc: {currentDayStats.unmastered}</span>
                      </div>

                      <button
                        style={styles.secondaryBtn}
                        onClick={() => {
                          if (sessionIndex >= currentSessionItems.length - 1) {
                            setSessionFinished(true);
                            return;
                          }
                          setSessionIndex((prev) => prev + 1);
                          setTyped("");
                          setAnswerState(null);
                          setShowAnswer(false);
                        }}
                      >
                        Sau <ChevronRight size={16} />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}

        {tab === "library" && (
          <div style={styles.libraryGrid}>
            <Card title="Thêm / sửa dữ liệu" dark={settings.dark}>
              <div style={styles.formGrid}>
                <Field label="Ngày" dark={settings.dark}>
                  <input
                    type="number"
                    value={form.day}
                    onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value }))}
                    style={styles.input}
                  />
                </Field>

                <SelectLike
                  label="Loại dữ liệu"
                  value={form.kind}
                  onChange={(v) => setForm((prev) => ({ ...prev, kind: v }))}
                  options={["word", "sentence"]}
                  dark={settings.dark}
                />

                <Field label={form.kind === "word" ? "Từ / câu tiếng Anh" : "Câu tiếng Anh"} dark={settings.dark}>
                  <textarea
                    value={form.en}
                    onChange={(e) => setForm((prev) => ({ ...prev, en: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Nghĩa / bản dịch tiếng Việt" dark={settings.dark}>
                  <textarea
                    value={form.vi}
                    onChange={(e) => setForm((prev) => ({ ...prev, vi: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Ghi chú" dark={settings.dark}>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    style={styles.textarea}
                  />
                </Field>
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.primaryBtn} onClick={saveFormItem}>
                  {form.id ? "Cập nhật" : "Thêm mới"}
                </button>
                <button
                  style={styles.secondaryBtn}
                  onClick={() =>
                    setForm({
                      id: null,
                      day: Number(settings.day || 1),
                      kind: settings.studyKind,
                      en: "",
                      vi: "",
                      note: "",
                    })
                  }
                >
                  <RotateCcw size={16} /> Làm mới form
                </button>
              </div>
            </Card>

            <Card title="Thư viện dữ liệu" dark={settings.dark}>
              <Field label="Tìm kiếm" dark={settings.dark}>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Tìm theo tiếng Anh, tiếng Việt, ghi chú..."
                  style={styles.input}
                />
              </Field>

              <div style={styles.stack}>
                {filteredLibrary.length === 0 ? (
                  <div style={styles.empty}>Không có dữ liệu phù hợp.</div>
                ) : (
                  filteredLibrary.map((item) => (
                    <div key={item.id} style={styles.itemCard}>
                      <div style={styles.itemHead}>
                        <div>
                          <div style={styles.itemTitle}>{item.en}</div>
                          <div style={styles.muted}>{item.vi}</div>
                        </div>
                        <div style={styles.buttonRow}>
                          <button style={styles.iconBtn} onClick={() => speak(item.en, settings.voiceLang)}>
                            <Volume2 size={16} />
                          </button>
                          <button style={styles.secondaryBtn} onClick={() => editItem(item)}>Sửa</button>
                          <button style={styles.secondaryBtn} onClick={() => deleteItem(item.id)}>Xóa</button>
                        </div>
                      </div>

                      <div style={styles.badgeRow}>
                        <Badge dark={settings.dark}>Ngày {item.day}</Badge>
                        <Badge dark={settings.dark}>{item.kind === "word" ? "Từ" : "Câu"}</Badge>
                        <Badge dark={settings.dark}>{item.learning?.mastered ? "Đã thuộc" : "Chưa thuộc"}</Badge>
                      </div>

                      {item.note ? <div style={styles.noteBox}>{item.note}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "stats" && (
          <div style={styles.grid}>
            <Card title="Thống kê từ" dark={settings.dark}>
              <Metric
                label="Tổng từ"
                value={items.filter((item) => item.kind === "word").length}
                dark={settings.dark}
              />
              <Metric
                label="Từ đã thuộc"
                value={items.filter((item) => item.kind === "word" && item.learning?.mastered).length}
                dark={settings.dark}
              />
              <Metric
                label="Từ chưa thuộc"
                value={items.filter((item) => item.kind === "word" && !item.learning?.mastered).length}
                dark={settings.dark}
              />
            </Card>

            <Card title="Thống kê câu" dark={settings.dark}>
              <Metric
                label="Tổng câu"
                value={items.filter((item) => item.kind === "sentence").length}
                dark={settings.dark}
              />
              <Metric
                label="Câu đã thuộc"
                value={items.filter((item) => item.kind === "sentence" && item.learning?.mastered).length}
                dark={settings.dark}
              />
              <Metric
                label="Câu chưa thuộc"
                value={items.filter((item) => item.kind === "sentence" && !item.learning?.mastered).length}
                dark={settings.dark}
              />
            </Card>

            <Card title="Theo ngày hiện tại" dark={settings.dark}>
              <Metric label="Ngày" value={settings.day} dark={settings.dark} />
              <Metric label="Đã thuộc" value={currentDayStats.mastered} dark={settings.dark} />
              <Metric label="Chưa thuộc" value={currentDayStats.unmastered} dark={settings.dark} />
              <Metric label="Tổng" value={currentDayStats.total} dark={settings.dark} />
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
      <div style={styles.stack}>{children}</div>
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

function FinishStat({ label, value, dark }) {
  const styles = getStyles(dark);
  return (
    <div style={styles.finishStat}>
      <div style={styles.muted}>{label}</div>
      <div style={styles.finishValue}>{value}</div>
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
    word: "Học từ",
    sentence: "Học câu",
    all: "Học tất cả",
    unmastered: "Học chưa thuộc",
  };

  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelMap[option] || option}
          </option>
        ))}
      </select>
    </div>
  );
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
    brandWrap: {
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
    },
    brandIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      background: "#2563eb",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    title: {
      fontSize: 28,
      fontWeight: 800,
    },
    subtitle: {
      marginTop: 6,
      color: muted,
      lineHeight: 1.5,
      maxWidth: 820,
    },
    topStats: {
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
      minWidth: 100,
    },
    mutedSmall: {
      fontSize: 12,
      color: muted,
    },
    miniValue: {
      fontSize: 22,
      fontWeight: 800,
    },
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
    grid: {
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
      fontWeight: 800,
      marginBottom: 16,
    },
    stack: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    stackLarge: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: 700,
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
      minHeight: 90,
      border: `1px solid ${border}`,
      borderRadius: 14,
      background: card,
      color: text,
      padding: "10px 12px",
      outline: "none",
      resize: "vertical",
      boxSizing: "border-box",
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
      width: 38,
      height: 38,
      border: `1px solid ${border}`,
      background: card,
      color: text,
      borderRadius: 12,
      cursor: "pointer",
    },
    actionGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
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
      fontWeight: 800,
      color: "#2563eb",
    },
    actionTitle: {
      fontWeight: 800,
      marginTop: 4,
      marginBottom: 6,
    },
    muted: {
      color: muted,
      lineHeight: 1.45,
    },
    metric: {
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    filterGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    },
    checkboxRow: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      minHeight: 46,
    },
    empty: {
      border: `1px dashed ${border}`,
      borderRadius: 16,
      padding: 22,
      textAlign: "center",
      color: muted,
    },
    studyTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
    },
    badgeRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    badge: {
      border: `1px solid ${border}`,
      background: card,
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
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
    promptLabel: {
      fontSize: 13,
      color: muted,
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    promptText: {
      fontSize: 32,
      fontWeight: 800,
      lineHeight: 1.3,
    },
    helpText: {
      color: muted,
      lineHeight: 1.5,
    },
    buttonRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    feedback: {
      padding: 12,
      borderRadius: 16,
      fontWeight: 700,
    },
    answerBox: {
      border: `1px dashed ${border}`,
      borderRadius: 16,
      padding: 14,
      background: dark ? "#0f172a" : "#f8fafc",
    },
    answerLabel: {
      fontSize: 13,
      color: muted,
      fontWeight: 700,
      marginBottom: 6,
    },
    answerText: {
      fontSize: 22,
      fontWeight: 800,
      wordBreak: "break-word",
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
    footerStats: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      color: muted,
      fontWeight: 600,
    },
    finishBox: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
    finishTitle: {
      fontSize: 28,
      fontWeight: 800,
    },
    finishStatsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 12,
    },
    finishStat: {
      border: `1px solid ${border}`,
      background: dark ? "#0f172a" : "#f8fafc",
      borderRadius: 18,
      padding: 16,
    },
    finishValue: {
      fontSize: 28,
      fontWeight: 800,
      marginTop: 6,
    },
    finishActions: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 12,
    },
    itemCard: {
      border: `1px solid ${border}`,
      borderRadius: 20,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    itemHead: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    itemTitle: {
      fontSize: 20,
      fontWeight: 800,
      wordBreak: "break-word",
    },
    noteBox: {
      borderRadius: 14,
      padding: 12,
      background: dark ? "#0f172a" : "#f8fafc",
      color: muted,
      lineHeight: 1.5,
    },
  };
}
