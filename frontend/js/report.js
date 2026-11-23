(function () {
    var loadingPanel = document.getElementById("reportLoading");
    var unavailablePanel = document.getElementById("reportUnavailable");
    var formPanel = document.getElementById("reportFormPanel");
    var form = document.getElementById("reportForm");
    var review = document.getElementById("reportReview");
    var success = document.getElementById("reportSuccess");
    var errorBox = document.getElementById("reportError");
    var noticeBox = document.getElementById("reportNotice");
    var description = document.getElementById("description");
    var submitButton = document.getElementById("submitReport");
    var options = null;
    var session = null;
    var trackingUrl = "";

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        noticeBox.hidden = true;
    }

    function showUnavailable(title, message, actionHref, actionLabel) {
        loadingPanel.hidden = true;
        formPanel.hidden = true;
        unavailablePanel.hidden = false;
        document.getElementById("unavailableTitle").textContent = title;
        document.getElementById("unavailableMessage").textContent = message;
        var action = document.getElementById("unavailableAction");
        action.href = actionHref || "student.html";
        action.textContent = actionLabel || "Go to your student space";
    }

    function handleAuthError(error) {
        if (error.status === 401) {
            window.location.replace("sign-in.html");
            return true;
        }
        return false;
    }

    function updateCounter() {
        if (!options) return;
        var maxLength = options.description.max_length;
        var remaining = maxLength - description.value.length;
        document.getElementById("descriptionCounter").textContent =
            description.value.length + " / " + maxLength + " characters" +
            (remaining < 0 ? " · " + Math.abs(remaining) + " over limit" : "");
    }

    function populateOptions(data) {
        options = data;
        var courseSelect = document.getElementById("course");
        var categorySelect = document.getElementById("category");

        data.courses.forEach(function (course) {
            courseSelect.add(new Option(
                course.course_code + " · " + course.course_title,
                course.course_id
            ));
        });
        data.categories.forEach(function (category) {
            categorySelect.add(new Option(category.label, category.value));
        });

        document.getElementById("reportSession").textContent =
            data.academic_session + (data.academic_session_status === "proposed"
                ? " · Proposed calendar"
                : " · Confirmed calendar");
        var dateHint = document.getElementById("dateHint");
        if (data.incident_date.note) dateHint.textContent = data.incident_date.note;
        description.minLength = data.description.min_length;
        description.maxLength = data.description.max_length;
        document.getElementById("descriptionHint").textContent =
            "Write at least " + data.description.min_length + " characters and no more than " +
            data.description.max_length + ". Do not include names or private details about others.";
        updateCounter();
    }

    async function loadOptions() {
        try {
            session = await window.VioApi.get("/auth/session");
        } catch (error) {
            if (!handleAuthError(error)) showUnavailable("Could not check your account", error.message);
            return;
        }

        if (session.setup_state !== "ready") {
            showUnavailable(
                "Finish your student setup first",
                "Complete your profile and confirm the academic session before filing a report.",
                "setup.html",
                "Review your setup"
            );
            return;
        }

        try {
            var data = await window.VioApi.get("/student/report-options");
            if (!data.courses || data.courses.length === 0) {
                showUnavailable(
                    "No selected courses yet",
                    "VIO can only accept reports about courses returned for your account. Choose your courses in student setup first.",
                    "setup.html",
                    "Choose your courses"
                );
                return;
            }
            populateOptions(data);
            loadingPanel.hidden = true;
            formPanel.hidden = false;
        } catch (error) {
            if (handleAuthError(error)) return;
            if (error.code === "session_confirmation_required" || error.code === "profile_required") {
                showUnavailable("Complete your setup first", error.message, "setup.html", "Review your setup");
            } else {
                showUnavailable("Reporting is not available", error.message);
            }
        }
    }

    function getSelectedText(id) {
        var select = document.getElementById(id);
        return select.options[select.selectedIndex].text;
    }

    function showReview() {
        if (!form.reportValidity()) return;
        document.getElementById("reviewCourse").textContent = getSelectedText("course");
        document.getElementById("reviewCategory").textContent = getSelectedText("category");
        document.getElementById("reviewDate").textContent =
            new Date(document.getElementById("incidentDate").value + "T00:00:00").toLocaleDateString();
        document.getElementById("reviewDescription").textContent = description.value.trim();
        form.hidden = true;
        review.hidden = false;
        errorBox.hidden = true;
        review.querySelector("h2").focus();
    }

    async function submitReport() {
        errorBox.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = "Submitting securely…";
        submitButton.classList.add("app-button-loading");

        try {
            var report = await window.VioApi.post("/student/reports", {
                course_id: document.getElementById("course").value,
                incident_date: document.getElementById("incidentDate").value,
                category: document.getElementById("category").value,
                description: description.value.trim()
            });
            document.getElementById("trackingCode").textContent = report.tracking_code;
            trackingUrl = "tracking.html#" + encodeURIComponent(report.tracking_code);
            document.getElementById("viewTracking").href = trackingUrl;
            document.getElementById("successMessage").textContent =
                report.message || "Your report was received. It has not been established as a finding.";
            form.hidden = true;
            review.hidden = true;
            success.hidden = false;
            success.focus();
        } catch (error) {
            if (!handleAuthError(error)) showError(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Submit private report";
            submitButton.classList.remove("app-button-loading");
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        showReview();
    });
    document.getElementById("editReport").addEventListener("click", function () {
        review.hidden = true;
        form.hidden = false;
        document.getElementById("course").focus();
    });
    submitButton.addEventListener("click", submitReport);
    description.addEventListener("input", updateCounter);
    document.getElementById("copyTrackingCode").addEventListener("click", async function () {
        try {
            await navigator.clipboard.writeText(document.getElementById("trackingCode").textContent);
            noticeBox.textContent = "Tracking code copied. Keep it private.";
            noticeBox.hidden = false;
            errorBox.hidden = true;
        } catch (error) {
            noticeBox.textContent = "Copy is unavailable in this browser. Select the code above to copy it manually.";
            noticeBox.hidden = false;
        }
    });

    loadOptions();
})();
