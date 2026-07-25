(() => {
      const hours = Array.from({ length: 16 }, (_, index) => index + 7);
      const dayPlans = Array.from({ length: 4 }, (_, index) => index);
      const fields = ["wake", "battery", "plan"];
      const scheduleFields = ["scheduleWants", "scheduleMusts", "scheduleFixed", "scheduleDraft"];
      const today = new Date();
      const previousDate = new Date(today);
      previousDate.setDate(previousDate.getDate() - 1);

      const dateKey = formatDate(today, "-");
      const previousDateKey = formatDate(previousDate, "-");
      const storageKey = `halulog:${dateKey}`;
      const previousStorageKey = `halulog:${previousDateKey}`;
      const scheduleStorageKey = "halulog:schedule";
      const todayLabel = formatDate(today, "/");
      const previousDateLabel = formatDate(previousDate, "/");

      const dayList = document.getElementById("dayList");
      const hourList = document.getElementById("hourList");
      const message = document.getElementById("message");
      const yesterdaySection = document.getElementById("yesterdaySection");
      const yesterdayReview = document.getElementById("yesterdayReview");
      const reviewStatus = document.getElementById("reviewStatus");
      const previousPlanContent = document.getElementById("previousPlanContent");

      document.getElementById("todayText").textContent = `今日：${todayLabel}`;
      document.getElementById("yesterdayDateText").textContent = previousDateLabel;

      dayPlans.forEach((index) => {
        const card = document.createElement("div");
        card.className = "day-card";

        const heading = document.createElement("div");
        heading.className = "day-heading";

        const number = document.createElement("div");
        number.className = "day-number";
        number.textContent = `第${index + 1}日`;

        const time = document.createElement("div");
        time.className = "day-time";
        time.id = `day-time-${index}`;

        const textarea = document.createElement("textarea");
        textarea.id = `day-plan-${index}`;
        textarea.dataset.dayPlan = String(index);
        textarea.setAttribute("aria-label", `第${index + 1}日の予定`);
        textarea.placeholder = "この4時間の主目的をひとつ";

        heading.append(number, time);
        card.append(heading, textarea);
        dayList.append(card);
      });

      hours.forEach((hour) => {
        const row = document.createElement("div");
        row.className = "hour-row";

        const time = document.createElement("div");
        time.className = "hour";
        time.textContent = `${hour}:00`;

        const textarea = document.createElement("textarea");
        textarea.id = `hour-${hour}`;
        textarea.dataset.hour = String(hour);
        textarea.setAttribute("aria-label", `${hour}:00 のメモ`);
        textarea.placeholder = "やったことだけ";

        row.append(time, textarea);
        hourList.append(row);
      });

      const data = loadData(storageKey);
      const previousData = loadData(previousStorageKey);
      const scheduleData = loadData(scheduleStorageKey);
      restoreData(data);
      restoreScheduleData(scheduleData);
      setupYesterdayReview(data.yesterdayReview || {}, previousData);

      document.addEventListener("input", saveFromEvent);
      document.addEventListener("change", saveFromEvent);

      document.getElementById("completeReviewButton").addEventListener("click", () => {
        yesterdayReview.dataset.completed = "true";
        yesterdayReview.dataset.skipped = "false";
        yesterdayReview.open = false;
        reviewStatus.textContent = "記録済み";
        saveData();
        document.getElementById("todayStart").scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => document.getElementById("wake").focus(), 350);
      });

      document.getElementById("skipReviewButton").addEventListener("click", () => {
        yesterdayReview.dataset.completed = "true";
        yesterdayReview.dataset.skipped = "true";
        yesterdayReview.open = false;
        reviewStatus.textContent = "スキップ済み";
        saveData();
        document.getElementById("todayStart").scrollIntoView({ behavior: "smooth", block: "start" });
      });

      document.getElementById("copyButton").addEventListener("click", async () => {
        const text = buildCopyText();

        try {
          await copyText(text);
          showMessage("コピーしました");
        } catch (error) {
          showMessage("コピーできませんでした。本文を選んでコピーしてください。");
        }
      });

      function saveFromEvent(event) {
        if (event.target.id === "wake") {
          updateDayTimes();
        }

        if (!event.target.matches("input, textarea")) return;

        const saved = scheduleFields.includes(event.target.id)
          ? saveScheduleData()
          : saveData();
        showMessage(saved ? "保存しました" : "保存できませんでした", 900);
      }

      function formatDate(date, separator) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}${separator}${month}${separator}${day}`;
      }

      function loadData(key) {
        try {
          return JSON.parse(localStorage.getItem(key)) || {};
        } catch (error) {
          return {};
        }
      }

      function restoreData(saved) {
        fields.forEach((id) => {
          document.getElementById(id).value = saved[id] || "";
        });

        dayPlans.forEach((index) => {
          document.getElementById(`day-plan-${index}`).value = saved.dayPlans?.[index] || "";
        });

        hours.forEach((hour) => {
          document.getElementById(`hour-${hour}`).value = saved.logs?.[hour] || "";
        });

        updateDayTimes();
      }

      function restoreScheduleData(saved) {
        scheduleFields.forEach((id) => {
          document.getElementById(id).value = saved[id] || "";
        });
      }

      function collectScheduleData() {
        const schedule = {};
        scheduleFields.forEach((id) => {
          schedule[id] = document.getElementById(id).value;
        });
        return schedule;
      }

      function saveScheduleData() {
        try {
          localStorage.setItem(scheduleStorageKey, JSON.stringify(collectScheduleData()));
          return true;
        } catch (error) {
          return false;
        }
      }

      function setupYesterdayReview(savedReview, savedPreviousData) {
        if (!hasMeaningfulLog(savedPreviousData)) {
          yesterdaySection.hidden = true;
          return;
        }

        yesterdaySection.hidden = false;
        renderPreviousPlan(savedPreviousData);

        setCheckedValue("reviewResult", savedReview.result || "");
        setCheckedValue("reviewDuration", savedReview.duration || "");
        document.getElementById("reviewNote").value = savedReview.note || "";

        const isForPreviousDate = !savedReview.previousDate || savedReview.previousDate === previousDateKey;
        const completed = isForPreviousDate && Boolean(savedReview.completed);
        const skipped = completed && Boolean(savedReview.skipped);

        yesterdayReview.dataset.completed = String(completed);
        yesterdayReview.dataset.skipped = String(skipped);
        yesterdayReview.open = !completed;
        reviewStatus.textContent = completed ? (skipped ? "スキップ済み" : "記録済み") : "30秒で振り返り";
      }

      function hasMeaningfulLog(saved) {
        if (!saved || typeof saved !== "object") return false;
        if ([saved.wake, saved.battery, saved.plan].some(hasText)) return true;
        if (Object.values(saved.dayPlans || {}).some(hasText)) return true;
        return Object.values(saved.logs || {}).some(hasText);
      }

      function hasText(value) {
        return String(value || "").trim().length > 0;
      }

      function renderPreviousPlan(saved) {
        previousPlanContent.replaceChildren();
        const items = [];

        if (hasText(saved.plan)) {
          items.push(saved.plan.trim());
        }

        dayPlans.forEach((index) => {
          const text = saved.dayPlans?.[index];
          if (!hasText(text)) return;
          const timeLabel = getDayTimeLabelFromWake(saved.wake, index);
          items.push(`第${index + 1}日（${timeLabel}） ${text.trim()}`);
        });

        if (items.length === 0) {
          const empty = document.createElement("p");
          empty.className = "previous-plan-empty";
          empty.textContent = "予定の記録はありません";
          previousPlanContent.append(empty);
          return;
        }

        const list = document.createElement("ul");
        list.className = "previous-plan-list";
        items.forEach((text) => {
          const item = document.createElement("li");
          item.textContent = text;
          list.append(item);
        });
        previousPlanContent.append(list);
      }

      function setCheckedValue(name, value) {
        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
          input.checked = input.value === value;
        });
      }

      function getCheckedValue(name) {
        return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
      }

      function collectData() {
        const plannedDays = {};
        dayPlans.forEach((index) => {
          plannedDays[index] = document.getElementById(`day-plan-${index}`).value;
        });

        const logs = {};
        hours.forEach((hour) => {
          logs[hour] = document.getElementById(`hour-${hour}`).value;
        });

        return {
          wake: document.getElementById("wake").value,
          battery: document.getElementById("battery").value,
          plan: document.getElementById("plan").value,
          dayPlans: plannedDays,
          logs,
          yesterdayReview: {
            previousDate: previousDateKey,
            result: getCheckedValue("reviewResult"),
            duration: getCheckedValue("reviewDuration"),
            note: document.getElementById("reviewNote").value,
            completed: yesterdayReview.dataset.completed === "true",
            skipped: yesterdayReview.dataset.skipped === "true"
          }
        };
      }

      function saveData() {
        try {
          localStorage.setItem(storageKey, JSON.stringify(collectData()));
          return true;
        } catch (error) {
          return false;
        }
      }

      function buildCopyText() {
        const current = collectData();
        const lines = [];

        if (current.yesterdayReview.completed && !current.yesterdayReview.skipped) {
          lines.push(
            "【昨日の振り返り】",
            `日付：${previousDateLabel}`,
            `昨日の予定：${previousData.plan || ""}`,
            `進み具合：${current.yesterdayReview.result}`,
            `作業時間：${current.yesterdayReview.duration}`,
            `ひとこと：${current.yesterdayReview.note}`,
            ""
          );
        }

        const schedule = collectScheduleData();
        if (scheduleFields.some((id) => hasText(schedule[id]))) {
          lines.push(
            "【スケジュールの材料】",
            `やりたいこと：${schedule.scheduleWants}`,
            `やらなければいけないこと（締め切り含む）：${schedule.scheduleMusts}`,
            `予定と休み：${schedule.scheduleFixed}`,
            `ぺーさんと決めた仮スケジュール：${schedule.scheduleDraft}`,
            ""
          );
        }

        lines.push(
          "【ハルログ】",
          `今日：${todayLabel}`,
          `起床：${current.wake}`,
          `ボディバッテリー：${current.battery}`,
          `今日の予定：${current.plan}`,
          "",
          "【4つの小さな一日】"
        );

        dayPlans.forEach((index) => {
          lines.push(`第${index + 1}日（${getDayTimeLabel(index)}）　${current.dayPlans[index]}`);
        });

        lines.push("", "【1時間ごとの観察メモ】");

        hours.forEach((hour) => {
          lines.push(`${hour}:00　${current.logs[hour]}`);
        });

        return lines.join("\n");
      }

      function updateDayTimes() {
        dayPlans.forEach((index) => {
          document.getElementById(`day-time-${index}`).textContent = getDayTimeLabel(index);
        });
      }

      function getDayTimeLabel(index) {
        return getDayTimeLabelFromWake(document.getElementById("wake").value, index);
      }

      function getDayTimeLabelFromWake(wakeValue, index) {
        const wakeMinutes = parseTime(wakeValue);
        const firstStart = (wakeMinutes ?? 390) + 60;
        const start = firstStart + index * 240;
        const end = start + 240;
        return `${formatClock(start)}〜${formatClock(end)}`;
      }

      function parseTime(value) {
        const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) return null;
        return hour * 60 + minute;
      }

      function formatClock(totalMinutes) {
        const dayOffset = Math.floor(totalMinutes / 1440);
        const normalized = ((totalMinutes % 1440) + 1440) % 1440;
        const hour = Math.floor(normalized / 60);
        const minute = String(normalized % 60).padStart(2, "0");
        return `${dayOffset > 0 ? "翌 " : ""}${hour}:${minute}`;
      }

      async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            return;
          } catch (error) {
            // Safariで許可されない時は下の方法を試す
          }
        }

        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.fontSize = "16px";
        helper.style.position = "fixed";
        helper.style.top = "0";
        helper.style.left = "0";
        helper.style.width = "1px";
        helper.style.height = "1px";
        helper.style.opacity = "0.01";
        document.body.append(helper);
        helper.focus();
        helper.select();
        helper.setSelectionRange(0, helper.value.length);
        const copied = document.execCommand("copy");
        helper.remove();

        if (!copied) {
          throw new Error("Copy failed");
        }
      }

      function showMessage(text, duration = 1800) {
        message.textContent = text;
        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => {
          message.textContent = "";
        }, duration);
      }
    })();
