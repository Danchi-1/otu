(function () {
    var errorBox = document.getElementById("trackingError");
    var loadingPanel = document.getElementById("trackingLoading");
    var missingPanel = document.getElementById("trackingMissing");
    var content = document.getElementById("trackingContent");
    var statusDetails = {
        collecting: {
            label: "Collecting reports",
            note: "This claim is being collected. It has not been established as a finding."
        },
        held: {
            label: "Held for review",
            note: "This item is held for review and is not public."
        },
        cleared: {
            label: "Cleared · Not public",
            note: "This item is marked cleared. Cleared items are not automatically public; public output is aggregated and published separately."
        },
        published: {
            label: "Aggregate published",
            note: "An aggregate pattern has been published. Your individual report remains private."
        },
        rejected: {
            label: "Not accepted",
            note: "This report was not accepted. It is not public."
        },
        disputed: {
            label: "Disputed",
            note: "This finding is disputed. Any further action depends on the review process."
        }
    };

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        loadingPanel.hidden = true;
    }

    function formatDate(value) {
        if (!value) return "Not provided";
        var date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
    }

    function renderTimeline(events) {
        var timeline = document.getElementById("trackingTimeline");
        timeline.replaceChildren();
        events.forEach(function (event) {
            var item = document.createElement("li");
            var dot = document.createElement("span");
            dot.className = "timeline__dot";
            dot.setAttribute("aria-hidden", "true");
            var details = document.createElement("div");
            details.className = "timeline__content";
            var label = document.createElement("strong");
            label.textContent = event.label || "Status update";
            details.appendChild(label);
            if (event.occurred_at) {
                var time = document.createElement("time");
                time.dateTime = event.occurred_at;
                time.textContent = formatDate(event.occurred_at);
                details.appendChild(time);
            }
            item.append(dot, details);
            timeline.appendChild(item);
        });
    }

    function readTrackingCode() {
        try {
            return decodeURIComponent(window.location.hash.slice(1)).trim();
        } catch (error) {
            return "";
        }
    }

    async function loadReport() {
        var trackingCode = readTrackingCode();
        if (!trackingCode) {
            loadingPanel.hidden = true;
            missingPanel.hidden = false;
            return;
        }

        try {
            await window.VioApi.get("/auth/session");
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("sign-in.html");
                return;
            }
            showError(error.message);
            return;
        }

        try {
            var report = await window.VioApi.get(
                "/student/reports/" + encodeURIComponent(trackingCode)
            );
            var status = statusDetails[report.finding_status] || {
                label: "Status unavailable",
                note: "VIO has not supplied a displayable status for this report."
            };
            var statusElement = document.getElementById("trackingStatus");
            statusElement.textContent = status.label;
            statusElement.className = "app-status " +
                (report.finding_status === "collecting" || report.finding_status === "published"
                    ? "app-status--teal"
                    : report.finding_status === "held" || report.finding_status === "disputed"
                        ? "app-status--gold"
                        : "app-status--muted");
            document.getElementById("trackingStatusNote").textContent = status.note;
            document.getElementById("trackingCourse").textContent =
                report.course_code + " · " + report.course_title + " · " +
                String(report.category || "").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
                    return letter.toUpperCase();
                });
            document.getElementById("trackingDate").textContent = formatDate(report.incident_date);
            document.getElementById("reportDescription").textContent = report.description || "";

            if (report.public_summary) {
                document.getElementById("publicSummary").textContent = report.public_summary;
                document.getElementById("publicSummarySection").hidden = false;
            }
            renderTimeline(Array.isArray(report.timeline) ? report.timeline : []);
            loadingPanel.hidden = true;
            content.hidden = false;
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("sign-in.html");
                return;
            }
            showError(error.status === 404
                ? "This report could not be found for your account. Check the saved link and sign in with the account that filed it."
                : error.message);
        }
    }

    loadReport();
})();
