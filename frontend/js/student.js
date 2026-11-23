(function () {
    var errorBox = document.getElementById("studentError");
    var reportsList = document.getElementById("reportsList");
    var coursesList = document.getElementById("coursesList");
    var loadMoreButton = document.getElementById("loadMoreReports");
    var nextCursor = null;
    var currentSession = null;
    var reportCount = 0;
    var statusLabels = {
        collecting: "Collecting reports",
        held: "Held for review",
        cleared: "Cleared · Not public",
        published: "Published as an aggregate",
        rejected: "Rejected",
        disputed: "Disputed"
    };

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    function statusClass(status) {
        if (status === "collecting" || status === "published") return "app-status app-status--teal";
        if (status === "held" || status === "disputed") return "app-status app-status--gold";
        return "app-status app-status--muted";
    }

    function categoryLabel(category) {
        return String(category || "").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
            return letter.toUpperCase();
        });
    }

    function renderReports(reports, append) {
        if (!append) reportsList.replaceChildren();
        reports.forEach(function (report) {
            var item = document.createElement("article");
            item.className = "app-list-item";
            var main = document.createElement("div");
            main.className = "app-list-item__main";
            var title = document.createElement("div");
            title.className = "app-list-item__title";
            title.textContent = report.course_code + " · " + categoryLabel(report.category);
            var meta = document.createElement("div");
            meta.className = "app-list-item__meta";
            meta.textContent = new Date(report.incident_date + "T00:00:00").toLocaleDateString() +
                (report.created_at ? " · Filed " + new Date(report.created_at).toLocaleDateString() : "");
            main.append(title, meta);

            var aside = document.createElement("div");
            aside.className = "app-list-item__actions";
            var status = document.createElement("span");
            status.className = statusClass(report.finding_status);
            status.textContent = statusLabels[report.finding_status] || "Status unavailable";
            var link = document.createElement("a");
            link.className = "app-link";
            link.href = "tracking.html#" + encodeURIComponent(report.tracking_code);
            link.textContent = "View status";
            aside.append(status, link);
            item.append(main, aside);
            reportsList.appendChild(item);
        });
    }

    async function loadReports(cursor) {
        var path = "/student/reports?limit=5";
        if (cursor) path += "&cursor=" + encodeURIComponent(cursor);
        var result = await window.VioApi.getPage(path);
        renderReports(result.data, Boolean(cursor));
        reportCount += result.data.length;
        document.getElementById("reportCount").textContent = String(reportCount);
        document.getElementById("reportsEmpty").hidden = reportCount !== 0;
        nextCursor = result.meta ? result.meta.next_cursor : null;
        loadMoreButton.hidden = !nextCursor;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = "Load older reports";
    }

    function renderCourses(courses) {
        coursesList.replaceChildren();
        document.getElementById("courseCount").textContent = String(courses.length);
        document.getElementById("coursesEmpty").hidden = courses.length !== 0;

        courses.slice(0, 8).forEach(function (course) {
            var item = document.createElement("article");
            item.className = "app-list-item";
            var main = document.createElement("div");
            main.className = "app-list-item__main";
            var title = document.createElement("div");
            title.className = "app-list-item__title";
            title.textContent = course.course_code + " · " + course.course_title;
            var meta = document.createElement("div");
            meta.className = "app-list-item__meta";
            meta.textContent = course.level + " level · " + course.department;
            main.append(title, meta);
            var status = document.createElement("span");
            status.className = "app-status app-status--gold";
            status.textContent = "Self-declared";
            item.append(main, status);
            coursesList.appendChild(item);
        });

        if (courses.length > 8) {
            var note = document.createElement("p");
            note.className = "form-help";
            note.textContent = "Showing 8 of " + courses.length + " selected courses.";
            coursesList.appendChild(note);
        }
    }

    async function loadStudentSpace() {
        var session;
        try {
            session = await window.VioApi.get("/auth/session");
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("sign-in.html");
                return;
            }
            showError(error.message);
            return;
        }

        if (session.setup_state !== "ready") {
            window.location.replace("setup.html");
            return;
        }

        currentSession = session.academic_session;
        document.getElementById("sessionValue").textContent = currentSession || "Unavailable";
        var sessionHint = session.academic_session_status === "proposed"
            ? "Proposed calendar · dates may change"
            : session.academic_session_status === "confirmed"
                ? "Confirmed academic calendar"
                : "Calendar status unavailable";
        document.getElementById("sessionHint").textContent = sessionHint;

        try {
            var values = await Promise.all([
                window.VioApi.get("/student/profile"),
                window.VioApi.get("/student/courses?academic_session=" + encodeURIComponent(currentSession)),
                window.VioApi.getPage("/student/reports?limit=5")
            ]);
            var profile = values[0];
            var courses = values[1];
            var reportResponse = values[2];
            document.getElementById("profileSummary").textContent =
                "Level " + (profile.level || "not selected") + " · Department profile saved";
            renderCourses(courses);
            renderReports(reportResponse.data, false);
            reportCount = reportResponse.data.length;
            document.getElementById("reportCount").textContent = String(reportCount);
            document.getElementById("reportsEmpty").hidden = reportCount !== 0;
            nextCursor = reportResponse.meta ? reportResponse.meta.next_cursor : null;
            loadMoreButton.hidden = !nextCursor;
        } catch (error) {
            showError(error.message);
        }
    }

    loadMoreButton.addEventListener("click", async function () {
        if (!nextCursor) return;
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = "Loading…";
        try {
            await loadReports(nextCursor);
        } catch (error) {
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = "Try loading again";
            showError(error.message);
        }
    });

    document.getElementById("signOut").addEventListener("click", async function () {
        try {
            await window.VioApi.delete("/auth/session");
            sessionStorage.removeItem("vioUniversityId");
            window.location.assign("index.html");
        } catch (error) {
            showError(error.message);
        }
    });

    loadStudentSpace();
})();
